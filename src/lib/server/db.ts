// Tiny typed query helper. Business logic takes a `Db` so it runs on Cloudflare D1 in
// production and on better-sqlite3 in unit tests and the seed script.

export interface RunResult {
	changes: number;
	lastRowId: number;
}

export interface Db {
	all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]>;
	first<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | null>;
	run(sql: string, ...params: unknown[]): Promise<RunResult>;
}

export function d1Db(d1: D1Database): Db {
	return {
		async all<T>(sql: string, ...params: unknown[]) {
			const res = await d1
				.prepare(sql)
				.bind(...params)
				.all<T>();
			return res.results;
		},
		async first<T>(sql: string, ...params: unknown[]) {
			const row = await d1
				.prepare(sql)
				.bind(...params)
				.first<T>();
			return row ?? null;
		},
		async run(sql: string, ...params: unknown[]) {
			const res = await d1
				.prepare(sql)
				.bind(...params)
				.run();
			return { changes: res.meta.changes ?? 0, lastRowId: res.meta.last_row_id ?? 0 };
		}
	};
}

export function nowIso(): string {
	return new Date().toISOString();
}
