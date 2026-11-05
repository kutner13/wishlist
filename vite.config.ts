import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter({
				// Build output goes where wrangler.kit.jsonc says; bindings for local dev come from wrangler.jsonc.
				config: 'wrangler.kit.jsonc',
				platformProxy: { configPath: 'wrangler.jsonc', persist: { path: '.wrangler/state/v3' } }
			}),
			// Routes are resolved on the server so the optional GUEST_SLUG rewrite (src/hooks.ts)
			// only has to know the slug on the server.
			router: { resolution: 'server' }
		})
	],
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node'
	}
});
