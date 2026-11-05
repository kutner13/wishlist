import { describe, expect, it } from 'vitest';
import { backoffMs, drainOutbox, enqueue } from '../src/lib/server/outbox';
import type { TodoistTask, TodoistWriter } from '../src/lib/server/todoist';
import type { OutboxRow } from '../src/lib/types';
import { insertItem, testDb } from './helpers';

function writer(opts: { failLabels?: number; labels?: string[] } = {}) {
	const calls: string[] = [];
	let failures = opts.failLabels ?? 0;
	const task: TodoistTask = {
		id: 't1',
		content: 'x',
		description: '',
		priority: 1,
		labels: opts.labels ?? ['toys'],
		section_id: 's',
		project_id: 'p'
	};
	const w: TodoistWriter & { calls: string[]; task: TodoistTask } = {
		calls,
		task,
		async getTask() {
			return task;
		},
		async setLabels(id, labels) {
			if (failures > 0) {
				failures--;
				throw new Error('Todoist 503');
			}
			calls.push(`labels:${labels.join(',')}`);
			task.labels = labels;
		},
		async addComment(id, content) {
			calls.push(`comment:${content}`);
		}
	};
	return w;
}

describe('outbox', () => {
	it('backoff doubles and caps', () => {
		expect(backoffMs(1)).toBe(60_000);
		expect(backoffMs(2)).toBe(120_000);
		expect(backoffMs(5)).toBe(960_000);
		expect(backoffMs(20)).toBe(6 * 3_600_000);
	});

	it('applies rows in order and marks them done', async () => {
		const db = testDb();
		const id = await insertItem(db, { todoist_task_id: 't1' });
		await enqueue(db, id, 'add_label', {}, '2026-11-01T00:00:00Z');
		await enqueue(db, id, 'comment', { content: 'hi' }, '2026-11-01T00:00:00Z');
		const w = writer();
		const r = await drainOutbox(db, w, { now: new Date('2026-11-01T00:00:01Z') });
		expect(r).toEqual({ done: 2, failed: 0 });
		expect(w.calls).toEqual(['labels:toys,bought', 'comment:hi']);
		const rows = await db.all<OutboxRow>('SELECT * FROM todoist_outbox');
		expect(rows.every((x) => x.done_at)).toBe(true);
	});

	it('remove_label strips only the control label', async () => {
		const db = testDb();
		const id = await insertItem(db, { todoist_task_id: 't1' });
		await enqueue(db, id, 'remove_label', {}, '2026-11-01T00:00:00Z');
		const w = writer({ labels: ['toys', 'Bought'] });
		await drainOutbox(db, w, { now: new Date('2026-11-01T00:00:01Z') });
		expect(w.calls).toEqual(['labels:toys']);
	});

	it('records failures, backs off, and retries later', async () => {
		const db = testDb();
		const id = await insertItem(db, { todoist_task_id: 't1' });
		await enqueue(db, id, 'add_label', {}, '2026-11-01T00:00:00Z');
		const w = writer({ failLabels: 2 });
		const t0 = new Date('2026-11-01T00:00:01Z');

		let r = await drainOutbox(db, w, { now: t0 });
		expect(r).toEqual({ done: 0, failed: 1 });
		let row = (await db.first<OutboxRow>('SELECT * FROM todoist_outbox'))!;
		expect(row.attempts).toBe(1);
		expect(row.last_error).toContain('503');
		expect(row.next_attempt_at).toBe(new Date(t0.getTime() + 60_000).toISOString());

		// Too early: nothing happens.
		r = await drainOutbox(db, w, { now: new Date(t0.getTime() + 30_000) });
		expect(r).toEqual({ done: 0, failed: 0 });

		// Due again: fails a second time, waits 2 min.
		r = await drainOutbox(db, w, { now: new Date(t0.getTime() + 61_000) });
		expect(r.failed).toBe(1);
		row = (await db.first<OutboxRow>('SELECT * FROM todoist_outbox'))!;
		expect(row.attempts).toBe(2);

		// Third try succeeds.
		r = await drainOutbox(db, w, { now: new Date(t0.getTime() + 61_000 + 120_000) });
		expect(r).toEqual({ done: 1, failed: 0 });
		row = (await db.first<OutboxRow>('SELECT * FROM todoist_outbox'))!;
		expect(row.done_at).not.toBeNull();
		expect(row.last_error).toBeNull();
	});
});
