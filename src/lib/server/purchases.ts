// Mark purchased / undo / archive (SPEC §4, §12). Writes purchases rows and enqueues the
// matching Todoist writes; never calls Todoist directly.
import {
	OUTBOX_COMMENT_ARCHIVED,
	OUTBOX_COMMENT_PURCHASED,
	OUTBOX_COMMENT_UNDONE
} from '#lib/config';
import type { ItemRow, PurchaseRow } from '#lib/types';
import type { Db } from './db';
import { enqueue } from './outbox';

export interface PurchaseState {
	qty: number;
	purchasedCount: number;
	boughtInTodoist: boolean;
	/** Whether the item counts as purchased for guests. */
	purchased: boolean;
}

export async function activePurchases(db: Db, itemId: number): Promise<PurchaseRow[]> {
	return db.all<PurchaseRow>(
		'SELECT * FROM purchases WHERE item_id = ? AND released_at IS NULL ORDER BY created_at DESC, id DESC',
		itemId
	);
}

export async function purchaseState(db: Db, item: ItemRow): Promise<PurchaseState> {
	const rows = await activePurchases(db, item.id);
	const purchasedCount = rows.length;
	const boughtInTodoist = item.bought_in_todoist === 1;
	return {
		qty: item.qty,
		purchasedCount,
		boughtInTodoist,
		purchased: boughtInTodoist || purchasedCount >= item.qty
	};
}

export type MarkResult =
	| { ok: true; state: PurchaseState; purchaseId: number; enqueued: boolean }
	| { ok: false; reason: 'already_purchased' | 'removed'; state: PurchaseState };

/** One tap: adds a purchase. For qty N the Todoist label is added only when all N are taken. */
export async function markPurchased(
	db: Db,
	item: ItemRow,
	deviceToken: string,
	now = new Date().toISOString()
): Promise<MarkResult> {
	const before = await purchaseState(db, item);
	if (item.removed_at) return { ok: false, reason: 'removed', state: before };
	if (before.purchasedCount >= item.qty) {
		return { ok: false, reason: 'already_purchased', state: before };
	}
	const r = await db.run(
		'INSERT INTO purchases (item_id, device_token, created_at) VALUES (?, ?, ?)',
		item.id,
		deviceToken,
		now
	);
	const count = before.purchasedCount + 1;
	const complete = count >= item.qty;
	if (complete && !before.boughtInTodoist) await enqueue(db, item.id, 'add_label', {}, now);
	const suffix = item.qty > 1 ? ` (${count} of ${item.qty})` : '';
	await enqueue(db, item.id, 'comment', { content: OUTBOX_COMMENT_PURCHASED + suffix }, now);
	return {
		ok: true,
		purchaseId: r.lastRowId,
		enqueued: true,
		state: { ...before, purchasedCount: count, purchased: before.boughtInTodoist || complete }
	};
}

export type UndoResult =
	| { ok: true; state: PurchaseState }
	| { ok: false; reason: 'needs_confirm' | 'nothing_to_undo'; state: PurchaseState };

/**
 * Releases the most recent mark. A device that did not make that mark must pass
 * `confirmed = true` (the "Did someone buy this by mistake?" step).
 */
export async function undoPurchase(
	db: Db,
	item: ItemRow,
	deviceToken: string,
	confirmed: boolean,
	now = new Date().toISOString()
): Promise<UndoResult> {
	const rows = await activePurchases(db, item.id);
	const state = await purchaseState(db, item);
	if (rows.length === 0) return { ok: false, reason: 'nothing_to_undo', state };
	// Prefer undoing this device's own mark; otherwise the most recent one, with confirm.
	const own = rows.find((p) => p.device_token === deviceToken);
	const target = own ?? rows[0];
	if (!own && !confirmed) return { ok: false, reason: 'needs_confirm', state };

	await db.run('UPDATE purchases SET released_at = ? WHERE id = ?', now, target.id);
	const remaining = rows.length - 1;
	const wasComplete = rows.length >= item.qty;
	if (wasComplete) await enqueue(db, item.id, 'remove_label', {}, now);
	const suffix = item.qty > 1 ? ` (${remaining} of ${item.qty} remain marked)` : '';
	await enqueue(db, item.id, 'comment', { content: OUTBOX_COMMENT_UNDONE + suffix }, now);
	return {
		ok: true,
		state: {
			...state,
			purchasedCount: remaining,
			purchased: state.boughtInTodoist || remaining >= item.qty
		}
	};
}

/** Archive season: releases every purchase and strips @bought in Todoist. Items stay. */
export async function archiveSeason(db: Db, now = new Date().toISOString()): Promise<number> {
	const affected = await db.all<{ item_id: number }>(
		'SELECT DISTINCT item_id FROM purchases WHERE released_at IS NULL'
	);
	await db.run('UPDATE purchases SET released_at = ? WHERE released_at IS NULL', now);
	const labelled = await db.all<{ id: number }>(
		'SELECT id FROM items WHERE bought_in_todoist = 1 AND removed_at IS NULL'
	);
	const ids = new Set<number>([...affected.map((a) => a.item_id), ...labelled.map((l) => l.id)]);
	for (const id of ids) {
		await enqueue(db, id, 'remove_label', {}, now);
		await enqueue(db, id, 'comment', { content: OUTBOX_COMMENT_ARCHIVED }, now);
	}
	await db.run('UPDATE items SET bought_in_todoist = 0 WHERE bought_in_todoist = 1');
	await db.run(
		"INSERT INTO settings (key, value) VALUES ('last_archive_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
		now
	);
	return ids.size;
}
