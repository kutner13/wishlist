import { json } from '@sveltejs/kit';
import { db } from '#lib/server/env';
import { loadHealth } from '#lib/server/health';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const h = await loadHealth(db());
	const stale =
		!h.lastTodoistSync.at || Date.now() - Date.parse(h.lastTodoistSync.at) > 24 * 3_600_000;
	return json({ status: stale || h.outbox.failing > 0 ? 'degraded' : 'ok', ...h });
};
