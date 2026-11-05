import { json } from '@sveltejs/kit';
import { runPageRefresh } from '#lib/server/jobs';
import type { RequestHandler } from './$types';

/** Owner-only: re-fetch every product page for images and prices. */
export const POST: RequestHandler = async () => json(await runPageRefresh(undefined, true));
