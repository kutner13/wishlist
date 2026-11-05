import { dateTime } from '#lib/format';
import { db } from '#lib/server/env';
import { getSetting, lastItemAddedAt, loadPersonSummaries } from '#lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const d = db();
	const [people, banner, lastAdded] = await Promise.all([
		loadPersonSummaries(d),
		getSetting(d, 'season_banner'),
		lastItemAddedAt(d)
	]);
	return {
		people,
		banner,
		// Formatted here so the server-rendered and hydrated text are identical.
		lastUpdated: dateTime(lastAdded)
	};
};
