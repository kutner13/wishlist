import { fail } from '@sveltejs/kit';
import { db, secret } from '#lib/server/env';
import { loadHealth } from '#lib/server/health';
import { runFullSync, runOutboxDrain, runPageRefresh } from '#lib/server/jobs';
import { archiveSeason } from '#lib/server/purchases';
import { loadPersonSummaries, setSetting } from '#lib/server/queries';
import type { Actions, PageServerLoad } from './$types';

interface PurchasedRow {
	item_id: number;
	name: string;
	qty: number;
	person: string;
	marked_at: string;
	count: number;
	bought_in_todoist: number;
	pending_writes: number;
	failed_writes: number;
	last_error: string | null;
}

export const load: PageServerLoad = async ({ locals }) => {
	const d = db();
	const [people, health] = await Promise.all([loadPersonSummaries(d), loadHealth(d)]);
	const purchased = await d.all<PurchasedRow>(
		`SELECT i.id AS item_id, i.name, i.qty, p.name AS person, i.bought_in_todoist,
		   MAX(pu.created_at) AS marked_at, COUNT(pu.id) AS count,
		   (SELECT COUNT(*) FROM todoist_outbox o WHERE o.item_id = i.id AND o.done_at IS NULL) AS pending_writes,
		   (SELECT COUNT(*) FROM todoist_outbox o WHERE o.item_id = i.id AND o.done_at IS NULL AND o.attempts > 0) AS failed_writes,
		   (SELECT last_error FROM todoist_outbox o WHERE o.item_id = i.id AND o.done_at IS NULL AND o.last_error IS NOT NULL ORDER BY id DESC LIMIT 1) AS last_error
		 FROM items i JOIN people p ON p.id = i.person_id
		 LEFT JOIN purchases pu ON pu.item_id = i.id AND pu.released_at IS NULL
		 WHERE i.removed_at IS NULL AND (pu.id IS NOT NULL OR i.bought_in_todoist = 1)
		 GROUP BY i.id ORDER BY marked_at DESC, i.id DESC`
	);
	return {
		who: locals.adminEmail,
		people,
		health,
		purchased,
		guestSlug: secret('GUEST_SLUG'),
		todoistConfigured: Boolean(secret('TODOIST_TOKEN'))
	};
};

export const actions: Actions = {
	sync: async () => {
		const r = await runFullSync({ pages: false });
		return {
			done: 'sync',
			ok: r.sync.ok,
			message: r.sync.ok
				? `Synced: ${JSON.stringify(r.sync.summary)}; outbox ${r.drain.done} sent, ${r.drain.failed} failed`
				: r.sync.error
		};
	},
	refresh: async () => {
		const r = await runPageRefresh(undefined, true);
		return {
			done: 'refresh',
			ok: r.ok,
			message: r.summary
				? `Checked ${r.summary.checked} pages: ${r.summary.imagesStored} images, ${r.summary.offersWritten} prices, ${r.summary.errors.length} errors`
				: r.error
		};
	},
	drain: async () => {
		const r = await runOutboxDrain();
		return { done: 'drain', ok: true, message: `Outbox: ${r.done} sent, ${r.failed} failed` };
	},
	archive: async ({ request }) => {
		const form = await request.formData();
		if (form.get('confirm') !== 'ARCHIVE')
			return fail(400, { done: 'archive', ok: false, message: 'Type ARCHIVE to confirm.' });
		const n = await archiveSeason(db());
		const r = await runOutboxDrain();
		return {
			done: 'archive',
			ok: true,
			message: `Season archived. ${n} items released; ${r.done} Todoist writes sent now, the rest will retry.`
		};
	},
	banner: async ({ request }) => {
		const form = await request.formData();
		const text = String(form.get('banner') ?? '')
			.trim()
			.slice(0, 80);
		await setSetting(db(), 'season_banner', text);
		return {
			done: 'banner',
			ok: true,
			message: text ? `Banner set to "${text}".` : 'Banner cleared.'
		};
	}
};
