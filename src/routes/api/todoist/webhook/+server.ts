import { json } from '@sveltejs/kit';
import { background, secret } from '#lib/server/env';
import { runFullSync } from '#lib/server/jobs';
import { verifyTodoistSignature } from '#lib/server/webhook';
import type { RequestHandler } from './$types';

/** Todoist webhook: verify the HMAC, answer 200 immediately, sync in the background. */
export const POST: RequestHandler = async ({ request }) => {
	const raw = await request.arrayBuffer();
	const ok = await verifyTodoistSignature(
		secret('TODOIST_WEBHOOK_SECRET'),
		raw,
		request.headers.get('X-Todoist-Hmac-SHA256')
	);
	if (!ok) return json({ ok: false, error: 'bad signature' }, { status: 401 });
	background(runFullSync({ pages: true }));
	return json({ ok: true });
};
