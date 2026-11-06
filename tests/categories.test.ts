import { describe, expect, it } from 'vitest';
import { categoryLabel } from '../src/lib/format';
import { buildManifest, loadCategoriesInUse, loadPendingItems } from '../src/lib/server/enrich';
import {
	groupByCategory,
	loadItem,
	loadPersonItems,
	loadPersonSummaries
} from '../src/lib/server/queries';
import { syncFromTodoist } from '../src/lib/server/sync';
import type { ItemView } from '../src/lib/types';
import { fakeSource, tasks } from './fixtures/todoist';
import { testDb } from './helpers';

const NOW = '2026-11-05T10:00:00.000Z';
const KEVIN = 1;

describe('categoryLabel', () => {
	it('turns label keys into display names and leaves task names alone', () => {
		expect(categoryLabel('motorcycle')).toBe('Motorcycle');
		expect(categoryLabel('road-supplies')).toBe('Road supplies');
		expect(categoryLabel('road_supplies')).toBe('Road supplies');
		expect(categoryLabel('home-automation')).toBe('Home automation');
		expect(categoryLabel('Road Supplies')).toBe('Road Supplies');
	});
});

describe('subtasks', () => {
	it('hides a parent with active children and gives label-less children its name', async () => {
		const db = testDb();
		await syncFromTodoist(db, fakeSource(), { now: NOW });
		const items = await loadPersonItems(db, KEVIN);
		const names = items.map((i) => i.name);
		expect(names).not.toContain('Road Supplies');
		expect(names).not.toContain('Extra Fuses'); // @hidden child
		expect(names).toEqual(
			expect.arrayContaining(['Roadside tool kit', 'Flat Tire Kit', 'Battery Jump Pack'])
		);
		const toolkit = items.find((i) => i.name === 'Roadside tool kit')!;
		expect(toolkit.categories).toEqual(['Road Supplies']);
		expect(toolkit.parentName).toBe('Road Supplies');
		// A labelled child keeps its own label.
		expect(items.find((i) => i.name === 'Battery Jump Pack')!.categories).toEqual(['motorcycle']);
		expect(items.find((i) => i.name === 'Saddlebags')!.parentName).toBeNull();

		// The parent is not reachable as an item either, and not counted on the home page.
		const parent = await db.first<{ id: number }>(
			"SELECT id FROM items WHERE todoist_task_id = 't-road'"
		);
		expect(await loadItem(db, parent!.id)).toBeNull();
		const kevin = (await loadPersonSummaries(db)).find((p) => p.id === KEVIN)!;
		expect(kevin.total).toBe(items.length);
	});

	it('shows the parent as a wish again once its children are gone', async () => {
		const db = testDb();
		await syncFromTodoist(db, fakeSource(), { now: NOW });
		// Two children completed (gone from Todoist), one hidden, one re-labelled hidden.
		const edited = tasks
			.filter((t) => t.id !== 't-toolkit' && t.id !== 't-tire')
			.map((t) => (t.id === 't-jump' ? { ...t, labels: ['hidden'] } : t));
		await syncFromTodoist(db, fakeSource({ tasks: edited }), { now: NOW });
		const names = (await loadPersonItems(db, KEVIN)).map((i) => i.name);
		expect(names).toContain('Road Supplies');
		expect(names).not.toContain('Roadside tool kit');
	});
});

function view(partial: Partial<ItemView> & { id: number }): ItemView {
	return {
		personSlug: 'kevin',
		name: `Item ${partial.id}`,
		notes: '',
		productUrl: null,
		imageUrl: null,
		desire: 4,
		desireLabel: null,
		aboutPriceCents: null,
		qty: 1,
		occasion: 'any',
		categories: [],
		parentName: null,
		size: null,
		color: null,
		enrichedAt: null,
		createdAt: NOW,
		purchasedCount: 0,
		purchased: false,
		boughtInTodoist: false,
		headlinePriceCents: null,
		headlineIsEstimate: false,
		bestOffer: null,
		offers: [],
		...partial
	};
}

describe('groupByCategory', () => {
	it('is null (flat list) when no category holds two items', () => {
		expect(groupByCategory([])).toBeNull();
		expect(
			groupByCategory([
				view({ id: 1, categories: ['books'] }),
				view({ id: 2, categories: ['toys'] }),
				view({ id: 3 })
			])
		).toBeNull();
	});

	it('makes one section per category with 2+ items, biggest first, then everything else', () => {
		const items = [
			view({ id: 1, categories: ['books'] }),
			view({ id: 2, categories: ['motorcycle'], purchased: true }),
			view({ id: 3 }),
			view({ id: 4, categories: ['Road Supplies'] }),
			view({ id: 5, categories: ['motorcycle'] }),
			view({ id: 6, categories: ['Road Supplies'] }),
			view({ id: 7, categories: ['motorcycle', 'books'] }),
			view({ id: 8, categories: ['Road Supplies'] })
		];
		const groups = groupByCategory(items)!;
		// Equal sizes tie-break alphabetically, case-insensitively.
		expect(groups.map((g) => g.key)).toEqual(['motorcycle', 'Road Supplies', null]);
		expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([
			[2, 5, 7],
			[4, 6, 8],
			[1, 3]
		]);
		// "N available" counts unpurchased items in the section; list order is kept.
		expect(groups.map((g) => g.available)).toEqual([2, 3, 2]);
	});
});

describe('enrichment manifest and pending list', () => {
	it('publishes categories in use per person, built from labels only', async () => {
		const db = testDb();
		await syncFromTodoist(db, fakeSource(), { now: NOW });
		const m = buildManifest(await loadCategoriesInUse(db));
		expect(m.version).toBe(1);
		expect(m.control_labels).toEqual(['bought', 'hidden']);
		expect(m.categories).toMatchObject({
			enabled: true,
			max_new_per_run: 2,
			min_items_for_new: 2,
			max_uncategorized_per_list: 20
		});
		expect(m.categories.in_use).toEqual([
			{ person: 'kevin', label: 'motorcycle', count: 3 },
			{ person: 'robbie', label: 'books', count: 1 },
			{ person: 'robbie', label: 'clothes', count: 1 },
			{ person: 'robbie', label: 'toys', count: 1 }
		]);
		// The inherited "Road Supplies" is a parent name, not a label.
		expect(m.categories.in_use.map((c) => c.label)).not.toContain('Road Supplies');
	});

	it('lists pending items with their labels and parent name, never a parent task', async () => {
		const db = testDb();
		await syncFromTodoist(db, fakeSource(), { now: NOW });
		const pending = await loadPendingItems(db);
		const names = pending.map((p) => p.name);
		expect(names).not.toContain('Road Supplies');
		expect(names).not.toContain('Profile: Logan');
		expect(names).not.toContain('Dog Man: Big Jim Begins'); // @bought
		const toolkit = pending.find((p) => p.name === 'Roadside tool kit')!;
		expect(toolkit).toMatchObject({
			todoist_task_id: 't-toolkit',
			person: 'kevin',
			categories: [],
			parent_name: 'Road Supplies'
		});
		const bags = pending.find((p) => p.name === 'Saddlebags')!;
		expect(bags.categories).toEqual(['motorcycle']);
		expect(bags.parent_name).toBeNull();
	});
});
