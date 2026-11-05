import { describe, expect, it } from 'vitest';
import { lastItemAddedAt } from '../src/lib/server/queries';
import { insertItem, testDb } from './helpers';

describe('lastItemAddedAt', () => {
	it('is null when nothing is on the site', async () => {
		expect(await lastItemAddedAt(testDb())).toBeNull();
	});

	it('is the newest Todoist added_at among items still shown', async () => {
		const db = testDb();
		const setAdded = (id: number, at: string) =>
			db.run('UPDATE items SET created_at = ? WHERE id = ?', at, id);

		await setAdded(await insertItem(db, { name: 'Sixers Hoody' }), '2026-10-02T00:44:16.960456Z');
		await setAdded(await insertItem(db, { name: 'Ear plugs' }), '2026-11-03T16:38:04.634606Z');
		// Newer, but not shown: a hidden Profile task and a completed (removed) task.
		await setAdded(
			await insertItem(db, { name: 'Profile: Kevin', hidden: 1 }),
			'2026-11-04T12:00:00.000Z'
		);
		const done = await insertItem(db, { name: 'Done thing' });
		await setAdded(done, '2026-11-04T13:00:00.000Z');
		await db.run("UPDATE items SET removed_at = '2026-11-04T14:00:00.000Z' WHERE id = ?", done);

		expect(await lastItemAddedAt(db)).toBe('2026-11-03T16:38:04.634606Z');
	});
});
