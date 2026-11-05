import { error } from '@sveltejs/kit';
import { PRICE_BANDS } from '#lib/config';
import { personBySlug } from '#lib/people';
import { db } from '#lib/server/env';
import { applyFilters, loadPersonItems, parseFilters } from '#lib/server/queries';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, url }) => {
	const person = personBySlug(params.person);
	if (!person) error(404, 'No such person');
	const all = await loadPersonItems(db(), person.id);
	const filters = parseFilters(url.searchParams);
	const items = applyFilters(all, filters);
	const categories = [...new Set(all.flatMap((i) => i.categories))].sort();
	const occasions = [...new Set(all.map((i) => i.occasion).filter((o) => o !== 'any'))].sort();
	return {
		person: { id: person.id, name: person.name, slug: person.slug },
		items,
		total: all.length,
		available: all.filter((i) => !i.purchased).length,
		filters,
		categories,
		occasions,
		bands: PRICE_BANDS.map((b) => ({ key: b.key, label: b.label })),
		search: url.search
	};
};
