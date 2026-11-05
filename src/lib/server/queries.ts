// Read models for the guest pages and admin. All the SQL the pages need is here.
import { DESIRE_LABELS, MAX_OFFERS, PEOPLE, PRICE_BANDS } from '#lib/config';
import type { ItemRow, ItemView, OfferRow, OfferView, PersonRow } from '#lib/types';
import type { Db } from './db';

type ItemWithCount = ItemRow & { purchased_count: number };

const ITEM_SELECT = `SELECT i.*, (SELECT COUNT(*) FROM purchases p WHERE p.item_id = i.id AND p.released_at IS NULL) AS purchased_count
	FROM items i`;

export async function loadPeople(db: Db): Promise<PersonRow[]> {
	return db.all<PersonRow>('SELECT * FROM people ORDER BY sort_order');
}

export async function loadItemRow(db: Db, id: number): Promise<ItemRow | null> {
	return db.first<ItemRow>('SELECT * FROM items WHERE id = ?', id);
}

async function offersFor(db: Db, itemIds: number[]): Promise<Map<number, OfferView[]>> {
	const map = new Map<number, OfferView[]>();
	if (itemIds.length === 0) return map;
	const placeholders = itemIds.map(() => '?').join(',');
	const rows = await db.all<OfferRow>(
		`SELECT * FROM offers WHERE item_id IN (${placeholders})
		 ORDER BY is_best DESC, (price_cents IS NULL), price_cents, fetched_at DESC`,
		...itemIds
	);
	for (const r of rows) {
		const list = map.get(r.item_id) ?? [];
		if (list.length < MAX_OFFERS) {
			list.push({
				id: r.id,
				source: r.source,
				store: r.store,
				priceCents: r.price_cents,
				currency: r.currency,
				url: r.url,
				note: r.note,
				fetchedAt: r.fetched_at,
				isBest: r.is_best === 1
			});
		}
		map.set(r.item_id, list);
	}
	return map;
}

function parseCategories(json: string): string[] {
	try {
		const v = JSON.parse(json);
		return Array.isArray(v) ? v.map(String) : [];
	} catch {
		return [];
	}
}

function toView(row: ItemWithCount, personSlug: string, offers: OfferView[]): ItemView {
	const best = offers.find((o) => o.isBest) ?? null;
	const purchased = row.bought_in_todoist === 1 || row.purchased_count >= row.qty;
	const categories = parseCategories(row.categories);
	return {
		id: row.id,
		personSlug,
		name: row.name,
		notes: row.notes,
		productUrl: row.product_url,
		imageUrl: row.image_key ? `/img/${row.image_key}` : null,
		desire: row.desire,
		desireLabel: DESIRE_LABELS[row.desire] ?? null,
		aboutPriceCents: row.about_price_cents,
		qty: row.qty,
		occasion: row.occasion,
		categories,
		size: row.size,
		color: row.color,
		enrichedAt: row.enriched_at,
		createdAt: row.created_at,
		purchasedCount: row.purchased_count,
		purchased,
		boughtInTodoist: row.bought_in_todoist === 1,
		headlinePriceCents: best?.priceCents ?? row.about_price_cents,
		headlineIsEstimate: !best?.priceCents && row.about_price_cents !== null,
		bestOffer: best,
		offers
	};
}

/** All visible (not hidden, not removed) items for one person, unfiltered. */
export async function loadPersonItems(db: Db, personId: number): Promise<ItemView[]> {
	const person = PEOPLE.find((p) => p.id === personId)!;
	const rows = await db.all<ItemWithCount>(
		`${ITEM_SELECT} WHERE i.person_id = ? AND i.removed_at IS NULL AND i.hidden = 0 ORDER BY i.id`,
		personId
	);
	const offers = await offersFor(
		db,
		rows.map((r) => r.id)
	);
	return rows.map((r) => toView(r, person.slug, offers.get(r.id) ?? []));
}

export async function loadItem(db: Db, id: number): Promise<ItemView | null> {
	const row = await db.first<ItemWithCount>(`${ITEM_SELECT} WHERE i.id = ?`, id);
	if (!row || row.hidden === 1) return null;
	const person = PEOPLE.find((p) => p.id === row.person_id)!;
	const offers = await offersFor(db, [row.id]);
	return toView(row, person.slug, offers.get(row.id) ?? []);
}

export interface ListFilters {
	availableOnly: boolean;
	category: string | null;
	band: string | null;
	occasion: string | null;
	sort: 'desire' | 'price' | 'newest';
}

export function parseFilters(params: URLSearchParams): ListFilters {
	const sort = params.get('sort');
	return {
		// Default on; `?all=1` shows purchased too.
		availableOnly: params.get('all') !== '1',
		category: params.get('cat') || null,
		band: params.get('price') || null,
		occasion: params.get('occasion') || null,
		sort: sort === 'price' || sort === 'newest' ? sort : 'desire'
	};
}

export function applyFilters(items: ItemView[], f: ListFilters): ItemView[] {
	const band = PRICE_BANDS.find((b) => b.key === f.band);
	let out = items.filter((it) => {
		if (f.availableOnly && it.purchased) return false;
		if (f.category && !it.categories.includes(f.category)) return false;
		if (f.occasion && it.occasion !== 'any' && it.occasion !== f.occasion) return false;
		if (band) {
			const p = it.headlinePriceCents;
			if (p === null || p < band.min || p >= band.max) return false;
		}
		return true;
	});
	const price = (it: ItemView) => it.headlinePriceCents ?? Number.POSITIVE_INFINITY;
	if (f.sort === 'price') out = out.sort((a, b) => price(a) - price(b) || a.id - b.id);
	else if (f.sort === 'newest')
		out = out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
	else out = out.sort((a, b) => a.desire - b.desire || price(a) - price(b) || a.id - b.id);
	return out;
}

export interface PersonSummary {
	id: number;
	name: string;
	slug: string;
	available: number;
	total: number;
	purchased: number;
	hidden: number;
	thumbnailUrl: string | null;
}

/** Home-page and admin counts per person. */
export async function loadPersonSummaries(db: Db): Promise<PersonSummary[]> {
	const out: PersonSummary[] = [];
	for (const p of PEOPLE) {
		const items = await loadPersonItems(db, p.id);
		const available = items.filter((i) => !i.purchased);
		const top = [...available].sort((a, b) => a.desire - b.desire || a.id - b.id);
		const thumb = top.find((i) => i.imageUrl)?.imageUrl ?? null;
		const hidden = await db.first<{ n: number }>(
			'SELECT COUNT(*) AS n FROM items WHERE person_id = ? AND removed_at IS NULL AND hidden = 1',
			p.id
		);
		out.push({
			id: p.id,
			name: p.name,
			slug: p.slug,
			available: available.length,
			total: items.length,
			purchased: items.length - available.length,
			hidden: hidden?.n ?? 0,
			thumbnailUrl: thumb
		});
	}
	return out;
}

export async function lastSync(db: Db, kind = 'todoist') {
	return db.first<{
		started_at: string;
		finished_at: string | null;
		ok: number | null;
		error: string | null;
		detail: string | null;
	}>(
		'SELECT started_at, finished_at, ok, error, detail FROM sync_runs WHERE kind = ? ORDER BY id DESC LIMIT 1',
		kind
	);
}

export async function getSetting(db: Db, key: string): Promise<string> {
	const r = await db.first<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
	return r?.value ?? '';
}

export async function setSetting(db: Db, key: string, value: string) {
	await db.run(
		'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
		key,
		value
	);
}
