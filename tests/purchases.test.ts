import { describe, expect, it } from 'vitest';
import {
	archiveSeason,
	markPurchased,
	purchaseState,
	undoPurchase
} from '../src/lib/server/purchases';
import { loadItem, loadItemRow } from '../src/lib/server/queries';
import type { OutboxRow } from '../src/lib/types';
import { insertItem, testDb } from './helpers';

async function outbox(db: ReturnType<typeof testDb>, itemId: number) {
	return db.all<OutboxRow>('SELECT * FROM todoist_outbox WHERE item_id = ? ORDER BY id', itemId);
}

describe('mark purchased / undo', () => {
	it('one tap marks, enqueues label + comment, and shows purchased', async () => {
		const db = testDb();
		const id = await insertItem(db, { name: 'Dog Man' });
		const row = (await loadItemRow(db, id))!;
		const r = await markPurchased(db, row, 'dev-A');
		expect(r.ok).toBe(true);
		expect(r.state.purchased).toBe(true);
		const ob = await outbox(db, id);
		expect(ob.map((o) => o.action)).toEqual(['add_label', 'comment']);
		expect(JSON.parse(ob[1].payload).content).toBe('Marked purchased on the wishlist');
		const view = (await loadItem(db, id))!;
		expect(view.purchased).toBe(true);
		expect(view.purchasedCount).toBe(1);

		// Second tap from anyone is a no-op.
		const again = await markPurchased(db, row, 'dev-B');
		expect(again.ok).toBe(false);
		expect(!again.ok && again.reason).toBe('already_purchased');
		expect(await outbox(db, id)).toHaveLength(2);
	});

	it('same device undoes silently; other device needs confirm', async () => {
		const db = testDb();
		const id = await insertItem(db);
		const row = (await loadItemRow(db, id))!;
		await markPurchased(db, row, 'dev-A');

		const other = await undoPurchase(db, row, 'dev-B', false);
		expect(other.ok).toBe(false);
		expect(!other.ok && other.reason).toBe('needs_confirm');
		expect((await purchaseState(db, row)).purchasedCount).toBe(1);

		const confirmed = await undoPurchase(db, row, 'dev-B', true);
		expect(confirmed.ok).toBe(true);
		expect(confirmed.state.purchased).toBe(false);
		const ob = await outbox(db, id);
		expect(ob.map((o) => o.action)).toEqual(['add_label', 'comment', 'remove_label', 'comment']);

		// Nothing left to undo.
		const none = await undoPurchase(db, row, 'dev-A', true);
		expect(none.ok).toBe(false);
	});

	it('own device undo needs no confirm', async () => {
		const db = testDb();
		const id = await insertItem(db);
		const row = (await loadItemRow(db, id))!;
		await markPurchased(db, row, 'dev-A');
		const r = await undoPurchase(db, row, 'dev-A', false);
		expect(r.ok).toBe(true);
	});

	it('qty 2: label only when both are taken; undo releases the newest mark', async () => {
		const db = testDb();
		const id = await insertItem(db, { name: 'Towel', qty: 2 });
		const row = (await loadItemRow(db, id))!;

		const first = await markPurchased(db, row, 'dev-A', '2026-11-01T00:00:00Z');
		expect(first.ok && first.state.purchasedCount).toBe(1);
		expect(first.state.purchased).toBe(false);
		let ob = await outbox(db, id);
		expect(ob.map((o) => o.action)).toEqual(['comment']);
		expect(JSON.parse(ob[0].payload).content).toContain('(1 of 2)');
		let view = (await loadItem(db, id))!;
		expect(view.purchased).toBe(false);
		expect(view.purchasedCount).toBe(1);

		const second = await markPurchased(db, row, 'dev-B', '2026-11-02T00:00:00Z');
		expect(second.state.purchased).toBe(true);
		ob = await outbox(db, id);
		expect(ob.map((o) => o.action)).toEqual(['comment', 'add_label', 'comment']);

		const third = await markPurchased(db, row, 'dev-C');
		expect(third.ok).toBe(false);

		// dev-A undoing: its own mark is released even though it is older; label comes off.
		const undo = await undoPurchase(db, row, 'dev-A', false);
		expect(undo.ok).toBe(true);
		expect(undo.state.purchasedCount).toBe(1);
		expect(undo.state.purchased).toBe(false);
		ob = await outbox(db, id);
		expect(ob.map((o) => o.action).slice(3)).toEqual(['remove_label', 'comment']);
		view = (await loadItem(db, id))!;
		expect(view.purchasedCount).toBe(1);

		// A stranger undoing the remaining (dev-B) mark needs a confirm; most recent mark goes.
		const stranger = await undoPurchase(db, row, 'dev-Z', true);
		expect(stranger.ok).toBe(true);
		expect(stranger.state.purchasedCount).toBe(0);
		ob = await outbox(db, id);
		// Was not complete any more, so only a comment this time.
		expect(ob.map((o) => o.action).slice(5)).toEqual(['comment']);
	});

	it('an item labelled @bought by the owner counts as purchased with no purchases', async () => {
		const db = testDb();
		const id = await insertItem(db, { bought_in_todoist: 1 });
		const view = (await loadItem(db, id))!;
		expect(view.purchased).toBe(true);
		expect(view.purchasedCount).toBe(0);
		// A guest can still not "mark" it twice in a way that enqueues a label.
		const row = (await loadItemRow(db, id))!;
		const r = await markPurchased(db, row, 'dev-A');
		expect(r.ok).toBe(true);
		expect((await outbox(db, id)).map((o) => o.action)).toEqual(['comment']);
	});

	it('archiveSeason releases everything and queues label removals, keeping items', async () => {
		const db = testDb();
		const a = await insertItem(db, { name: 'A' });
		const b = await insertItem(db, { name: 'B', bought_in_todoist: 1 });
		const c = await insertItem(db, { name: 'C' });
		await markPurchased(db, (await loadItemRow(db, a))!, 'dev');
		const n = await archiveSeason(db, '2026-12-26T00:00:00Z');
		expect(n).toBe(2);
		expect((await loadItem(db, a))!.purchased).toBe(false);
		expect((await loadItem(db, b))!.purchased).toBe(false);
		expect((await loadItem(db, c))!.purchased).toBe(false);
		expect(await db.first('SELECT * FROM purchases WHERE released_at IS NULL')).toBeNull();
		const bOb = await outbox(db, b);
		expect(bOb.map((o) => o.action)).toEqual(['remove_label', 'comment']);
		const items = await db.all('SELECT id FROM items WHERE removed_at IS NULL');
		expect(items).toHaveLength(3);
		const s = await db.first<{ value: string }>(
			"SELECT value FROM settings WHERE key = 'last_archive_at'"
		);
		expect(s!.value).toBe('2026-12-26T00:00:00Z');
	});
});
