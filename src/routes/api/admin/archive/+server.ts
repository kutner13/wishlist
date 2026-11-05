import { json } from '@sveltejs/kit';
import { db } from '#lib/server/env';
import { runOutboxDrain } from '#lib/server/jobs';
import { archiveSeason } from '#lib/server/purchases';
import type { RequestHandler } from './$types';

/** Owner-only: clears purchases and queues @bought removals. Body must be {"confirm":"ARCHIVE"}. */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as { confirm?: string };
	if (body.confirm !== 'ARCHIVE')
		return json({ ok: false, error: 'confirm must be "ARCHIVE"' }, { status: 400 });
	const d = db();
	const items = await archiveSeason(d);
	const drain = await runOutboxDrain(d);
	return json({ ok: true, items, drain });
};
