import { describe, expect, it } from 'vitest';
import { authorizeUrl, exchangeCode, oauthPage, oauthState } from '../src/lib/server/todoist-oauth';

describe('Todoist OAuth', () => {
	it('derives a stable state from the client secret', async () => {
		const a = await oauthState('secret-a');
		expect(a).toMatch(/^[0-9a-f]{32}$/);
		expect(await oauthState('secret-a')).toBe(a);
		expect(await oauthState('secret-b')).not.toBe(a);
	});

	it('builds the authorize URL with read-only scope', () => {
		const u = new URL(authorizeUrl('cid123', 'st'));
		expect(u.origin + u.pathname).toBe('https://todoist.com/oauth/authorize');
		expect(u.searchParams.get('client_id')).toBe('cid123');
		expect(u.searchParams.get('scope')).toBe('data:read');
		expect(u.searchParams.get('state')).toBe('st');
	});

	it('posts the code with the client credentials and calls fetch unbound', async () => {
		let sent: { url: string; body: string } | null = null;
		const strictFetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
			if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
			sent = { url: String(input), body: String(init?.body) };
			return Promise.resolve(new Response(JSON.stringify({ access_token: 'tok' })));
		} as unknown as typeof fetch;

		expect(await exchangeCode('cid', 'csecret', 'thecode', strictFetch)).toEqual({ ok: true });
		expect(sent!.url).toBe('https://todoist.com/oauth/access_token');
		const body = new URLSearchParams(sent!.body);
		expect(body.get('client_id')).toBe('cid');
		expect(body.get('client_secret')).toBe('csecret');
		expect(body.get('code')).toBe('thecode');
	});

	it('reports Todoist errors and network failures', async () => {
		const bad = (() =>
			Promise.resolve(
				new Response('bad_verification_code', { status: 400 })
			)) as unknown as typeof fetch;
		expect(await exchangeCode('c', 's', 'x', bad)).toEqual({
			ok: false,
			status: 400,
			error: 'bad_verification_code'
		});
		const down = (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
		expect(await exchangeCode('c', 's', 'x', down)).toEqual({
			ok: false,
			status: 0,
			error: 'offline'
		});
	});

	it('escapes text on the result page', async () => {
		const res = oauthPage('A <b>', 'x & "y"', 400);
		expect(res.status).toBe(400);
		const html = await res.text();
		expect(html).toContain('A &lt;b&gt;');
		expect(html).toContain('x &amp; &quot;y&quot;');
	});
});
