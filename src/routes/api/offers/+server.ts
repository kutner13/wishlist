import { json } from '@sveltejs/kit';
import { requireOffersKey } from '#lib/server/api-auth';
import { db } from '#lib/server/env';
import { replaceClaudeOffers, type IncomingOffer } from '#lib/server/offers';
import type { RequestHandler } from './$types';

interface Body {
	items?: { todoist_task_id?: string; item_id?: number; offers?: IncomingOffer[] }[];
}

/**
 * Claude price routine: replaces each item's `claude` offers.
 * Body: { items: [{ todoist_task_id | item_id, offers: [{ store, price_cents, currency, url, note }] }] }
 */
export const POST: RequestHandler = async ({ request }) => {
	requireOffersKey(request);
	let body: Body;
	try {
		body = (await request.json()) as Body;
	} catch {
		return json({ ok: false, error: 'invalid JSON' }, { status: 400 });
	}
	if (!Array.isArray(body.items))
		return json({ ok: false, error: 'items[] required' }, { status: 400 });
	const d = db();
	const results: {
		item_id: number | null;
		todoist_task_id?: string;
		ok: boolean;
		offers: number;
		error?: string;
	}[] = [];
	for (const entry of body.items.slice(0, 200)) {
		const row = entry.item_id
			? await d.first<{ id: number }>('SELECT id FROM items WHERE id = ?', entry.item_id)
			: entry.todoist_task_id
				? await d.first<{ id: number }>(
						'SELECT id FROM items WHERE todoist_task_id = ?',
						entry.todoist_task_id
					)
				: null;
		if (!row) {
			results.push({
				item_id: entry.item_id ?? null,
				todoist_task_id: entry.todoist_task_id,
				ok: false,
				offers: 0,
				error: 'item not found'
			});
			continue;
		}
		const offers = Array.isArray(entry.offers) ? entry.offers : [];
		await replaceClaudeOffers(d, row.id, offers);
		results.push({
			item_id: row.id,
			todoist_task_id: entry.todoist_task_id,
			ok: true,
			offers: offers.length
		});
	}
	return json({ ok: true, results });
};
