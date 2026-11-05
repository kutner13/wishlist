import { updatedPhrase } from '#lib/format';
import { db } from '#lib/server/env';
import { getSetting, lastItemAddedAt, loadPersonSummaries } from '#lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const d = db();
	const [people, banner, lastAddedAt] = await Promise.all([
		loadPersonSummaries(d),
		getSetting(d, 'season_banner'),
		lastItemAddedAt(d)
	]);
	return {
		people,
		banner,
		lastAddedAt,
		// Rendered on the server; the page refreshes it each minute (see +page.svelte).
		lastUpdated: updatedPhrase(lastAddedAt)
	};
};
