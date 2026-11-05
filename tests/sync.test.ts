import { describe, expect, it } from 'vitest';
import { syncFromTodoist } from '../src/lib/server/sync';
import type { ItemRow, OfferRow } from '../src/lib/types';
import { fakeSource, sections, tasks } from './fixtures/todoist';
import { testDb } from './helpers';

const NOW = '2026-11-05T10:00:00.000Z';

describe('syncFromTodoist', () => {
	it('upserts tasks in family sections and ignores the rest', async () => {
		const db = testDb();
		const summary = await syncFromTodoist(db, fakeSource(), { now: NOW });
		expect(summary.sectionsMatched).toBe(4);
		expect(summary.upserted).toBe(6);
		expect(summary.removed).toBe(0);

		const items = await db.all<ItemRow>('SELECT * FROM items ORDER BY id');
		const ids = items.map((i) => i.todoist_task_id);
		expect(ids).not.toContain('t-paint');
		expect(ids).not.toContain('t-nosection');

		const lego = items.find((i) => i.todoist_task_id === 't-lego')!;
		expect(lego.person_id).toBe(3);
		expect(lego.product_url).toBe('https://www.lego.com/en-us/product/rally-car-42077');
		expect(lego.desire).toBe(1);
		expect(lego.about_price_cents).toBe(4500);
		expect(lego.occasion).toBe('holidays');
		expect(JSON.parse(lego.categories)).toEqual(['toys']);
		expect(lego.notes).toBe(
			'The 42xxx one with the pull-back motor, not the small one.\nhttps://www.target.com/p/lego-rally/-/A-123'
		);
		expect(lego.created_at).toBe('2026-10-20T12:00:00Z');

		const towel = items.find((i) => i.todoist_task_id === 't-towel')!;
		expect(towel.qty).toBe(2);
		expect(towel.about_price_cents).toBe(2500);

		const dogman = items.find((i) => i.todoist_task_id === 't-dogman')!;
		expect(dogman.bought_in_todoist).toBe(1);
		expect(JSON.parse(dogman.categories)).toEqual(['books']);

		expect(items.find((i) => i.todoist_task_id === 't-secret')!.hidden).toBe(1);
		expect(items.find((i) => i.todoist_task_id === 't-profile')!.hidden).toBe(1);

		const people = await db.all<{ slug: string; todoist_section_id: string }>(
			'SELECT slug, todoist_section_id FROM people ORDER BY sort_order'
		);
		expect(people.map((p) => p.todoist_section_id)).toEqual([
			's-kev',
			's-casey',
			's-robbie',
			's-logan'
		]);
	});

	it('creates manual offers from extra URLs and keeps them in sync', async () => {
		const db = testDb();
		await syncFromTodoist(db, fakeSource(), { now: NOW });
		const lego = await db.first<ItemRow>("SELECT * FROM items WHERE todoist_task_id = 't-lego'");
		let offers = await db.all<OfferRow>('SELECT * FROM offers WHERE item_id = ?', lego!.id);
		expect(offers).toHaveLength(1);
		expect(offers[0].source).toBe('manual');
		expect(offers[0].store).toBe('target.com');
		expect(offers[0].is_best).toBe(0); // no price

		// Owner removes the extra URL: manual offer goes away.
		const edited = tasks.map((t) =>
			t.id === 't-lego'
				? { ...t, description: 'https://www.lego.com/en-us/product/rally-car-42077' }
				: t
		);
		await syncFromTodoist(db, fakeSource({ tasks: edited }), { now: NOW });
		offers = await db.all<OfferRow>('SELECT * FROM offers WHERE item_id = ?', lego!.id);
		expect(offers).toHaveLength(0);
	});

	it('soft-deletes tasks that disappear and revives them when they come back', async () => {
		const db = testDb();
		await syncFromTodoist(db, fakeSource(), { now: NOW });
		const without = tasks.filter((t) => t.id !== 't-socks');
		const s2 = await syncFromTodoist(db, fakeSource({ tasks: without }), {
			now: '2026-11-06T00:00:00.000Z'
		});
		expect(s2.removed).toBe(1);
		let socks = await db.first<ItemRow>("SELECT * FROM items WHERE todoist_task_id = 't-socks'");
		expect(socks!.removed_at).toBe('2026-11-06T00:00:00.000Z');

		const s3 = await syncFromTodoist(db, fakeSource(), { now: '2026-11-07T00:00:00.000Z' });
		expect(s3.removed).toBe(0);
		socks = await db.first<ItemRow>("SELECT * FROM items WHERE todoist_task_id = 't-socks'");
		expect(socks!.removed_at).toBeNull();
		// Same row, not a duplicate.
		const n = await db.first<{ n: number }>(
			"SELECT COUNT(*) AS n FROM items WHERE todoist_task_id = 't-socks'"
		);
		expect(n!.n).toBe(1);
	});

	it('treats completed tasks as removed and mirrors label changes', async () => {
		const db = testDb();
		await syncFromTodoist(db, fakeSource(), { now: NOW });
		const edited = tasks.map((t) => {
			if (t.id === 't-lego') return { ...t, checked: true };
			if (t.id === 't-dogman') return { ...t, labels: ['books'] };
			if (t.id === 't-towel') return { ...t, labels: ['clothes', 'bought'], section_id: 's-logan' };
			return t;
		});
		await syncFromTodoist(db, fakeSource({ tasks: edited }), { now: NOW });
		const lego = await db.first<ItemRow>("SELECT * FROM items WHERE todoist_task_id = 't-lego'");
		expect(lego!.removed_at).toBe(NOW);
		const dogman = await db.first<ItemRow>(
			"SELECT * FROM items WHERE todoist_task_id = 't-dogman'"
		);
		expect(dogman!.bought_in_todoist).toBe(0);
		const towel = await db.first<ItemRow>("SELECT * FROM items WHERE todoist_task_id = 't-towel'");
		expect(towel!.bought_in_todoist).toBe(1);
		expect(towel!.person_id).toBe(4); // moved to Logan's section
	});

	it('resets page_checked_at when the product URL changes', async () => {
		const db = testDb();
		await syncFromTodoist(db, fakeSource(), { now: NOW });
		await db.run("UPDATE items SET page_checked_at = ? WHERE todoist_task_id = 't-lego'", NOW);
		await syncFromTodoist(db, fakeSource(), { now: NOW });
		expect(
			(await db.first<ItemRow>("SELECT * FROM items WHERE todoist_task_id = 't-lego'"))!
				.page_checked_at
		).toBe(NOW);
		const edited = tasks.map((t) =>
			t.id === 't-lego' ? { ...t, description: 'https://other.example/x' } : t
		);
		await syncFromTodoist(db, fakeSource({ tasks: edited }), { now: NOW });
		expect(
			(await db.first<ItemRow>("SELECT * FROM items WHERE todoist_task_id = 't-lego'"))!
				.page_checked_at
		).toBeNull();
	});

	it('fails loudly when the project is missing', async () => {
		const db = testDb();
		const src = fakeSource();
		src.findProjectIdByName = async () => null;
		await expect(syncFromTodoist(db, src)).rejects.toThrow(/Purchases/);
	});

	it('uses the configured project id without a name lookup', async () => {
		const db = testDb();
		const src = fakeSource({ sections, tasks });
		src.findProjectIdByName = async () => {
			throw new Error('should not be called');
		};
		const s = await syncFromTodoist(db, src, { projectId: '6hRR4gXPcqj5Jm3w', now: NOW });
		expect(s.upserted).toBe(6);
	});
});
