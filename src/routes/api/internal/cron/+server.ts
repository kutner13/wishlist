import { json } from '@sveltejs/kit';
import { runFullSync, runPageRefresh } from '#lib/server/jobs';
import type { RequestHandler } from './$types';

/**
 * Called only by the Worker's `scheduled` handler (src/worker/index.ts), which is the
 * only code path that can set the x-wishlist-cron header: the wrapper rejects any
 * external request carrying it.
 */
export const POST: RequestHandler = async ({ request, url }) => {
	if (request.headers.get('x-wishlist-cron') !== '1') return json({ ok: false }, { status: 403 });
	const kind = url.searchParams.get('kind');
	if (kind === 'pages') return json(await runPageRefresh(undefined, true));
	return json(await runFullSync({ pages: true }));
};
