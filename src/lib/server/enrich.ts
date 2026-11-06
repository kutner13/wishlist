// What the daily Claude enrichment routine reads: the manifest (built from config plus live
// category counts) and the pending list. The markdown instructions are in docs/routines/.
import {
	ENRICH_MAX_ITEMS_PER_RUN,
	ENRICH_MAX_NEW_CATEGORIES_PER_RUN,
	ENRICH_MAX_UNCATEGORIZED_PER_LIST,
	ENRICH_MIN_ITEMS_FOR_NEW_CATEGORY,
	ENRICH_MIN_TASK_AGE_MINUTES,
	HINT_KEYS,
	LABEL_BOUGHT,
	LABEL_HIDDEN,
	MAX_OFFERS,
	PEOPLE
} from '#lib/config';
import type { Db } from './db';
import { parseCategories, WISH_WHERE } from './queries';

export interface CategoryInUse {
	person: string;
	label: string;
	count: number;
}

/** Todoist labels (not inherited parent names) on each person's visible items, most used first. */
export async function loadCategoriesInUse(db: Db): Promise<CategoryInUse[]> {
	const rows = await db.all<{ person: string; categories: string }>(
		`SELECT p.slug AS person, i.categories FROM items i JOIN people p ON p.id = i.person_id
		 WHERE ${WISH_WHERE}`
	);
	const counts = new Map<string, CategoryInUse>();
	for (const r of rows) {
		for (const label of new Set(parseCategories(r.categories))) {
			const key = `${r.person}\0${label}`;
			const c = counts.get(key) ?? { person: r.person, label, count: 0 };
			c.count++;
			counts.set(key, c);
		}
	}
	const order = new Map(PEOPLE.map((p, i) => [p.slug, i]));
	return [...counts.values()].sort(
		(a, b) =>
			(order.get(a.person) ?? 99) - (order.get(b.person) ?? 99) ||
			b.count - a.count ||
			a.label.localeCompare(b.label)
	);
}

/** Machine-readable contract for the routine. Version 1; new fields are only ever added. */
export function buildManifest(inUse: CategoryInUse[]) {
	return {
		version: 1,
		instructions_url: '/api/enrich/instructions',
		pending_url: '/api/enrich/pending',
		offers_url: '/api/offers',
		max_items_per_run: ENRICH_MAX_ITEMS_PER_RUN,
		min_task_age_minutes: ENRICH_MIN_TASK_AGE_MINUTES,
		hints: [...HINT_KEYS],
		people: PEOPLE.map((p) => ({
			slug: p.slug,
			name: p.name,
			todoist_section_aliases: p.aliases.flatMap((a) => [a, `${a} wishlist`])
		})),
		control_labels: [LABEL_BOUGHT, LABEL_HIDDEN],
		max_offers: MAX_OFFERS,
		categories: {
			enabled: true,
			max_new_per_run: ENRICH_MAX_NEW_CATEGORIES_PER_RUN,
			min_items_for_new: ENRICH_MIN_ITEMS_FOR_NEW_CATEGORY,
			max_uncategorized_per_list: ENRICH_MAX_UNCATEGORIZED_PER_LIST,
			in_use: inUse
		}
	};
}

export interface PendingItem {
	id: number;
	todoist_task_id: string;
	person: string;
	name: string;
	notes: string;
	product_url: string | null;
	/** Todoist labels on the task (control labels excluded). */
	categories: string[];
	/** Name of the parent task when this is a subtask; such items are not labelled. */
	parent_name: string | null;
	created_at: string;
}

/** Items the routine should look at: no product link yet, or never enriched. */
export async function loadPendingItems(db: Db): Promise<PendingItem[]> {
	const rows = await db.all<Omit<PendingItem, 'categories'> & { categories: string }>(
		`SELECT i.id, i.todoist_task_id, p.slug AS person, i.name, i.notes, i.product_url, i.categories,
		   (SELECT x.name FROM items x WHERE x.todoist_task_id = i.parent_todoist_task_id) AS parent_name,
		   i.created_at
		 FROM items i JOIN people p ON p.id = i.person_id
		 WHERE ${WISH_WHERE} AND i.bought_in_todoist = 0
		   AND (i.product_url IS NULL OR i.enriched_at IS NULL)
		 ORDER BY i.created_at DESC, i.id DESC`
	);
	return rows.map((r) => ({ ...r, categories: parseCategories(r.categories) }));
}
