// Row shapes and view models shared by server code and pages.
import type { Occasion } from './config';

export interface PersonRow {
	id: number;
	name: string;
	slug: string;
	todoist_section_id: string | null;
	sort_order: number;
}

export interface ItemRow {
	id: number;
	person_id: number;
	todoist_task_id: string;
	name: string;
	notes: string;
	product_url: string | null;
	image_key: string | null;
	desire: number;
	about_price_cents: number | null;
	qty: number;
	occasion: Occasion;
	categories: string;
	size: string | null;
	color: string | null;
	enriched_at: string | null;
	hidden: number;
	bought_in_todoist: number;
	created_at: string;
	updated_at: string;
	removed_at: string | null;
	page_checked_at: string | null;
}

export type OfferSource = 'page' | 'claude' | 'manual';

export interface OfferRow {
	id: number;
	item_id: number;
	source: OfferSource;
	store: string;
	price_cents: number | null;
	currency: string;
	url: string | null;
	note: string | null;
	fetched_at: string;
	is_best: number;
}

export interface PurchaseRow {
	id: number;
	item_id: number;
	device_token: string;
	created_at: string;
	released_at: string | null;
}

export type OutboxAction = 'add_label' | 'remove_label' | 'comment';

export interface OutboxRow {
	id: number;
	item_id: number;
	action: OutboxAction;
	payload: string;
	attempts: number;
	last_error: string | null;
	next_attempt_at: string;
	created_at: string;
	done_at: string | null;
}

export interface SyncRunRow {
	id: number;
	kind: string;
	started_at: string;
	finished_at: string | null;
	ok: number | null;
	error: string | null;
	detail: string | null;
}

/** What the pages render for one item. */
export interface ItemView {
	id: number;
	personSlug: string;
	name: string;
	notes: string;
	productUrl: string | null;
	imageUrl: string | null;
	desire: number;
	desireLabel: string | null;
	aboutPriceCents: number | null;
	qty: number;
	occasion: Occasion;
	categories: string[];
	size: string | null;
	color: string | null;
	enrichedAt: string | null;
	createdAt: string;
	/** Active (unreleased) purchases. */
	purchasedCount: number;
	/** Fully purchased: label in Todoist or purchasedCount >= qty. */
	purchased: boolean;
	boughtInTodoist: boolean;
	/** Best offer price, else about-price, else null. */
	headlinePriceCents: number | null;
	headlineIsEstimate: boolean;
	bestOffer: OfferView | null;
	offers: OfferView[];
}

export interface OfferView {
	id: number;
	source: OfferSource;
	store: string;
	priceCents: number | null;
	currency: string;
	url: string | null;
	note: string | null;
	fetchedAt: string;
	isBest: boolean;
}
