// Seeds the local D1 database (wrangler --local) with fixture items for all four people.
// Usage: npm run db:migrate:local && npm run db:seed:local
// Writes SQL to .wrangler/seed.sql and applies it with `wrangler d1 execute --local`.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const now = new Date();
const iso = (daysAgo: number, hours = 0) =>
	new Date(now.getTime() - daysAgo * 86_400_000 - hours * 3_600_000).toISOString();
const q = (v: string | number | null) =>
	v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`;

interface SeedItem {
	person: number;
	task: string;
	name: string;
	notes?: string;
	url?: string;
	desire?: number;
	price?: number;
	qty?: number;
	occasion?: string;
	cats?: string[];
	size?: string;
	color?: string;
	enriched?: string;
	bought?: boolean;
	hidden?: boolean;
	/** Todoist task id of the parent task (a subtask). */
	parent?: string;
	daysAgo?: number;
	offers?: {
		source: 'page' | 'claude' | 'manual';
		store: string;
		price: number | null;
		url?: string;
		days?: number;
	}[];
	purchases?: number;
}

const items: SeedItem[] = [
	// Kevin
	{
		person: 1,
		task: 'k1',
		name: 'Running socks (3-pack)',
		desire: 2,
		price: 1800,
		cats: ['clothes'],
		size: 'L',
		purchases: 1,
		daysAgo: 12,
		offers: [
			{ source: 'claude', store: 'REI', price: 1695, days: 2 },
			{ source: 'claude', store: 'Amazon', price: 1799, days: 2 }
		]
	},
	{
		person: 1,
		task: 'k2',
		name: 'Cast iron skillet, 12 in',
		notes: 'Lodge or similar. Pre-seasoned.',
		url: 'https://www.lodgecastiron.com/product/seasoned-cast-iron-skillet',
		desire: 1,
		price: 3500,
		cats: ['kitchen'],
		daysAgo: 20,
		offers: [
			{ source: 'page', store: 'lodgecastiron.com', price: 3499, days: 1 },
			{ source: 'claude', store: 'Target', price: 2999, days: 3 },
			{ source: 'claude', store: 'Walmart', price: 3250, days: 3 }
		]
	},
	{ person: 1, task: 'k3', name: 'Bike multi-tool', desire: 3, cats: ['outdoors'], daysAgo: 5 },
	{
		person: 1,
		task: 'k4',
		name: 'Profile: Kevin',
		notes: 'Shirt L, shoe 11, likes dark roast',
		hidden: true
	},
	// Casey
	{
		person: 2,
		task: 'c1',
		name: 'Stanley tumbler 30 oz',
		notes: 'The handle one.',
		url: 'https://www.stanley1913.com/products/adventure-quencher-travel-tumbler-30-oz',
		desire: 1,
		price: 3500,
		cats: ['kitchen'],
		color: 'Rose quartz',
		enriched: '2026-11-03',
		purchases: 1,
		daysAgo: 30,
		offers: [
			{ source: 'page', store: 'stanley1913.com', price: 3500, days: 1 },
			{ source: 'claude', store: 'Target', price: 3500, days: 4 }
		]
	},
	{
		person: 2,
		task: 'c2',
		name: 'Kindle case',
		notes: 'For the 2024 Paperwhite. Not black.',
		desire: 2,
		price: 2500,
		cats: ['tech'],
		bought: true,
		daysAgo: 25,
		offers: [{ source: 'claude', store: 'Amazon', price: 2299, days: 6 }]
	},
	{
		person: 2,
		task: 'c3',
		name: 'Gardening gloves',
		desire: 3,
		price: 1500,
		cats: ['outdoors'],
		occasion: 'birthday',
		daysAgo: 8
	},
	{
		person: 2,
		task: 'c4',
		name: 'Cookbook: Salt Fat Acid Heat',
		desire: 2,
		price: 2000,
		cats: ['books'],
		daysAgo: 3,
		offers: [
			{ source: 'claude', store: 'Bookshop.org', price: 3255, days: 1 },
			{ source: 'claude', store: 'Target', price: 2449, days: 1 },
			{ source: 'claude', store: 'Amazon', price: 2199, days: 1 }
		]
	},
	{ person: 2, task: 'c5', name: 'Weekend in Vermont', hidden: true },
	// Robbie
	{
		person: 3,
		task: 'r1',
		name: 'LEGO Technic rally car',
		notes: 'The 42xxx one with the pull-back motor, not the small one. Any color. Age 8+.',
		url: 'https://www.lego.com/en-us/product/rally-car-42077',
		desire: 1,
		price: 4500,
		cats: ['toys'],
		occasion: 'holidays',
		daysAgo: 15,
		offers: [
			{ source: 'claude', store: 'Target', price: 4200, days: 2 },
			{ source: 'page', store: 'lego.com', price: 4499, days: 2 },
			{ source: 'claude', store: 'Amazon', price: 4650, days: 9 }
		]
	},
	{
		person: 3,
		task: 'r2',
		name: 'Hooded towel, shark',
		notes: 'One for the pool bag, one for home.',
		desire: 1,
		price: 2500,
		qty: 2,
		cats: ['clothes'],
		purchases: 1,
		daysAgo: 14,
		offers: [
			{ source: 'claude', store: 'Amazon', price: 2200, days: 3 },
			{ source: 'claude', store: 'Pottery Barn Kids', price: 3900, days: 3 }
		]
	},
	{
		person: 3,
		task: 'r3',
		name: 'Magna-Tiles 100 pc',
		desire: 2,
		price: 12000,
		cats: ['toys'],
		daysAgo: 40,
		offers: [
			{ source: 'claude', store: 'Walmart', price: 10900, days: 5 },
			{ source: 'claude', store: 'Target', price: 11999, days: 5 }
		]
	},
	{
		person: 3,
		task: 'r4',
		name: 'Dog Man: Big Jim Begins',
		desire: 2,
		price: 1200,
		cats: ['books'],
		purchases: 1,
		daysAgo: 10,
		offers: [{ source: 'claude', store: 'Target', price: 900, days: 2 }]
	},
	{
		person: 3,
		task: 'r5',
		name: "Kids' binoculars",
		desire: 3,
		price: 2000,
		cats: ['outdoors'],
		occasion: 'birthday',
		daysAgo: 6
	},
	{
		person: 3,
		task: 'r6',
		name: 'Pokémon cards, booster box',
		cats: ['toys'],
		daysAgo: 1,
		offers: [{ source: 'claude', store: 'Best Buy', price: 3800, days: 1 }]
	},
	// A parent task with subtasks: the parent is a section heading, not a wish.
	{ person: 3, task: 'r8', name: 'Pool bag', daysAgo: 3 },
	{ person: 3, task: 'r9', name: 'Swim goggles', parent: 'r8', desire: 2, price: 1500, daysAgo: 3 },
	{ person: 3, task: 'r10', name: 'Swim fins', parent: 'r8', price: 2500, daysAgo: 3 },
	{ person: 3, task: 'r11', name: 'Shark towel clip', parent: 'r8', daysAgo: 3 },
	{
		person: 3,
		task: 'r12',
		name: 'Captain Underpants box set',
		desire: 3,
		price: 4000,
		cats: ['books'],
		daysAgo: 2
	},
	{
		person: 3,
		task: 'r7',
		name: 'Profile: Robbie',
		notes: 'Shoe size 2, shirt youth M, loves sharks and blue',
		hidden: true
	},
	// Logan
	{
		person: 4,
		task: 'l1',
		name: 'Balance bike',
		notes: 'Strider 12 or similar.',
		url: 'https://www.striderbikes.com/products/12-sport',
		desire: 1,
		price: 12000,
		cats: ['outdoors'],
		color: 'Green',
		size: '12 in',
		enriched: '2026-11-04',
		daysAgo: 9,
		offers: [
			{ source: 'page', store: 'striderbikes.com', price: 11999, days: 1 },
			{ source: 'claude', store: 'REI', price: 11999, days: 2 }
		]
	},
	{
		person: 4,
		task: 'l2',
		name: 'Bluey plush',
		desire: 2,
		price: 2000,
		cats: ['toys'],
		daysAgo: 4
	},
	{ person: 4, task: 'l3', name: 'Board book bundle', desire: 3, cats: ['books'], daysAgo: 2 },
	{
		person: 4,
		task: 'l4',
		name: 'Rain boots',
		size: 'toddler 8',
		color: 'Yellow',
		desire: 2,
		price: 3000,
		cats: ['clothes'],
		daysAgo: 7,
		offers: [
			{
				source: 'manual',
				store: 'hunterboots.com',
				price: null,
				url: 'https://www.hunterboots.com/kids'
			}
		]
	}
];

const sql: string[] = [
	'DELETE FROM todoist_outbox; DELETE FROM purchases; DELETE FROM offers; DELETE FROM items; DELETE FROM sync_runs;',
	"UPDATE people SET todoist_section_id = CASE id WHEN 1 THEN 's-kev' WHEN 2 THEN 's-casey' WHEN 3 THEN 's-robbie' WHEN 4 THEN 's-logan' END;",
	`INSERT INTO sync_runs (kind, started_at, finished_at, ok, detail) VALUES ('todoist', ${q(iso(0, 0.2))}, ${q(iso(0, 0.2))}, 1, '{"upserted":${items.length}}');`,
	`INSERT INTO sync_runs (kind, started_at, finished_at, ok, detail) VALUES ('pages', ${q(iso(2))}, ${q(iso(2))}, 1, '{"checked":4,"imagesStored":0,"offersWritten":3,"errors":[]}');`,
	`INSERT INTO sync_runs (kind, started_at, finished_at, ok, error) VALUES ('pages', ${q(iso(0, 3))}, ${q(iso(0, 3))}, 0, 'Kindle case: page fetch failed (403)');`,
	"INSERT INTO settings (key, value) VALUES ('season_banner', 'Holidays 2026') ON CONFLICT(key) DO UPDATE SET value = excluded.value;"
];

let id = 0;
for (const it of items) {
	id++;
	const created = iso(it.daysAgo ?? 1);
	sql.push(
		`INSERT INTO items (id, person_id, todoist_task_id, parent_todoist_task_id, name, notes, product_url, desire, about_price_cents, qty, occasion, categories, size, color, enriched_at, hidden, bought_in_todoist, created_at, updated_at, page_checked_at) VALUES (` +
			[
				id,
				it.person,
				it.task,
				it.parent ?? null,
				it.name,
				it.notes ?? '',
				it.url ?? null,
				it.desire ?? 4,
				it.price ?? null,
				it.qty ?? 1,
				it.occasion ?? 'any',
				JSON.stringify(it.cats ?? []),
				it.size ?? null,
				it.color ?? null,
				it.enriched ?? null,
				it.hidden ? 1 : 0,
				it.bought ? 1 : 0,
				created,
				created,
				it.url ? iso(1) : null
			]
				.map(q)
				.join(', ') +
			');'
	);
	const offers = it.offers ?? [];
	const best = offers.filter((o) => o.price !== null).sort((a, b) => a.price! - b.price!)[0];
	for (const o of offers) {
		sql.push(
			`INSERT INTO offers (item_id, source, store, price_cents, currency, url, fetched_at, is_best) VALUES (${id}, ${q(o.source)}, ${q(o.store)}, ${q(o.price)}, 'USD', ${q(o.url ?? (o.source === 'page' ? it.url! : null))}, ${q(iso(o.days ?? 1))}, ${o === best ? 1 : 0});`
		);
	}
	for (let n = 0; n < (it.purchases ?? 0); n++) {
		sql.push(
			`INSERT INTO purchases (item_id, device_token, created_at) VALUES (${id}, 'seed-device-${n}', ${q(iso(2 + n))});`
		);
	}
	if ((it.purchases ?? 0) >= (it.qty ?? 1) && (it.purchases ?? 0) > 0) {
		sql.push(
			`INSERT INTO todoist_outbox (item_id, action, payload, next_attempt_at, created_at, done_at) VALUES (${id}, 'add_label', '{}', ${q(iso(2))}, ${q(iso(2))}, ${q(iso(2))});`
		);
	}
}
// One failing outbox write so the admin page shows the retry state.
sql.push(
	`INSERT INTO todoist_outbox (item_id, action, payload, attempts, last_error, next_attempt_at, created_at) VALUES (2, 'comment', '{"content":"Marked purchased on the wishlist"}', 2, 'Todoist POST /comments: 503', ${q(iso(0, -0.1))}, ${q(iso(0, 0.5))});`
);

mkdirSync('.wrangler', { recursive: true });
writeFileSync('.wrangler/seed.sql', sql.join('\n') + '\n');
execFileSync(
	'npx',
	['wrangler', 'd1', 'execute', 'DB', '--local', '--file', '.wrangler/seed.sql'],
	{
		stdio: 'inherit'
	}
);
console.log(`Seeded ${items.length} items for 4 people.`);
