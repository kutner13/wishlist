// Pure parsing of a Todoist task into wishlist fields (SPEC §3). No I/O.
import {
	LABEL_BOUGHT,
	LABEL_HIDDEN,
	OCCASIONS,
	PROFILE_TASK_PREFIX,
	type Occasion
} from './config';

const URL_RE = /https?:\/\/[^\s<>()"']+/gi;
const HINT_RE = /^\s*(price|qty|quantity|occasion|enriched|size|colou?r)\s*[:=]\s*(.+?)\s*$/i;
// Todoist stores pasted links as `[title](url)` (the iOS app and the Safari share sheet both
// do this) and bold as `**text**`. The site shows plain text, so these are unwrapped.
const MD_LINK_RE = /\[([^\]\n]*)\]\((https?:\/\/[^\s<>()"']+)\)/gi;
const MD_LINK_LINE_RE = /^\[[^\]\n]*\]\((https?:\/\/[^\s<>()"']+)\)$/i;

/** Markdown links become their title (or the URL if untitled); `**bold**` loses its markers. */
export function plainText(text: string): string {
	return text
		.replace(MD_LINK_RE, (_m, label: string, url: string) => label.trim() || url)
		.replace(/\*\*(.+?)\*\*/g, '$1');
}

/** True when the line is nothing but one link, bare or as a markdown link. */
function isLinkOnly(line: string): boolean {
	const t = line.trim();
	if (!t) return false;
	if (MD_LINK_LINE_RE.test(t)) return true;
	const urls = extractUrls(t);
	return urls.length === 1 && t.replace(/[.,;:!?)\]]+$/, '') === urls[0];
}

// Query parameters that only track where a click came from; they never pick the product.
const TRACKING_PARAM_RE =
	/^(utm_.*|_ref|ref|ref_|psc|smid|tag|th|linkcode|camp|creative|creativeasin|gclid|fbclid|msclkid|mc_cid|mc_eid|pd_rd_.*|pf_rd_.*|qid|sr|crid|sprefix|keywords|content-id)$/i;

/**
 * The same value for two links to the same product: host without www, path without a
 * trailing slash, and only the query parameters that matter. Amazon links reduce to the
 * product's ASIN, so /gp/product/X/ref=… and /dp/X match.
 */
export function productKey(url: string): string {
	let u: URL;
	try {
		u = new URL(url);
	} catch {
		return url;
	}
	const host = u.hostname.toLowerCase().replace(/^www\./, '');
	if (/(^|\.)amazon\.[a-z.]+$/.test(host)) {
		const m = u.pathname.match(
			/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/([A-Z0-9]{10})/i
		);
		if (m) return `amazon:${m[1].toUpperCase()}`;
	}
	const params = [...u.searchParams]
		.filter(([k]) => !TRACKING_PARAM_RE.test(k))
		.sort(([a], [b]) => a.localeCompare(b));
	const query = new URLSearchParams(params).toString();
	return `${host}${u.pathname.replace(/\/+$/, '')}${query ? `?${query}` : ''}`;
}

/** Drops later links to a product already listed, keeping the first spelling. */
function uniqueProducts(urls: string[]): string[] {
	const seen = new Set<string>();
	return urls.filter((url) => {
		const key = productKey(url);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export interface DescriptionHints {
	aboutPriceCents: number | null;
	qty: number;
	occasion: Occasion;
	enrichedAt: string | null;
	size: string | null;
	color: string | null;
	/** Description with hint lines removed. */
	notes: string;
}

/** All http(s) URLs in the text, in order, with trailing punctuation stripped. */
export function extractUrls(text: string): string[] {
	const out: string[] = [];
	for (const m of text.matchAll(URL_RE)) {
		const url = m[0].replace(/[.,;:!?)\]]+$/, '');
		if (!out.includes(url)) out.push(url);
	}
	return out;
}

export function parsePrice(raw: string): number | null {
	const cleaned = raw.replace(/[$,\s]/g, '').replace(/^(usd|us)/i, '');
	const m = cleaned.match(/^(\d+)(?:\.(\d{1,2}))?/);
	if (!m) return null;
	const dollars = Number(m[1]);
	const cents = m[2] ? Number(m[2].padEnd(2, '0')) : 0;
	return dollars * 100 + cents;
}

function parseDate(raw: string): string | null {
	const m = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
	if (!m) return null;
	const [, y, mo, d] = m;
	const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
	return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** Parses the lenient `key: value` hint lines out of a description. */
export function parseDescription(description: string): DescriptionHints {
	const hints: DescriptionHints = {
		aboutPriceCents: null,
		qty: 1,
		occasion: 'any',
		enrichedAt: null,
		size: null,
		color: null,
		notes: ''
	};
	const kept: string[] = [];
	for (const line of (description ?? '').split(/\r?\n/)) {
		const m = line.match(HINT_RE);
		if (!m) {
			kept.push(line);
			continue;
		}
		const key = m[1].toLowerCase();
		const value = m[2];
		let recognised = true;
		if (key === 'price') {
			const cents = parsePrice(value);
			if (cents === null) recognised = false;
			else hints.aboutPriceCents = cents;
		} else if (key === 'qty' || key === 'quantity') {
			const n = parseInt(value, 10);
			if (Number.isNaN(n) || n < 1) recognised = false;
			else hints.qty = Math.min(n, 99);
		} else if (key === 'occasion') {
			const v = value.toLowerCase().replace(/[^a-z]/g, '');
			const match = OCCASIONS.find((o) => o === v || v.startsWith(o.slice(0, 5)));
			if (!match) recognised = false;
			else hints.occasion = match;
		} else if (key === 'enriched') {
			const d = parseDate(value);
			if (!d) recognised = false;
			else hints.enrichedAt = d;
		} else if (key === 'size') {
			hints.size = value;
		} else {
			hints.color = value;
		}
		if (!recognised) kept.push(line);
	}
	hints.notes = kept.join('\n').trim();
	return hints;
}

export interface TodoistTaskLike {
	id: string;
	content: string;
	description: string;
	/** Todoist API priority: 4 = p1 (highest) ... 1 = p4 (none). */
	priority: number;
	labels: string[];
	section_id: string | null;
	added_at?: string | null;
}

export interface ParsedItem {
	todoistTaskId: string;
	name: string;
	notes: string;
	productUrl: string | null;
	/** Extra URLs beyond the first; become manual offers. */
	extraUrls: string[];
	desire: 1 | 2 | 3 | 4;
	aboutPriceCents: number | null;
	qty: number;
	occasion: Occasion;
	enrichedAt: string | null;
	size: string | null;
	color: string | null;
	categories: string[];
	hidden: boolean;
	boughtInTodoist: boolean;
}

/** Todoist API priority 4 (p1) -> desire 1, ... 1 (p4) -> 4. */
export function priorityToDesire(priority: number): 1 | 2 | 3 | 4 {
	const d = 5 - Math.min(4, Math.max(1, Math.round(priority || 1)));
	return d as 1 | 2 | 3 | 4;
}

export function parseTask(task: TodoistTaskLike): ParsedItem {
	const hints = parseDescription(task.description ?? '');
	// A link in the task name (Safari share sheet: "[Page title](url)") counts as the product
	// link, ahead of any in the description.
	// Links to the same product (tracking codes aside) count once.
	const urls = uniqueProducts([
		...extractUrls(task.content ?? ''),
		...extractUrls(task.description ?? '')
	]);
	const [productUrl = null, ...extraUrls] = urls;
	// Lines that are only a link leave the notes: every link is already shown as the product
	// link or a "where to buy" entry.
	const notes = hints.notes
		.split('\n')
		.filter((l) => !isLinkOnly(l))
		.map(plainText)
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	const labels = (task.labels ?? []).map((l) => l.toLowerCase());
	const name = plainText(task.content ?? '').trim();
	return {
		todoistTaskId: task.id,
		name,
		notes,
		productUrl,
		extraUrls,
		desire: priorityToDesire(task.priority),
		aboutPriceCents: hints.aboutPriceCents,
		qty: hints.qty,
		occasion: hints.occasion,
		enrichedAt: hints.enrichedAt,
		size: hints.size,
		color: hints.color,
		categories: labels.filter((l) => l !== LABEL_BOUGHT && l !== LABEL_HIDDEN),
		hidden: labels.includes(LABEL_HIDDEN) || name.toLowerCase().startsWith(PROFILE_TASK_PREFIX),
		boughtInTodoist: labels.includes(LABEL_BOUGHT)
	};
}

export function hostnameOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}
