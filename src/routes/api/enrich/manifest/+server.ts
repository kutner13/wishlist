import { json } from '@sveltejs/kit';
import {
	ENRICH_MAX_ITEMS_PER_RUN,
	ENRICH_MIN_TASK_AGE_MINUTES,
	HINT_KEYS,
	LABEL_BOUGHT,
	LABEL_HIDDEN,
	MAX_OFFERS,
	PEOPLE
} from '#lib/config';
import { requireOffersKey } from '#lib/server/api-auth';
import type { RequestHandler } from './$types';

/** Machine-readable contract for the Claude enrichment routine, built from the app's own config. */
export const GET: RequestHandler = async ({ request }) => {
	requireOffersKey(request);
	return json({
		version: 1,
		instructions_url: '/api/enrich/instructions',
		pending_url: '/api/enrich/pending',
		offers_url: '/api/offers',
		max_items_per_run: ENRICH_MAX_ITEMS_PER_RUN,
		min_task_age_minutes: ENRICH_MIN_TASK_AGE_MINUTES,
		hints: [...HINT_KEYS],
		people: PEOPLE.map((p) => ({
			slug: p.slug,
			name: p.name,
			todoist_section_aliases: p.aliases.flatMap((a) => [a, `${a} wishlist`])
		})),
		control_labels: [LABEL_BOUGHT, LABEL_HIDDEN],
		max_offers: MAX_OFFERS
	});
};
