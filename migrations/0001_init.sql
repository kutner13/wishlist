-- Family wishlist schema (SPEC.md §8). Timestamps are ISO-8601 UTC strings.

CREATE TABLE people (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	slug TEXT NOT NULL UNIQUE,
	todoist_section_id TEXT,
	sort_order INTEGER NOT NULL
);

CREATE TABLE items (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	person_id INTEGER NOT NULL REFERENCES people(id),
	todoist_task_id TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL,
	notes TEXT NOT NULL DEFAULT '',
	product_url TEXT,
	image_key TEXT,
	-- Todoist priority mapped to 1 = really want, 2 = would love, 3 = nice to have, 4 = none.
	desire INTEGER NOT NULL DEFAULT 4,
	about_price_cents INTEGER,
	qty INTEGER NOT NULL DEFAULT 1,
	occasion TEXT NOT NULL DEFAULT 'any',
	-- JSON array of label names, excluding the control labels.
	categories TEXT NOT NULL DEFAULT '[]',
	-- From `size:` / `color:` description hints.
	size TEXT,
	color TEXT,
	-- From the `enriched: YYYY-MM-DD` hint written by the daily Claude enrichment routine.
	enriched_at TEXT,
	hidden INTEGER NOT NULL DEFAULT 0,
	bought_in_todoist INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	removed_at TEXT,
	-- When the product page was last fetched for image/price (NULL = never).
	page_checked_at TEXT
);
CREATE INDEX items_person ON items(person_id, removed_at);

CREATE TABLE offers (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
	source TEXT NOT NULL CHECK (source IN ('page', 'claude', 'manual')),
	store TEXT NOT NULL,
	price_cents INTEGER,
	currency TEXT NOT NULL DEFAULT 'USD',
	url TEXT,
	note TEXT,
	fetched_at TEXT NOT NULL,
	is_best INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX offers_item ON offers(item_id);

CREATE TABLE purchases (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
	device_token TEXT NOT NULL,
	created_at TEXT NOT NULL,
	released_at TEXT
);
CREATE INDEX purchases_item ON purchases(item_id, released_at);

CREATE TABLE todoist_outbox (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
	action TEXT NOT NULL CHECK (action IN ('add_label', 'remove_label', 'comment')),
	payload TEXT NOT NULL DEFAULT '{}',
	attempts INTEGER NOT NULL DEFAULT 0,
	last_error TEXT,
	next_attempt_at TEXT NOT NULL,
	created_at TEXT NOT NULL,
	done_at TEXT
);
CREATE INDEX outbox_pending ON todoist_outbox(done_at, next_attempt_at);

CREATE TABLE sync_runs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	kind TEXT NOT NULL,
	started_at TEXT NOT NULL,
	finished_at TEXT,
	ok INTEGER,
	error TEXT,
	-- Free-form JSON summary (counts).
	detail TEXT
);
CREATE INDEX sync_runs_kind ON sync_runs(kind, started_at);

CREATE TABLE settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);

INSERT INTO people (id, name, slug, sort_order) VALUES
	(1, 'Kevin', 'kevin', 1),
	(2, 'Casey', 'casey', 2),
	(3, 'Robbie', 'robbie', 3),
	(4, 'Logan', 'logan', 4);

INSERT INTO settings (key, value) VALUES ('season_banner', '');
