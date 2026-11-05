import { db } from '#lib/server/env';
import { getSetting, lastSync, loadPersonSummaries } from '#lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const d = db();
	const [people, banner, sync] = await Promise.all([
		loadPersonSummaries(d),
		getSetting(d, 'season_banner'),
		lastSync(d)
	]);
	return {
		people,
		banner,
		lastSyncAt: sync?.finished_at ?? sync?.started_at ?? null,
		lastSyncOk: sync ? sync.ok === 1 : null
	};
};
