// Todoist unified API v1 client (https://developer.todoist.com/api/v1).
//
// NOTE: the docs host was unreachable when this was written, so the paths and field
// names below are from memory of the v1 API. If a call 404s or a field is missing,
// this is the only file to fix; src/lib/server/sync.ts only depends on the
// `TodoistSource` / `TodoistWriter` interfaces at the bottom.
//
// Assumed endpoints:
//   GET  /api/v1/projects?cursor=&limit=              -> { results: Project[], next_cursor }
//   GET  /api/v1/sections?project_id=&cursor=&limit=  -> { results: Section[], next_cursor }
//   GET  /api/v1/tasks?project_id=&cursor=&limit=     -> { results: Task[], next_cursor } (active tasks only)
//   POST /api/v1/tasks/{id}            body { labels: string[] }  -> Task
//   POST /api/v1/comments              body { task_id, content }  -> Comment
// Task fields used: id, content, description, priority (1-4, 4 = highest), labels (names),
// section_id, project_id, parent_id, checked, added_at.

const BASE = 'https://api.todoist.com/api/v1';

export interface TodoistProject {
	id: string;
	name: string;
}
export interface TodoistSection {
	id: string;
	name: string;
	project_id: string;
}
export interface TodoistTask {
	id: string;
	content: string;
	description: string;
	priority: number;
	labels: string[];
	section_id: string | null;
	project_id: string;
	parent_id?: string | null;
	checked?: boolean;
	added_at?: string | null;
}

interface Page<T> {
	results: T[];
	next_cursor: string | null;
}

export class TodoistApiError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}

export interface TodoistSource {
	findProjectIdByName(name: string): Promise<string | null>;
	listSections(projectId: string): Promise<TodoistSection[]>;
	listTasks(projectId: string): Promise<TodoistTask[]>;
}

export interface TodoistWriter {
	getTask(taskId: string): Promise<TodoistTask>;
	setLabels(taskId: string, labels: string[]): Promise<void>;
	addComment(taskId: string, content: string): Promise<void>;
}

export class TodoistClient implements TodoistSource, TodoistWriter {
	constructor(
		private token: string,
		private fetchImpl: typeof fetch = fetch
	) {}

	private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
		// Call fetch unbound: as `this.fetchImpl(...)` the Workers runtime throws
		// "Illegal invocation" because `this` would be the client, not the global scope.
		const doFetch = this.fetchImpl;
		const res = await doFetch(`${BASE}${path}`, {
			...init,
			headers: {
				Authorization: `Bearer ${this.token}`,
				'Content-Type': 'application/json',
				...(init.headers ?? {})
			}
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			throw new TodoistApiError(
				res.status,
				`Todoist ${init.method ?? 'GET'} ${path}: ${res.status} ${text.slice(0, 200)}`
			);
		}
		if (res.status === 204) return undefined as T;
		return (await res.json()) as T;
	}

	private async paginate<T>(path: string, params: Record<string, string>): Promise<T[]> {
		const out: T[] = [];
		let cursor: string | null = null;
		for (let i = 0; i < 50; i++) {
			const qs = new URLSearchParams({ ...params, limit: '200' });
			if (cursor) qs.set('cursor', cursor);
			const page: Page<T> = await this.request<Page<T>>(`${path}?${qs}`);
			out.push(...page.results);
			cursor = page.next_cursor;
			if (!cursor) break;
		}
		return out;
	}

	async findProjectIdByName(name: string): Promise<string | null> {
		const projects = await this.paginate<TodoistProject>('/projects', {});
		const hit = projects.find((p) => p.name.trim().toLowerCase() === name.toLowerCase());
		return hit?.id ?? null;
	}

	listSections(projectId: string): Promise<TodoistSection[]> {
		return this.paginate<TodoistSection>('/sections', { project_id: projectId });
	}

	listTasks(projectId: string): Promise<TodoistTask[]> {
		return this.paginate<TodoistTask>('/tasks', { project_id: projectId });
	}

	getTask(taskId: string): Promise<TodoistTask> {
		return this.request<TodoistTask>(`/tasks/${encodeURIComponent(taskId)}`);
	}

	async setLabels(taskId: string, labels: string[]): Promise<void> {
		await this.request(`/tasks/${encodeURIComponent(taskId)}`, {
			method: 'POST',
			body: JSON.stringify({ labels })
		});
	}

	async addComment(taskId: string, content: string): Promise<void> {
		await this.request('/comments', {
			method: 'POST',
			body: JSON.stringify({ task_id: taskId, content })
		});
	}
}
