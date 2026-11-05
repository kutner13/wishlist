// Maps Todoist sections to the four people (SPEC §3). Pure.
import { PEOPLE, type PersonConfig } from './config';

/** Normalises "Kev Wishlist", " kevin ", "Kevin's list" -> the alias to compare. */
function normaliseSectionName(name: string): string {
	return name
		.toLowerCase()
		.replace(/['’]s\b/g, '')
		.replace(/\b(wish\s*list|wishlist|list|gifts?)\b/g, '')
		.replace(/[^a-z]/g, '');
}

export function matchSectionToPerson(sectionName: string): PersonConfig | null {
	const key = normaliseSectionName(sectionName);
	if (!key) return null;
	for (const person of PEOPLE) {
		if (person.aliases.some((a) => a.replace(/[^a-z]/g, '') === key)) return person;
	}
	return null;
}

export interface SectionLike {
	id: string;
	name: string;
}

/** Returns a map of section id -> person for the sections that belong to a family member. */
export function mapSections(sections: SectionLike[]): Map<string, PersonConfig> {
	const out = new Map<string, PersonConfig>();
	const taken = new Set<number>();
	for (const s of sections) {
		const person = matchSectionToPerson(s.name);
		// First matching section wins so a stray duplicate can't split a list.
		if (person && !taken.has(person.id)) {
			out.set(s.id, person);
			taken.add(person.id);
		}
	}
	return out;
}

export function personBySlug(slug: string): PersonConfig | undefined {
	return PEOPLE.find((p) => p.slug === slug);
}
