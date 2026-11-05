// Fixed facts about the family and the Todoist mapping. Everything a maintainer
// might want to tweak about names/labels lives here.

export interface PersonConfig {
	/** Matches people.id and people.sort_order in the database. */
	id: number;
	name: string;
	slug: string;
	/** Section names that map to this person (case-insensitive; "<alias> Wishlist" also accepted). */
	aliases: string[];
}

export const PEOPLE: PersonConfig[] = [
	{ id: 1, name: 'Kevin', slug: 'kevin', aliases: ['kevin', 'kev', 'dad'] },
	{ id: 2, name: 'Casey', slug: 'casey', aliases: ['casey', 'mom'] },
	{ id: 3, name: 'Robbie', slug: 'robbie', aliases: ['robbie', 'rob', 'robert'] },
	{ id: 4, name: 'Logan', slug: 'logan', aliases: ['logan'] }
];

/** Name of the Todoist project that holds the sections (resolved at runtime, TODOIST_PROJECT_ID overrides). */
export const TODOIST_PROJECT_NAME = 'Purchases';

/** Dates and times on guest pages are shown in the family's time zone. */
export const SITE_TIME_ZONE = 'America/New_York';

/** Todoist labels that control behaviour instead of being categories. */
export const LABEL_BOUGHT = 'bought';
export const LABEL_HIDDEN = 'hidden';

/** Tasks whose name starts with this word hold a person's sizes/preferences for the enrichment routine. Never shown. */
export const PROFILE_TASK_PREFIX = 'profile';

/** Maximum offers shown on an item (SPEC §6). */
export const MAX_OFFERS = 3;

/** Description hint keys the parser understands (also published in /api/enrich/manifest). */
export const HINT_KEYS = ['price', 'qty', 'occasion', 'size', 'color', 'enriched'] as const;

/** Limits for the daily Claude enrichment routine (published in /api/enrich/manifest). */
export const ENRICH_MAX_ITEMS_PER_RUN = 20;
export const ENRICH_MIN_TASK_AGE_MINUTES = 120;

/** Todoist API priority (4 = highest) -> desire level (1 = really want ... 4 = none). */
export const DESIRE_LABELS: Record<number, string> = {
	1: 'Really want',
	2: 'Would love',
	3: 'Nice to have'
};

export const OCCASIONS = ['any', 'birthday', 'holidays'] as const;
export type Occasion = (typeof OCCASIONS)[number];

/** Price bands for the list filter, in cents. */
export const PRICE_BANDS = [
	{ key: 'under25', label: 'Under $25', min: 0, max: 2500 },
	{ key: '25to50', label: '$25–50', min: 2500, max: 5000 },
	{ key: '50to100', label: '$50–100', min: 5000, max: 10000 },
	{ key: 'over100', label: 'Over $100', min: 10000, max: Infinity }
] as const;

/** Re-fetch a product page for image/price when the last check is older than this. */
export const PAGE_REFRESH_HOURS = 24;

/** Outbox retry: delay = min(BASE * 2^attempts, MAX). */
export const OUTBOX_BACKOFF_BASE_MS = 60_000;
export const OUTBOX_BACKOFF_MAX_MS = 6 * 60 * 60_000;

export const OUTBOX_COMMENT_PURCHASED = 'Marked purchased on the wishlist';
export const OUTBOX_COMMENT_UNDONE = 'Purchase undone on the wishlist';
export const OUTBOX_COMMENT_ARCHIVED = 'Season archived on the wishlist; purchase cleared';
