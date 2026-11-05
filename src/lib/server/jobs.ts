// The scheduled/manual jobs: Todoist sync, outbox drain, page refresh. Each records a
// sync_runs row and never throws, so a cron tick or admin click always finishes.
import type { Db } from './db';
import { db as getDb, images, todoist, secret } from './env';
import { httpPageFetcher, refreshPages } from './offers';
import { drainOutbox } from './outbox';
import { startRun, syncFromTodoist } from './sync';

export async function runTodoistSync(db: Db = getDb()) {
	const run = await startRun(db, 'todoist');
	const client = todoist();
	if (!client) {
		await run.finish(false, 'TODOIST_TOKEN is not set');
		return { ok: false, error: 'TODOIST_TOKEN is not set' };
	}
	try {
		const summary = await syncFromTodoist(db, client, {
			projectId: secret('TODOIST_PROJECT_ID') || null
		});
		await run.finish(true, null, summary);
		return { ok: true, summary };
	} catch (e) {
		const msg = (e as Error).message ?? String(e);
		await run.finish(false, msg);
		return { ok: false, error: msg };
	}
}

export async function runOutboxDrain(db: Db = getDb()) {
	const client = todoist();
	if (!client) return { done: 0, failed: 0 };
	return drainOutbox(db, client);
}

export async function runPageRefresh(db: Db = getDb(), force = false) {
	const run = await startRun(db, 'pages');
	try {
		const summary = await refreshPages(db, httpPageFetcher(), images(), { force });
		const ok = summary.errors.length === 0;
		await run.finish(ok, ok ? null : summary.errors.slice(0, 5).join('; '), summary);
		return { ok, summary };
	} catch (e) {
		const msg = (e as Error).message ?? String(e);
		await run.finish(false, msg);
		return { ok: false, error: msg };
	}
}

/** Sync, then drain the outbox, then (optionally) refresh pages. Used by cron, webhook and admin. */
export async function runFullSync(opts: { pages?: boolean } = {}) {
	const db = getDb();
	const sync = await runTodoistSync(db);
	const drain = await runOutboxDrain(db);
	const pages = opts.pages === false ? null : await runPageRefresh(db);
	return { sync, drain, pages };
}
