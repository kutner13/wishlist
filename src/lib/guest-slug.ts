// Holds the optional GUEST_SLUG for the universal `reroute` hook. Set once on the server
// by hooks.server.ts `init`; stays undefined in the browser (routes resolve on the server).
let slug: string | undefined;

export function setGuestSlug(value: string | undefined) {
	slug =
		value
			?.trim()
			.replace(/^\/+|\/+$/g, '')
			.trim() || undefined;
}

export function getGuestSlug(): string | undefined {
	return slug;
}

/** Paths that are never behind the guest slug. */
export function isGuestPath(pathname: string): boolean {
	return !/^\/(admin|api|img|_app|icons|service-worker\.js|manifest\.webmanifest|favicon|robots\.txt)/.test(
		pathname
	);
}

/** Rewrites "/<slug>/x" to "/x"; returns undefined when the path is not slug-prefixed. */
export function stripGuestSlug(pathname: string, slug: string): string | undefined {
	if (pathname === `/${slug}`) return '/';
	if (pathname.startsWith(`/${slug}/`)) return pathname.slice(slug.length + 1);
	return undefined;
}
