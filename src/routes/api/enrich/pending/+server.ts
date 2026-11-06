import { json } from '@sveltejs/kit';
import { requireOffersKey } from '#lib/server/api-auth';
import { loadPendingItems } from '#lib/server/enrich';
import { db } from '#lib/server/env';
import type { RequestHandler } from './$types';

/** Items the enrichment routine should look at: no product link yet, or never enriched. */
export const GET: RequestHandler = async ({ request }) => {
	requireOffersKey(request);
	return json({ items: await loadPendingItems(db()) });
};
