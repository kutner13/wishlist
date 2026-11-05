import { json } from '@sveltejs/kit';
import { runFullSync } from '#lib/server/jobs';
import type { RequestHandler } from './$types';

/** Owner-only (Cloudflare Access): Todoist sync + outbox drain + page refresh, synchronously. */
export const POST: RequestHandler = async () => json(await runFullSync({ pages: true }));
