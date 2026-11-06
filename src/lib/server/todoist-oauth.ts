// One-time Todoist OAuth that turns webhooks on for the owner's account. Todoist only sends
// webhooks for users who have authorized the app, so the owner opens /api/todoist/oauth/start
// once and taps Agree. The token Todoist returns is not stored: the sync keeps using the
// personal API token (TODOIST_TOKEN).

const AUTHORIZE_URL = 'https://todoist.com/oauth/authorize';
const TOKEN_URL = 'https://todoist.com/oauth/access_token';
const STATE_LABEL = 'wishlist-todoist-oauth';

/** Anti-forgery `state`: an HMAC of a fixed label with the client secret. */
export async function oauthState(clientSecret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(clientSecret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(STATE_LABEL));
	return [...new Uint8Array(sig)]
		.slice(0, 16)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export function authorizeUrl(clientId: string, state: string): string {
	const u = new URL(AUTHORIZE_URL);
	u.searchParams.set('client_id', clientId);
	u.searchParams.set('scope', 'data:read');
	u.searchParams.set('state', state);
	return u.toString();
}

export type ExchangeResult = { ok: true } | { ok: false; status: number; error: string };

/** Trades the authorization code for a token, which completes the authorization. */
export async function exchangeCode(
	clientId: string,
	clientSecret: string,
	code: string,
	fetchImpl: typeof fetch = fetch
): Promise<ExchangeResult> {
	const doFetch = fetchImpl; // called unbound; see the note in todoist.ts
	let res: Response;
	try {
		res = await doFetch(TOKEN_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code })
		});
	} catch (e) {
		return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
	}
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		return { ok: false, status: res.status, error: text.slice(0, 200) };
	}
	const body = (await res.json().catch(() => null)) as { access_token?: string } | null;
	return body?.access_token
		? { ok: true }
		: { ok: false, status: res.status, error: 'Todoist returned no access token' };
}

/** A small standalone page for the owner's phone. */
export function oauthPage(title: string, message: string, status = 200): Response {
	const esc = (s: string) =>
		s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>body{margin:0;font:17px/1.5 system-ui,sans-serif;background:#f3ece2;color:#2b2622}
main{max-width:30rem;margin:18vh auto;padding:0 20px}h1{font-size:1.5rem;margin:0 0 .5rem}
a{color:#b4471d}</style></head><body><main><h1>${esc(title)}</h1><p>${esc(message)}</p>
<p><a href="/">Back to the wishlist</a></p></main></body></html>`;
	return new Response(html, {
		status,
		headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
	});
}
