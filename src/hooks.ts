import type { Reroute } from '@sveltejs/kit/hooks';
import { getGuestSlug, isGuestPath, stripGuestSlug } from '#lib/guest-slug';

// When GUEST_SLUG is set, guest pages are served at /<slug>/... while the route files stay
// slug-free. The slug is only known on the server (see hooks.server.ts `init`); route
// resolution is configured as 'server' in vite.config.ts so client navigations go through here too.
export const reroute: Reroute = ({ url }) => {
	const slug = getGuestSlug();
	if (!slug || !isGuestPath(url.pathname)) return;
	return stripGuestSlug(url.pathname, slug);
};
