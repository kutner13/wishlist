import { json } from '@sveltejs/kit';
import { requireOffersKey } from '#lib/server/api-auth';
import { db } from '#lib/server/env';
import type { RequestHandler } from './$types';

/** Items the enrichment routine should look at: no product link yet, or never enriched. */
export const GET: RequestHandler = async ({ request }) => {
	requireOffersKey(request);
	const rows = await db().all<{
		id: number;
		todoist_task_id: string;
		person: string;
		name: string;
		notes: string;
		product_url: string | null;
		created_at: string;
	}>(
		`SELECT i.id, i.todoist_task_id, p.slug AS person, i.name, i.notes, i.product_url, i.created_at
		 FROM items i JOIN people p ON p.id = i.person_id
		 WHERE i.removed_at IS NULL AND i.hidden = 0 AND i.bought_in_todoist = 0
		   AND (i.product_url IS NULL OR i.enriched_at IS NULL)
		 ORDER BY i.created_at DESC, i.id DESC`
	);
	return json({ items: rows });
};
