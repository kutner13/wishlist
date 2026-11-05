// Data behind /admin/health and the admin dashboard's "Sync & health" panel.
import type { Db } from './db';
import { getSetting, lastSync } from './queries';

export interface Health {
	now: string;
	lastTodoistSync: { at: string | null; ok: boolean | null; error: string | null; detail: unknown };
	lastPageRefresh: { at: string | null; ok: boolean | null; error: string | null; detail: unknown };
	outbox: {
		pending: number;
		failing: number;
		nextAttemptAt: string | null;
		lastError: string | null;
	};
	errors24h: { count: number; samples: string[] };
	images: { withImage: number; total: number };
	offers: { items: number; offers: number };
	lastArchiveAt: string | null;
	seasonBanner: string;
}

export async function loadHealth(db: Db): Promise<Health> {
	const now = new Date();
	const since = new Date(now.getTime() - 24 * 3_600_000).toISOString();
	const [todoist, pages] = await Promise.all([lastSync(db, 'todoist'), lastSync(db, 'pages')]);
	const outbox = await db.first<{ pending: number; failing: number; next: string | null }>(
		`SELECT COUNT(*) AS pending, SUM(attempts > 0) AS failing, MIN(next_attempt_at) AS next
		 FROM todoist_outbox WHERE done_at IS NULL`
	);
	const lastErr = await db.first<{ last_error: string }>(
		'SELECT last_error FROM todoist_outbox WHERE done_at IS NULL AND last_error IS NOT NULL ORDER BY id DESC LIMIT 1'
	);
	const errs = await db.all<{ error: string }>(
		'SELECT error FROM sync_runs WHERE ok = 0 AND started_at >= ? ORDER BY id DESC LIMIT 5',
		since
	);
	const errCount = await db.first<{ n: number }>(
		'SELECT COUNT(*) AS n FROM sync_runs WHERE ok = 0 AND started_at >= ?',
		since
	);
	const imgs = await db.first<{ with_image: number; total: number }>(
		`SELECT SUM(image_key IS NOT NULL) AS with_image, COUNT(*) AS total
		 FROM items WHERE removed_at IS NULL AND hidden = 0`
	);
	const offers = await db.first<{ items: number; offers: number }>(
		`SELECT COUNT(DISTINCT o.item_id) AS items, COUNT(*) AS offers FROM offers o
		 JOIN items i ON i.id = o.item_id WHERE i.removed_at IS NULL`
	);
	const parse = (s: string | null | undefined) => {
		if (!s) return null;
		try {
			return JSON.parse(s);
		} catch {
			return s;
		}
	};
	return {
		now: now.toISOString(),
		lastTodoistSync: {
			at: todoist?.finished_at ?? todoist?.started_at ?? null,
			ok: todoist ? todoist.ok === 1 : null,
			error: todoist?.error ?? null,
			detail: parse(todoist?.detail)
		},
		lastPageRefresh: {
			at: pages?.finished_at ?? pages?.started_at ?? null,
			ok: pages ? pages.ok === 1 : null,
			error: pages?.error ?? null,
			detail: parse(pages?.detail)
		},
		outbox: {
			pending: outbox?.pending ?? 0,
			failing: outbox?.failing ?? 0,
			nextAttemptAt: outbox?.next ?? null,
			lastError: lastErr?.last_error ?? null
		},
		errors24h: { count: errCount?.n ?? 0, samples: errs.map((e) => e.error).filter(Boolean) },
		images: { withImage: imgs?.with_image ?? 0, total: imgs?.total ?? 0 },
		offers: { items: offers?.items ?? 0, offers: offers?.offers ?? 0 },
		lastArchiveAt: (await getSetting(db, 'last_archive_at')) || null,
		seasonBanner: await getSetting(db, 'season_banner')
	};
}

/** Everything a restore needs, as plain rows. */
export async function exportAll(db: Db) {
	const tables = [
		'people',
		'items',
		'offers',
		'purchases',
		'todoist_outbox',
		'sync_runs',
		'settings'
	];
	const out: Record<string, unknown> = { exported_at: new Date().toISOString(), version: 1 };
	for (const t of tables) out[t] = await db.all(`SELECT * FROM ${t}`);
	return out;
}
