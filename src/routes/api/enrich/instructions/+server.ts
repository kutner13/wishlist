import { requireOffersKey } from '#lib/server/api-auth';
import instructions from '../../../../../docs/routines/ENRICHMENT-ROUTINE.md?raw';
import type { RequestHandler } from './$types';

/** The routine's instructions, straight from docs/routines/ENRICHMENT-ROUTINE.md (bundled at build time). */
export const GET: RequestHandler = async ({ request }) => {
	requireOffersKey(request);
	return new Response(instructions, {
		headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' }
	});
};
