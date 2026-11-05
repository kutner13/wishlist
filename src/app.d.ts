// See https://svelte.dev/docs/kit/types#app.d.ts
/// <reference types="vite/client" />
declare global {
	namespace App {
		interface Locals {
			/** Anonymous per-browser token (cookie) used to let a device undo its own mark. */
			deviceToken: string;
			/** Set on /admin and /api/admin/* after the Cloudflare Access check. */
			adminEmail: string | null;
			/** "" or "/<GUEST_SLUG>": prefix for every guest link. */
			base: string;
		}
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
