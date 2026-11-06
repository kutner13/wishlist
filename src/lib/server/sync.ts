// Todoist -> site sync (SPEC §4). Upserts tasks by Todoist id, soft-deletes missing ones,
// mirrors @bought/@hidden, and turns extra description URLs into manual offers.
// Subtasks keep their parent's id; whether a parent is shown (no active children) and what
// category a child inherits are decided at read time in queries.ts, so they stay right when
// children are completed or deleted.
import { PEOPLE, TODOIST_PROJECT_NAME } from '#lib/config';
import { hostnameOf, parseTask, productKey } from '#lib/parse';
import { mapSections } from '#lib/people';
import type { Db } from './db';
import { recomputeBest } from './offers';
import type { TodoistSource } from './todoist';

export interface SyncSummary {
	projectId: string;
	sectionsMatched: number;
	tasksSeen: number;
	upserted: number;
	removed: number;
}

export class SyncError extends Error {}

/**
 * Runs one Todoist -> site sync. Throws on a hard failure (no project, API down);
 * the caller records the sync_run row either way via `recordRun`.
 */
export async function syncFromTodoist(
	db: Db,
	todoist: TodoistSource,
	opts: { projectId?: string | null; now?: string } = {}
): Promise<SyncSummary> {
	const now = opts.now ?? new Date().toISOString();
	const projectId = opts.projectId || (await todoist.findProjectIdByName(TODOIST_PROJECT_NAME));
	if (!projectId) throw new SyncError(`Todoist project "${TODOIST_PROJECT_NAME}" not found`);

	const sections = await todoist.listSections(projectId);
	const sectionMap = mapSections(sections);
	for (const [sectionId, person] of sectionMap) {
		await db.run('UPDATE people SET todoist_section_id = ? WHERE id = ?', sectionId, person.id);
	}
	for (const person of PEOPLE) {
		if (![...sectionMap.values()].some((p) => p.id === person.id)) {
			await db.run('UPDATE people SET todoist_section_id = NULL WHERE id = ?', person.id);
		}
	}

	const tasks = await todoist.listTasks(projectId);
	const seen = new Set<string>();
	let upserted = 0;
	for (const task of tasks) {
		if (task.checked) continue;
		const person = task.section_id ? sectionMap.get(task.section_id) : undefined;
		if (!person) continue;
		const parsed = parseTask(task);
		if (!parsed.name) continue;
		seen.add(task.id);
		upserted++;
		const existing = await db.first<{ id: number; product_url: string | null }>(
			'SELECT id, product_url FROM items WHERE todoist_task_id = ?',
			task.id
		);
		const fields = [
			person.id,
			parsed.name,
			parsed.notes,
			parsed.productUrl,
			parsed.desire,
			parsed.aboutPriceCents,
			parsed.qty,
			parsed.occasion,
			JSON.stringify(parsed.categories),
			parsed.size,
			parsed.color,
			parsed.enrichedAt,
			parsed.hidden ? 1 : 0,
			parsed.boughtInTodoist ? 1 : 0,
			task.parent_id || null,
			now
		];
		let itemId: number;
		if (existing) {
			itemId = existing.id;
			await db.run(
				`UPDATE items SET person_id = ?, name = ?, notes = ?, product_url = ?, desire = ?,
				 about_price_cents = ?, qty = ?, occasion = ?, categories = ?, size = ?, color = ?,
				 enriched_at = ?, hidden = ?, bought_in_todoist = ?, parent_todoist_task_id = ?,
				 updated_at = ?, removed_at = NULL
				 WHERE id = ?`,
				...fields,
				itemId
			);
			if (!sameProduct(existing.product_url, parsed.productUrl)) {
				// The link points somewhere else: the old page's price is stale, and the new page
				// must be fetched on this run rather than when the last check ages out.
				await db.run("DELETE FROM offers WHERE item_id = ? AND source = 'page'", itemId);
				await db.run('UPDATE items SET page_checked_at = NULL WHERE id = ?', itemId);
				await recomputeBest(db, itemId);
			}
		} else {
			const r = await db.run(
				`INSERT INTO items (person_id, name, notes, product_url, desire, about_price_cents, qty,
				 occasion, categories, size, color, enriched_at, hidden, bought_in_todoist,
				 parent_todoist_task_id, updated_at, todoist_task_id, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				...fields,
				task.id,
				task.added_at ?? now
			);
			itemId = r.lastRowId;
		}
		await syncManualOffers(db, itemId, parsed.extraUrls, now);
	}

	// Anything active in the DB that Todoist no longer lists (completed, deleted, moved out) is removed.
	const active = await db.all<{ id: number; todoist_task_id: string }>(
		'SELECT id, todoist_task_id FROM items WHERE removed_at IS NULL'
	);
	let removed = 0;
	for (const row of active) {
		if (!seen.has(row.todoist_task_id)) {
			await db.run(
				'UPDATE items SET removed_at = ?, updated_at = ? WHERE id = ?',
				now,
				now,
				row.id
			);
			removed++;
		}
	}

	return {
		projectId,
		sectionsMatched: sectionMap.size,
		tasksSeen: tasks.length,
		upserted,
		removed
	};
}

/** Same product link, tracking codes aside (null equals only null). */
function sameProduct(a: string | null, b: string | null): boolean {
	if (a === null || b === null) return a === b;
	return productKey(a) === productKey(b);
}

/** Replaces the item's manual offers with one per extra URL (store = hostname). */
async function syncManualOffers(db: Db, itemId: number, urls: string[], now: string) {
	const current = await db.all<{ id: number; url: string | null }>(
		"SELECT id, url FROM offers WHERE item_id = ? AND source = 'manual'",
		itemId
	);
	const wanted = new Set(urls);
	let changed = false;
	for (const o of current) {
		if (!o.url || !wanted.has(o.url)) {
			await db.run('DELETE FROM offers WHERE id = ?', o.id);
			changed = true;
		}
	}
	for (const url of urls) {
		if (!current.some((o) => o.url === url)) {
			await db.run(
				`INSERT INTO offers (item_id, source, store, price_cents, currency, url, fetched_at)
				 VALUES (?, 'manual', ?, NULL, 'USD', ?, ?)`,
				itemId,
				hostnameOf(url),
				url,
				now
			);
			changed = true;
		}
	}
	if (changed) await recomputeBest(db, itemId);
}

/** Inserts a sync_runs row and returns a finisher. */
export async function startRun(db: Db, kind: string, now = new Date().toISOString()) {
	const r = await db.run('INSERT INTO sync_runs (kind, started_at) VALUES (?, ?)', kind, now);
	const id = r.lastRowId;
	return {
		id,
		async finish(ok: boolean, error: string | null, detail?: unknown) {
			await db.run(
				'UPDATE sync_runs SET finished_at = ?, ok = ?, error = ?, detail = ? WHERE id = ?',
				new Date().toISOString(),
				ok ? 1 : 0,
				error,
				detail === undefined ? null : JSON.stringify(detail),
				id
			);
		}
	};
}
