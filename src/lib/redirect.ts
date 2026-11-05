// thekutners.com/list* -> https://wishlist.thekutners.com/* (SPEC §13). Pure, used by src/worker.

/** Returns the redirect target, or null when the request is already on the canonical host. */
export function aliasRedirect(requestUrl: string, canonicalHost: string): string | null {
	const canonical = canonicalHost.trim();
	if (!canonical) return null;
	const url = new URL(requestUrl);
	if (url.hostname === canonical || !url.pathname.startsWith('/list')) return null;
	const rest = url.pathname.replace(/^\/list/, '');
	const path = rest === '' || rest === '/' ? '/' : rest.startsWith('/') ? rest : `/${rest}`;
	return `https://${canonical}${path}${url.search}`;
}
