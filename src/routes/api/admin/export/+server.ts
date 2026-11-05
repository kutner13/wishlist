import { db } from '#lib/server/env';
import { exportAll } from '#lib/server/health';
import type { RequestHandler } from './$types';

/** Full JSON export (all tables). Restore steps are in the README runbook. */
export const GET: RequestHandler = async () => {
	const data = await exportAll(db());
	const name = `wishlist-export-${new Date().toISOString().slice(0, 10)}.json`;
	return new Response(JSON.stringify(data, null, 1), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Disposition': `attachment; filename="${name}"`,
			'Cache-Control': 'no-store'
		}
	});
};
