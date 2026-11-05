// better-sqlite3 implementation of `Db` for unit tests and the local seed script.
// Not bundled into the Worker (only imported from tests/ and scripts/).
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import type { Db } from './db';

export function sqliteDb(filename = ':memory:'): Db & { raw: Database.Database } {
	const raw = new Database(filename);
	raw.pragma('foreign_keys = ON');
	return {
		raw,
		async all<T>(sql: string, ...params: unknown[]) {
			return raw.prepare(sql).all(...(params as never[])) as T[];
		},
		async first<T>(sql: string, ...params: unknown[]) {
			return (raw.prepare(sql).get(...(params as never[])) as T | undefined) ?? null;
		},
		async run(sql: string, ...params: unknown[]) {
			const r = raw.prepare(sql).run(...(params as never[]));
			return { changes: r.changes, lastRowId: Number(r.lastInsertRowid) };
		}
	};
}

export function applyMigrations(db: { raw: Database.Database }, dir: string, files: string[]) {
	for (const f of files) db.raw.exec(readFileSync(`${dir}/${f}`, 'utf8'));
}
