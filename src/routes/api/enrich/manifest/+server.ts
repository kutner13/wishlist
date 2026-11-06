import { json } from '@sveltejs/kit';
import { requireOffersKey } from '#lib/server/api-auth';
import { buildManifest, loadCategoriesInUse } from '#lib/server/enrich';
import { db } from '#lib/server/env';
import type { RequestHandler } from './$types';

/** Machine-readable contract for the Claude enrichment routine, built from the app's own config. */
export const GET: RequestHandler = async ({ request }) => {
	requireOffersKey(request);
	return json(buildManifest(await loadCategoriesInUse(db())));
};
