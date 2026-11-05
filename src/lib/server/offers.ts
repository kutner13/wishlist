// Offers: best-price bookkeeping, the Claude price routine's API writes, and the
// product-page fetch that fills `source='page'` offers and images (SPEC §6).
import { PAGE_REFRESH_HOURS } from '#lib/config';
import { hostnameOf } from '#lib/parse';
import type { ItemRow } from '#lib/types';
import type { Db } from './db';
import type { ImageStore } from './images';
import { parsePageMeta } from './pagemeta';

/** Marks the cheapest priced offer of an item as is_best (ties: page > claude > manual, then id). */
export async function recomputeBest(db: Db, itemId: number) {
	await db.run('UPDATE offers SET is_best = 0 WHERE item_id = ?', itemId);
	const best = await db.first<{ id: number }>(
		`SELECT id FROM offers WHERE item_id = ? AND price_cents IS NOT NULL
		 ORDER BY price_cents ASC,
		   CASE source WHEN 'page' THEN 0 WHEN 'claude' THEN 1 ELSE 2 END, id LIMIT 1`,
		itemId
	);
	if (best) await db.run('UPDATE offers SET is_best = 1 WHERE id = ?', best.id);
}

export interface IncomingOffer {
	store: string;
	price_cents: number | null;
	currency?: string;
	url?: string | null;
	note?: string | null;
}

/** Replaces the item's `claude` offers with the given list. */
export async function replaceClaudeOffers(
	db: Db,
	itemId: number,
	offers: IncomingOffer[],
	now = new Date().toISOString()
) {
	await db.run("DELETE FROM offers WHERE item_id = ? AND source = 'claude'", itemId);
	for (const o of offers.slice(0, 10)) {
		if (!o.store) continue;
		await db.run(
			`INSERT INTO offers (item_id, source, store, price_cents, currency, url, note, fetched_at)
			 VALUES (?, 'claude', ?, ?, ?, ?, ?, ?)`,
			itemId,
			String(o.store).slice(0, 80),
			typeof o.price_cents === 'number' && o.price_cents >= 0 ? Math.round(o.price_cents) : null,
			(o.currency ?? 'USD').toUpperCase().slice(0, 3),
			o.url ? String(o.url).slice(0, 2000) : null,
			o.note ? String(o.note).slice(0, 300) : null,
			now
		);
	}
	await recomputeBest(db, itemId);
}

export interface PageFetcher {
	/** Returns the HTML, or null when the site blocked us / timed out. Should not throw. */
	fetchHtml(url: string): Promise<{ status: number; html: string | null }>;
	fetchBinary(url: string): Promise<{ contentType: string; bytes: ArrayBuffer } | null>;
}

const UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

export function httpPageFetcher(fetchImpl: typeof fetch = fetch, timeoutMs = 8000): PageFetcher {
	const headers = {
		'User-Agent': UA,
		Accept: 'text/html,application/xhtml+xml,image/avif,image/webp,*/*;q=0.8',
		'Accept-Language': 'en-US,en;q=0.9'
	};
	return {
		async fetchHtml(url) {
			try {
				const res = await fetchImpl(url, {
					headers,
					redirect: 'follow',
					signal: AbortSignal.timeout(timeoutMs)
				});
				if (!res.ok) return { status: res.status, html: null };
				const text = await res.text();
				return { status: res.status, html: text.slice(0, 2_000_000) };
			} catch {
				return { status: 0, html: null };
			}
		},
		async fetchBinary(url) {
			try {
				const res = await fetchImpl(url, {
					headers,
					redirect: 'follow',
					signal: AbortSignal.timeout(timeoutMs)
				});
				if (!res.ok) return null;
				const contentType = res.headers.get('content-type') ?? '';
				if (!contentType.startsWith('image/')) return null;
				const bytes = await res.arrayBuffer();
				if (bytes.byteLength > 8_000_000) return null;
				return { contentType, bytes };
			} catch {
				return null;
			}
		}
	};
}

export interface RefreshSummary {
	checked: number;
	imagesStored: number;
	offersWritten: number;
	errors: string[];
}

/**
 * Fetches product pages for items that have a URL and either no image or no page
 * check in the last PAGE_REFRESH_HOURS (or all of them with `force`). A failing page
 * never throws; the item's page_checked_at is still bumped so one bad page can't
 * stall every sync.
 */
export async function refreshPages(
	db: Db,
	fetcher: PageFetcher,
	images: ImageStore,
	opts: { force?: boolean; now?: Date; limit?: number } = {}
): Promise<RefreshSummary> {
	const now = opts.now ?? new Date();
	const cutoff = new Date(now.getTime() - PAGE_REFRESH_HOURS * 3_600_000).toISOString();
	const items = await db.all<ItemRow>(
		opts.force
			? 'SELECT * FROM items WHERE removed_at IS NULL AND product_url IS NOT NULL ORDER BY updated_at DESC LIMIT ?'
			: `SELECT * FROM items WHERE removed_at IS NULL AND product_url IS NOT NULL
			   AND (image_key IS NULL OR page_checked_at IS NULL OR page_checked_at < ?)
			   ORDER BY page_checked_at IS NOT NULL, page_checked_at LIMIT ?`,
		...(opts.force ? [opts.limit ?? 200] : [cutoff, opts.limit ?? 40])
	);
	const summary: RefreshSummary = { checked: 0, imagesStored: 0, offersWritten: 0, errors: [] };
	for (const item of items) {
		summary.checked++;
		try {
			const r = await refreshOne(db, fetcher, images, item, now);
			if (r.image) summary.imagesStored++;
			if (r.offer) summary.offersWritten++;
			if (r.error) summary.errors.push(`${item.name}: ${r.error}`);
		} catch (e) {
			summary.errors.push(`${item.name}: ${(e as Error).message}`);
		}
		await db.run('UPDATE items SET page_checked_at = ? WHERE id = ?', now.toISOString(), item.id);
	}
	return summary;
}

async function refreshOne(
	db: Db,
	fetcher: PageFetcher,
	images: ImageStore,
	item: ItemRow,
	now: Date
): Promise<{ image: boolean; offer: boolean; error: string | null }> {
	const url = item.product_url!;
	const page = await fetcher.fetchHtml(url);
	if (!page.html) {
		return { image: false, offer: false, error: `page fetch failed (${page.status || 'timeout'})` };
	}
	const meta = parsePageMeta(page.html, url);
	let image = false;
	if (meta.image && !item.image_key) {
		const bin = await fetcher.fetchBinary(meta.image);
		if (bin) {
			const key = await images.store(item.id, bin.bytes, bin.contentType);
			await db.run('UPDATE items SET image_key = ? WHERE id = ?', key, item.id);
			image = true;
		}
	}
	let offer = false;
	if (meta.priceCents !== null) {
		await db.run("DELETE FROM offers WHERE item_id = ? AND source = 'page'", item.id);
		await db.run(
			`INSERT INTO offers (item_id, source, store, price_cents, currency, url, note, fetched_at)
			 VALUES (?, 'page', ?, ?, ?, ?, ?, ?)`,
			item.id,
			hostnameOf(url),
			meta.priceCents,
			meta.currency ?? 'USD',
			url,
			meta.title ? meta.title.slice(0, 200) : null,
			now.toISOString()
		);
		await recomputeBest(db, item.id);
		offer = true;
	}
	return { image, offer, error: null };
}
