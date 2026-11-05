import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { metaContent, parsePageMeta, productJsonLd } from '../src/lib/server/pagemeta';

const fixture = (name: string) =>
	readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('parsePageMeta', () => {
	it('prefers JSON-LD Product price, og:image, og:title; decodes entities', () => {
		const m = parsePageMeta(
			fixture('product-page.html'),
			'https://www.lego.com/en-us/product/rally-car-42077'
		);
		expect(m.priceCents).toBe(4249);
		expect(m.currency).toBe('USD');
		expect(m.image).toBe(
			'https://www.lego.com/cdn/cs/set/assets/blt1234/42077.png?fit=bounds&format=png&width=800'
		);
		expect(m.title).toBe('Rally Car 42077 | Technic™ | Buy online at the Official LEGO® Shop US');
	});

	it('falls back to product:price:amount when there is no JSON-LD', () => {
		const html = fixture('product-page.html').replace(/<script[\s\S]*?<\/script>/, '');
		const m = parsePageMeta(html);
		expect(m.priceCents).toBe(4499);
		expect(m.currency).toBe('USD');
	});

	it('resolves relative images, handles name= attributes, and reports no price', () => {
		const m = parsePageMeta(fixture('og-only.html'), 'https://shop.example/p/binoculars');
		expect(m.image).toBe('https://shop.example/images/binoculars.jpg');
		expect(m.title).toBe("Kids' binoculars & case");
		expect(m.priceCents).toBeNull();
		expect(m.currency).toBeNull();
	});

	it('metaContent matches either attribute order and is case-insensitive', () => {
		expect(metaContent('<META PROPERTY="og:image" CONTENT="x.png">', 'og:image')).toBe('x.png');
		expect(metaContent('<meta content="y.png" property="og:image"/>', 'og:image')).toBe('y.png');
		expect(metaContent('<meta property="og:image:width" content="1">', 'og:image')).toBeNull();
	});

	it('productJsonLd walks @graph and arrays, ignores broken JSON', () => {
		const html = `
			<script type="application/ld+json">{ not json</script>
			<script type="application/ld+json">[{"@type":["Thing","Product"],"name":"N","offers":[{"lowPrice":"9.5","priceCurrency":"eur"}]}]</script>`;
		expect(productJsonLd(html)).toEqual({ price: 950, currency: 'eur', image: null, name: 'N' });
		expect(parsePageMeta(html).currency).toBe('EUR');
		expect(productJsonLd('<p>nothing</p>')).toBeNull();
	});
});
