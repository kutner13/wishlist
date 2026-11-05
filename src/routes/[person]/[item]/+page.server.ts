import { error, fail } from '@sveltejs/kit';
import { personBySlug } from '#lib/people';
import { background, db } from '#lib/server/env';
import { runOutboxDrain } from '#lib/server/jobs';
import { activePurchases, markPurchased, undoPurchase } from '#lib/server/purchases';
import { loadItem, loadItemRow } from '#lib/server/queries';
import type { Actions, PageServerLoad } from './$types';

function itemId(param: string): number {
	const id = Number(param);
	if (!Number.isInteger(id) || id <= 0) error(404, 'No such item');
	return id;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const d = db();
	const item = await loadItem(d, itemId(params.item));
	const person = personBySlug(params.person);
	if (!item || !person || item.personSlug !== person.slug) error(404, 'No such item');
	const marks = await activePurchases(d, item.id);
	return {
		item,
		/** The newest mark came from this browser, so Undo needs no confirm. */
		ownMark: marks.some((m) => m.device_token === locals.deviceToken),
		lastMarkedAt: marks[0]?.created_at ?? null
	};
};

export const actions: Actions = {
	purchase: async ({ params, locals }) => {
		const d = db();
		const row = await loadItemRow(d, itemId(params.item));
		if (!row || row.hidden) error(404, 'No such item');
		const result = await markPurchased(d, row, locals.deviceToken);
		if (result.ok) background(runOutboxDrain(d));
		return { action: 'purchase', ok: result.ok, reason: result.ok ? null : result.reason };
	},
	undo: async ({ params, locals, request }) => {
		const d = db();
		const row = await loadItemRow(d, itemId(params.item));
		if (!row || row.hidden) error(404, 'No such item');
		const form = await request.formData();
		const confirmed = form.get('confirm') === '1';
		const result = await undoPurchase(d, row, locals.deviceToken, confirmed);
		if (!result.ok && result.reason === 'needs_confirm') {
			return fail(409, { action: 'undo', needsConfirm: true });
		}
		if (result.ok) background(runOutboxDrain(d));
		return { action: 'undo', ok: result.ok, needsConfirm: false };
	}
};
