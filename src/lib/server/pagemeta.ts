// Extracts image/title/price from a product page's HTML: Open Graph, `product:price:amount`,
// and schema.org Product JSON-LD. Regex-based on purpose (no DOM in the Worker). Pure.
import { parsePrice } from '#lib/parse';

export interface PageMeta {
	image: string | null;
	title: string | null;
	priceCents: number | null;
	currency: string | null;
}

function decodeEntities(s: string): string {
	return s
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>');
}

/** Finds <meta ... property|name="key" ... content="..."> in either attribute order. */
export function metaContent(html: string, key: string): string | null {
	const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const re = new RegExp(
		`<meta\\s+(?:[^>]*?\\s)?(?:property|name|itemprop)\\s*=\\s*["']${k}["'][^>]*?\\scontent\\s*=\\s*["']([^"']*)["']|` +
			`<meta\\s+(?:[^>]*?\\s)?content\\s*=\\s*["']([^"']*)["'][^>]*?\\s(?:property|name|itemprop)\\s*=\\s*["']${k}["']`,
		'i'
	);
	const m = html.match(re);
	const v = m?.[1] ?? m?.[2];
	return v ? decodeEntities(v).trim() : null;
}

interface LdOffer {
	price?: string | number;
	lowPrice?: string | number;
	priceCurrency?: string;
}
interface LdNode {
	'@type'?: string | string[];
	'@graph'?: LdNode[];
	offers?: LdOffer | LdOffer[];
	image?: string | string[] | { url?: string } | { url?: string }[];
	name?: string;
}

function isProduct(node: LdNode): boolean {
	const t = node['@type'];
	return Array.isArray(t) ? t.includes('Product') : t === 'Product';
}

function* walk(node: unknown): Generator<LdNode> {
	if (!node || typeof node !== 'object') return;
	if (Array.isArray(node)) {
		for (const n of node) yield* walk(n);
		return;
	}
	const obj = node as LdNode;
	yield obj;
	if (obj['@graph']) yield* walk(obj['@graph']);
}

function ldImage(image: LdNode['image']): string | null {
	if (!image) return null;
	const first = Array.isArray(image) ? image[0] : image;
	if (!first) return null;
	return typeof first === 'string' ? first : (first.url ?? null);
}

/** First schema.org Product found in any JSON-LD block. */
export function productJsonLd(html: string): {
	price: number | null;
	currency: string | null;
	image: string | null;
	name: string | null;
} | null {
	const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
	for (const m of html.matchAll(re)) {
		let data: unknown;
		try {
			data = JSON.parse(m[1].trim());
		} catch {
			continue;
		}
		for (const node of walk(data)) {
			if (!isProduct(node)) continue;
			const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
			const raw = offers?.price ?? offers?.lowPrice;
			const price = raw === undefined || raw === null ? null : parsePrice(String(raw));
			return {
				price,
				currency: offers?.priceCurrency ?? null,
				image: ldImage(node.image),
				name: node.name ?? null
			};
		}
	}
	return null;
}

export function parsePageMeta(html: string, pageUrl?: string): PageMeta {
	const ld = productJsonLd(html);
	let image =
		metaContent(html, 'og:image') ?? metaContent(html, 'og:image:secure_url') ?? ld?.image;
	const title = metaContent(html, 'og:title') ?? ld?.name ?? titleTag(html);
	let priceCents = ld?.price ?? null;
	let currency = ld?.currency ?? null;
	if (priceCents === null) {
		const amount =
			metaContent(html, 'product:price:amount') ?? metaContent(html, 'og:price:amount');
		if (amount) {
			priceCents = parsePrice(amount);
			currency =
				metaContent(html, 'product:price:currency') ?? metaContent(html, 'og:price:currency');
		}
	}
	if (image && pageUrl) {
		try {
			image = new URL(image, pageUrl).toString();
		} catch {
			image = null;
		}
	}
	return {
		image: image ?? null,
		title,
		priceCents,
		currency: currency ? currency.toUpperCase() : priceCents !== null ? 'USD' : null
	};
}

function titleTag(html: string): string | null {
	const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
	return m ? decodeEntities(m[1]).trim() : null;
}
