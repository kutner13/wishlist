import { describe, expect, it } from 'vitest';
import { TodoistClient } from '../src/lib/server/todoist';

describe('TodoistClient', () => {
	it('calls fetch unbound (the Workers runtime throws "Illegal invocation" otherwise)', async () => {
		const calls: string[] = [];
		// Mimics the Workers brand check: fetch must not be called as a method of another object.
		const strictFetch = function (this: unknown, input: RequestInfo | URL) {
			if (this !== undefined && this !== globalThis) {
				throw new TypeError('Illegal invocation: function called with incorrect `this` reference.');
			}
			calls.push(String(input));
			return Promise.resolve(
				new Response(
					JSON.stringify({ results: [{ id: 's1', name: 'Kev Wishlist' }], next_cursor: null })
				)
			);
		} as unknown as typeof fetch;

		const sections = await new TodoistClient('t', strictFetch).listSections('p1');
		expect(sections.map((s) => s.name)).toEqual(['Kev Wishlist']);
		expect(calls[0]).toContain('/api/v1/sections?');
		expect(calls[0]).toContain('project_id=p1');
	});
});
