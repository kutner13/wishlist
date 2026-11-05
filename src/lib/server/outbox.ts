// Site -> Todoist write queue (SPEC §4). Rows are enqueued by purchase/undo/archive and
// drained after the request (waitUntil) and on every cron tick, with exponential backoff.
import { LABEL_BOUGHT, OUTBOX_BACKOFF_BASE_MS, OUTBOX_BACKOFF_MAX_MS } from '#lib/config';
import type { OutboxAction, OutboxRow } from '#lib/types';
import type { Db } from './db';
import type { TodoistWriter } from './todoist';

export async function enqueue(
	db: Db,
	itemId: number,
	action: OutboxAction,
	payload: Record<string, unknown> = {},
	now = new Date().toISOString()
) {
	await db.run(
		`INSERT INTO todoist_outbox (item_id, action, payload, next_attempt_at, created_at)
		 VALUES (?, ?, ?, ?, ?)`,
		itemId,
		action,
		JSON.stringify(payload),
		now,
		now
	);
}

/** Delay before the next try after `attempts` failures. */
export function backoffMs(attempts: number): number {
	return Math.min(OUTBOX_BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), OUTBOX_BACKOFF_MAX_MS);
}

export interface DrainResult {
	done: number;
	failed: number;
}

/** Processes due outbox rows in order. Never throws; failures are recorded on the row. */
export async function drainOutbox(
	db: Db,
	todoist: TodoistWriter,
	opts: { now?: Date; limit?: number } = {}
): Promise<DrainResult> {
	const now = opts.now ?? new Date();
	const rows = await db.all<OutboxRow & { todoist_task_id: string }>(
		`SELECT o.*, i.todoist_task_id FROM todoist_outbox o JOIN items i ON i.id = o.item_id
		 WHERE o.done_at IS NULL AND o.next_attempt_at <= ? ORDER BY o.id LIMIT ?`,
		now.toISOString(),
		opts.limit ?? 25
	);
	const result: DrainResult = { done: 0, failed: 0 };
	for (const row of rows) {
		try {
			await apply(todoist, row);
			await db.run(
				'UPDATE todoist_outbox SET done_at = ?, last_error = NULL WHERE id = ?',
				now.toISOString(),
				row.id
			);
			result.done++;
		} catch (e) {
			const attempts = row.attempts + 1;
			const next = new Date(now.getTime() + backoffMs(attempts)).toISOString();
			await db.run(
				'UPDATE todoist_outbox SET attempts = ?, last_error = ?, next_attempt_at = ? WHERE id = ?',
				attempts,
				String((e as Error)?.message ?? e).slice(0, 500),
				next,
				row.id
			);
			result.failed++;
		}
	}
	return result;
}

async function apply(todoist: TodoistWriter, row: OutboxRow & { todoist_task_id: string }) {
	const payload = JSON.parse(row.payload || '{}') as { content?: string };
	if (row.action === 'comment') {
		await todoist.addComment(row.todoist_task_id, payload.content ?? '');
		return;
	}
	const task = await todoist.getTask(row.todoist_task_id);
	const labels = (task.labels ?? []).filter((l) => l.toLowerCase() !== LABEL_BOUGHT);
	if (row.action === 'add_label') labels.push(LABEL_BOUGHT);
	await todoist.setLabels(row.todoist_task_id, labels);
}
