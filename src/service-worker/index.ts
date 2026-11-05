// Minimal PWA service worker: caches the built assets and static files only.
// Pages and images always go to the network so purchase state is never stale.
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `wishlist-${version}`;
const ASSETS = [...immutable, ...assets].map((a) => a.path);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	if (url.origin !== location.origin || !ASSETS.includes(url.pathname)) return;
	event.respondWith(
		caches
			.open(CACHE)
			.then(async (cache) => (await cache.match(url.pathname)) ?? fetch(event.request))
	);
});
