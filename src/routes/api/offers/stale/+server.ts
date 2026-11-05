import { json } from '@sveltejs/kit';
import { requireOffersKey } from '#lib/server/api-auth';
import { db } from '#lib/server/env';
import type { RequestHandler } from './$types';

/** Items with no `claude` offer newer than ?days (default 7). Purchased/hidden/removed items excluded. */
export const GET: RequestHandler = async ({ request, url }) => {
	requireOffersKey(request);
	const days = Math.min(365, Math.max(0, Number(url.searchParams.get('days') ?? 7) || 7));
	const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
	const rows = await db().all<{
		id: number;
		todoist_task_id: string;
		person: string;
		name: string;
		product_url: string | null;
		notes: string;
		about_price_cents: number | null;
		last_claude_offer_at: string | null;
	}>(
		`SELECT i.id, i.todoist_task_id, p.slug AS person, i.name, i.product_url, i.notes, i.about_price_cents,
		   (SELECT MAX(fetched_at) FROM offers o WHERE o.item_id = i.id AND o.source = 'claude') AS last_claude_offer_at
		 FROM items i JOIN people p ON p.id = i.person_id
		 WHERE i.removed_at IS NULL AND i.hidden = 0 AND i.bought_in_todoist = 0
		   AND i.qty > (SELECT COUNT(*) FROM purchases pu WHERE pu.item_id = i.id AND pu.released_at IS NULL)
		   AND (last_claude_offer_at IS NULL OR last_claude_offer_at < ?)
		 ORDER BY i.desire, i.id`,
		cutoff
	);
	return json({ days, items: rows });
};
