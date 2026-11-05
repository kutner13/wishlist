// thekutners.com/list* -> https://wishlist.thekutners.com/* (SPEC §13). Pure, used by src/worker.

const LIST_PATH_RE = /^\/list(\/|$)/;

/** Returns the redirect target, or null when the request is already on the canonical host. */
export function aliasRedirect(requestUrl: string, canonicalHost: string): string | null {
	const canonical = canonicalHost.trim();
	if (!canonical) return null;
	const url = new URL(requestUrl);
	if (url.hostname === canonical || !LIST_PATH_RE.test(url.pathname)) return null;
	const rest = url.pathname.replace(/^\/list/, '');
	const path = rest === '' || rest === '/' ? '/' : rest.startsWith('/') ? rest : `/${rest}`;
	return `https://${canonical}${path}${url.search}`;
}

/**
 * True for a request the `thekutners.com/list*` route catches that is not the alias, such as
 * `thekutners.com/listing`: the Worker hands it back to the apex site's own origin.
 */
export function isAliasPassthrough(requestUrl: string, canonicalHost: string): boolean {
	const canonical = canonicalHost.trim();
	const apex = canonical.split('.').slice(1).join('.');
	if (!apex.includes('.')) return false;
	const url = new URL(requestUrl);
	return (
		url.hostname === apex && url.pathname.startsWith('/list') && !LIST_PATH_RE.test(url.pathname)
	);
}
