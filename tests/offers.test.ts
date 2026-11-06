import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { memoryImageStore } from '../src/lib/server/images';
import {
	recomputeBest,
	refreshPages,
	replaceClaudeOffers,
	type PageFetcher
} from '../src/lib/server/offers';
import { applyFilters, loadItem, loadPersonItems, parseFilters } from '../src/lib/server/queries';
import type { ItemRow, OfferRow } from '../src/lib/types';
import { insertItem, testDb } from './helpers';

const html = readFileSync(new URL('./fixtures/product-page.html', import.meta.url), 'utf8');

function fetcher(
	opts: { blocked?: string[]; noImage?: boolean } = {}
): PageFetcher & { calls: string[] } {
	const calls: string[] = [];
	return {
		calls,
		async fetchHtml(url) {
			calls.push(url);
			if (opts.blocked?.some((b) => url.includes(b))) return { status: 403, html: null };
			return { status: 200, html };
		},
		async fetchBinary(url) {
			calls.push(url);
			if (opts.noImage) return null;
			return { contentType: 'image/png', bytes: new Uint8Array([1, 2, 3]).buffer };
		}
	};
}

describe('refreshPages', () => {
	it('stores the image, writes a page offer, and marks the item checked', async () => {
		const db = testDb();
		const id = await insertItem(db, {
			product_url: 'https://www.lego.com/p/42077',
			about_price_cents: 4500
		});
		const images = memoryImageStore();
		const f = fetcher();
		const s = await refreshPages(db, f, images, { now: new Date('2026-11-05T09:00:00Z') });
		expect(s).toEqual({ checked: 1, imagesStored: 1, offersWritten: 1, errors: [] });
		const item = (await db.first<ItemRow>('SELECT * FROM items WHERE id = ?', id))!;
		expect(item.image_key).toMatch(new RegExp(`^items/${id}/[0-9a-f]{16}\\.png$`));
		expect(item.page_checked_at).toBe('2026-11-05T09:00:00.000Z');
		const offers = await db.all<OfferRow>('SELECT * FROM offers WHERE item_id = ?', id);
		expect(offers).toHaveLength(1);
		expect(offers[0]).toMatchObject({
			source: 'page',
			store: 'lego.com',
			price_cents: 4249,
			is_best: 1
		});

		// Fresh enough: not fetched again; forced: fetched, offer replaced not duplicated.
		const s2 = await refreshPages(db, f, images, { now: new Date('2026-11-05T12:00:00Z') });
		expect(s2.checked).toBe(0);
		const s3 = await refreshPages(db, f, images, {
			now: new Date('2026-11-05T12:00:00Z'),
			force: true
		});
		expect(s3.checked).toBe(1);
		expect(await db.all('SELECT * FROM offers WHERE item_id = ?', id)).toHaveLength(1);
		// Image already cached: binary not fetched again.
		expect(images.keys).toHaveLength(1);
	});

	it('a blocked page records an error but does not stop the others', async () => {
		const db = testDb();
		const a = await insertItem(db, {
			name: 'Amazon thing',
			product_url: 'https://www.amazon.com/dp/1'
		});
		const b = await insertItem(db, { name: 'Lego', product_url: 'https://www.lego.com/p/2' });
		const s = await refreshPages(db, fetcher({ blocked: ['amazon'] }), memoryImageStore());
		expect(s.checked).toBe(2);
		expect(s.offersWritten).toBe(1);
		expect(s.errors).toEqual(['Amazon thing: page fetch failed (403)']);
		expect(
			(await db.first<ItemRow>('SELECT * FROM items WHERE id = ?', a))!.page_checked_at
		).not.toBeNull();
		expect(
			(await db.first<ItemRow>('SELECT * FROM items WHERE id = ?', b))!.image_key
		).not.toBeNull();
	});

	it('skips items without a URL and tolerates a missing image', async () => {
		const db = testDb();
		await insertItem(db, { product_url: null });
		const id = await insertItem(db, { product_url: 'https://www.lego.com/p/3' });
		const s = await refreshPages(db, fetcher({ noImage: true }), memoryImageStore());
		expect(s.checked).toBe(1);
		expect(s.imagesStored).toBe(0);
		expect((await db.first<ItemRow>('SELECT * FROM items WHERE id = ?', id))!.image_key).toBeNull();
	});

	it('asks a blocking store once a day, not on every 15-minute sync', async () => {
		// Live case: Mitchell & Ness answers 403, so the item never gets an image.
		const db = testDb();
		await insertItem(db, { name: 'Sixers Hoody', product_url: 'https://www.amazon.com/dp/1' });
		const f = fetcher({ blocked: ['amazon'] });
		const at = (iso: string) => refreshPages(db, f, memoryImageStore(), { now: new Date(iso) });
		expect((await at('2026-11-05T03:30:00Z')).checked).toBe(1);
		expect((await at('2026-11-05T03:45:00Z')).checked).toBe(0);
		expect((await at('2026-11-05T20:00:00Z')).checked).toBe(0);
		expect((await at('2026-11-06T03:31:00Z')).checked).toBe(1);
	});
});

describe('offers and best price', () => {
	it('replaceClaudeOffers replaces only claude offers and recomputes best', async () => {
		const db = testDb();
		const id = await insertItem(db, { about_price_cents: 4500 });
		await db.run(
			"INSERT INTO offers (item_id, source, store, price_cents, currency, url, fetched_at) VALUES (?, 'page', 'lego.com', 4499, 'USD', 'https://lego', '2026-11-01T00:00:00Z')",
			id
		);
		await recomputeBest(db, id);
		await replaceClaudeOffers(db, id, [
			{ store: 'Target', price_cents: 4200, url: 'https://target' },
			{ store: 'Walmart', price_cents: 4300 },
			{ store: 'Nowhere', price_cents: null }
		]);
		let view = (await loadItem(db, id))!;
		expect(view.bestOffer?.store).toBe('Target');
		expect(view.headlinePriceCents).toBe(4200);
		expect(view.headlineIsEstimate).toBe(false);
		expect(view.offers.map((o) => o.store)).toEqual(['Target', 'Walmart', 'lego.com']); // max 3, best first

		await replaceClaudeOffers(db, id, [{ store: 'Target', price_cents: 4600 }]);
		view = (await loadItem(db, id))!;
		expect(view.bestOffer?.store).toBe('lego.com');
		expect(view.offers).toHaveLength(2);
	});

	it('headline falls back to the ~price hint, then nothing', async () => {
		const db = testDb();
		const withHint = await insertItem(db, { about_price_cents: 2000 });
		const bare = await insertItem(db);
		const a = (await loadItem(db, withHint))!;
		expect(a.headlinePriceCents).toBe(2000);
		expect(a.headlineIsEstimate).toBe(true);
		const b = (await loadItem(db, bare))!;
		expect(b.headlinePriceCents).toBeNull();
	});
});

describe('list filters and sort', () => {
	it('available-only by default, bands, sort by desire then price', async () => {
		const db = testDb();
		const cheap = await insertItem(db, { name: 'cheap', about_price_cents: 1000, desire: 3 });
		const want = await insertItem(db, { name: 'want', about_price_cents: 9000, desire: 1 });
		const bought = await insertItem(db, {
			name: 'bought',
			about_price_cents: 3000,
			desire: 1,
			bought_in_todoist: 1
		});
		await insertItem(db, { name: 'hidden', hidden: 1 });
		const all = await loadPersonItems(db, 3);
		expect(all.map((i) => i.id)).toEqual([cheap, want, bought]);

		const def = applyFilters(all, parseFilters(new URLSearchParams('')));
		expect(def.map((i) => i.name)).toEqual(['want', 'cheap']);

		const showAll = applyFilters(all, parseFilters(new URLSearchParams('all=1')));
		expect(showAll.map((i) => i.name)).toEqual(['bought', 'want', 'cheap']);

		const byPrice = applyFilters(all, parseFilters(new URLSearchParams('sort=price&all=1')));
		expect(byPrice.map((i) => i.name)).toEqual(['cheap', 'bought', 'want']);

		const band = applyFilters(all, parseFilters(new URLSearchParams('price=under25')));
		expect(band.map((i) => i.name)).toEqual(['cheap']);
	});
});
