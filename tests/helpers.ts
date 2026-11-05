import { readdirSync } from 'node:fs';
import { applyMigrations, sqliteDb } from '../src/lib/server/sqlite-db';

const MIGRATIONS_DIR = new URL('../migrations', import.meta.url).pathname;

/** Fresh in-memory database with all migrations applied. */
export function testDb() {
	const db = sqliteDb(':memory:');
	applyMigrations(
		db,
		MIGRATIONS_DIR,
		readdirSync(MIGRATIONS_DIR)
			.filter((f) => f.endsWith('.sql'))
			.sort()
	);
	return db;
}

export async function insertItem(
	db: ReturnType<typeof testDb>,
	fields: Partial<{
		person_id: number;
		todoist_task_id: string;
		name: string;
		qty: number;
		bought_in_todoist: number;
		product_url: string | null;
		image_key: string | null;
		desire: number;
		about_price_cents: number | null;
		hidden: number;
	}> = {}
) {
	const now = '2026-11-01T00:00:00.000Z';
	const f = {
		person_id: 3,
		todoist_task_id: `t-${Math.random().toString(36).slice(2, 8)}`,
		name: 'Thing',
		qty: 1,
		bought_in_todoist: 0,
		product_url: null,
		image_key: null,
		desire: 4,
		about_price_cents: null,
		hidden: 0,
		...fields
	};
	const r = await db.run(
		`INSERT INTO items (person_id, todoist_task_id, name, qty, bought_in_todoist, product_url, image_key, desire, about_price_cents, hidden, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		f.person_id,
		f.todoist_task_id,
		f.name,
		f.qty,
		f.bought_in_todoist,
		f.product_url,
		f.image_key,
		f.desire,
		f.about_price_cents,
		f.hidden,
		now,
		now
	);
	return r.lastRowId;
}
