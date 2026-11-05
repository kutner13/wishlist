import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { error } from '@sveltejs/kit';
import { verifyAccessJwt } from '#lib/server/access';
import { secret } from '#lib/server/env';
import { getGuestSlug, isGuestPath, setGuestSlug } from '#lib/guest-slug';

const DEVICE_COOKIE = 'wl_device';

export const init: ServerInit = () => {
	setGuestSlug(secret('GUEST_SLUG'));
};

function isLocalHost(url: URL) {
	return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
}

/**
 * True for `vite dev` / `wrangler dev` requests. `wrangler dev` rewrites the hostname to the
 * configured route and sets cf-connecting-ip to the loopback address; real edge requests always
 * carry a cf-ray and a public cf-connecting-ip, so the bypass can never apply in production.
 */
function isLocalRequest(request: Request, url: URL) {
	if (isLocalHost(url)) return true;
	const ip = request.headers.get('cf-connecting-ip');
	return !request.headers.has('cf-ray') && (!ip || ip === '127.0.0.1' || ip === '::1');
}

export const handle: Handle = async ({ event, resolve }) => {
	const { url, request, cookies, locals } = event;
	const slug = getGuestSlug();
	locals.base = slug ? `/${slug}` : '';

	// Guest slug: `event.url` is already rewritten by `reroute`; the original request must
	// have carried the prefix or we 404 (SPEC §13).
	if (slug && isGuestPath(url.pathname)) {
		const original = new URL(request.url).pathname;
		if (original !== `/${slug}` && !original.startsWith(`/${slug}/`)) {
			error(404, 'Not found');
		}
	}

	const isAdmin =
		url.pathname === '/admin' ||
		url.pathname.startsWith('/admin/') ||
		url.pathname.startsWith('/api/admin');
	locals.adminEmail = null;
	if (isAdmin) {
		locals.adminEmail = await authenticateAdmin(request, url);
		if (!locals.adminEmail) error(403, 'Owner login required (Cloudflare Access)');
	}

	// Anonymous device token so a browser can undo its own mark without a confirm.
	let token = cookies.get(DEVICE_COOKIE);
	if (!token || !/^[0-9a-f-]{20,64}$/.test(token)) {
		token = crypto.randomUUID();
		cookies.set(DEVICE_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !isLocalHost(url),
			maxAge: 400 * 24 * 3600
		});
	}
	locals.deviceToken = token;

	const response = await resolve(event);
	// Unlisted site: never indexed (SPEC §2).
	response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	if (isAdmin) response.headers.set('Cache-Control', 'no-store');
	return response;
};

/** Verifies the Cloudflare Access JWT; returns the email or null. Fails closed. */
async function authenticateAdmin(request: Request, url: URL): Promise<string | null> {
	if (secret('DEV_BYPASS_ACCESS') === '1' && isLocalRequest(request, url)) return 'dev@localhost';
	const token =
		request.headers.get('Cf-Access-Jwt-Assertion') ??
		request.headers.get('cookie')?.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1] ??
		null;
	const identity = await verifyAccessJwt(token, {
		teamDomain: secret('CF_ACCESS_TEAM_DOMAIN'),
		audience: secret('CF_ACCESS_AUD')
	});
	return identity ? (identity.email ?? 'owner') : null;
}
