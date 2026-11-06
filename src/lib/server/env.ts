// The only place that touches the Cloudflare bindings. Everything else takes a Db etc.
import { env, waitUntil } from 'cloudflare:workers';
import { d1Db, type Db } from './db';
import { r2ImageStore, type ImageStore } from './images';
import { TodoistClient } from './todoist';

export interface Bindings {
	DB: D1Database;
	IMAGES: R2Bucket;
	ASSETS?: Fetcher;
	TODOIST_TOKEN?: string;
	TODOIST_PROJECT_ID?: string;
	/** The Todoist app's client secret: signs webhooks and completes the one-time OAuth. */
	TODOIST_WEBHOOK_SECRET?: string;
	/** The Todoist app's client ID, for the one-time OAuth that turns webhooks on. */
	TODOIST_CLIENT_ID?: string;
	OFFERS_API_KEY?: string;
	CF_ACCESS_AUD?: string;
	CF_ACCESS_TEAM_DOMAIN?: string;
	GUEST_SLUG?: string;
	DEV_BYPASS_ACCESS?: string;
	CANONICAL_HOST?: string;
}

export function bindings(): Bindings {
	return env as unknown as Bindings;
}

export function db(): Db {
	return d1Db(bindings().DB);
}

export function images(): ImageStore {
	return r2ImageStore(bindings().IMAGES);
}

export function todoist(): TodoistClient | null {
	const token = bindings().TODOIST_TOKEN;
	return token ? new TodoistClient(token) : null;
}

export function secret(name: keyof Bindings): string {
	const v = bindings()[name];
	return typeof v === 'string' ? v.trim() : '';
}

/** Runs work after the response is sent (no-op tracking in vite dev, but the promise still runs). */
export function background(task: Promise<unknown>) {
	waitUntil(task.catch((e) => console.error('background task failed', e)));
}
