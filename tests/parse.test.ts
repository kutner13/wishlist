import { describe, expect, it } from 'vitest';
import {
	extractUrls,
	hostnameOf,
	parseDescription,
	parsePrice,
	parseTask,
	priorityToDesire
} from '../src/lib/parse';

describe('parseDescription', () => {
	it('parses lenient hints and strips them from notes', () => {
		const h = parseDescription(
			'Blue one please\nPrice : $45.50\nQTY=2\n  occasion: Birthday \nSize: youth M\nColour: navy blue\nenriched: 2026-11-04 (unsure)'
		);
		expect(h.aboutPriceCents).toBe(4550);
		expect(h.qty).toBe(2);
		expect(h.occasion).toBe('birthday');
		expect(h.size).toBe('youth M');
		expect(h.color).toBe('navy blue');
		expect(h.enrichedAt).toBe('2026-11-04');
		expect(h.notes).toBe('Blue one please');
	});

	it('defaults when hints are missing or malformed', () => {
		const h = parseDescription('price: cheap\nqty: zero\noccasion: wedding\nenriched: soon');
		expect(h.aboutPriceCents).toBeNull();
		expect(h.qty).toBe(1);
		expect(h.occasion).toBe('any');
		expect(h.enrichedAt).toBeNull();
		// Unrecognised hint lines stay in the notes so nothing silently disappears.
		expect(h.notes).toContain('price: cheap');
	});

	it('accepts "holiday" and "xmas"-ish spellings and price ranges', () => {
		expect(parseDescription('occasion: Holiday').occasion).toBe('holidays');
		expect(parseDescription('price: 80-120').aboutPriceCents).toBe(8000);
		expect(parsePrice('1,299.99')).toBe(129999);
		expect(parsePrice('USD 20')).toBe(2000);
	});
});

describe('extractUrls', () => {
	it('finds URLs in order, strips trailing punctuation, dedupes', () => {
		const urls = extractUrls(
			'See https://www.lego.com/en-us/product/rally-car-42077. Also (https://target.com/p/x?a=1&b=2), and https://www.lego.com/en-us/product/rally-car-42077'
		);
		expect(urls).toEqual([
			'https://www.lego.com/en-us/product/rally-car-42077',
			'https://target.com/p/x?a=1&b=2'
		]);
	});
	it('returns [] with no URLs', () => {
		expect(extractUrls('nothing here')).toEqual([]);
	});
	it('hostnameOf drops www', () => {
		expect(hostnameOf('https://www.target.com/p/1')).toBe('target.com');
		expect(hostnameOf('not a url')).toBe('not a url');
	});
});

describe('parseTask', () => {
	const base = {
		id: 't1',
		content: ' Thing ',
		description: '',
		priority: 1,
		labels: [],
		section_id: 's'
	};

	it('maps Todoist API priority to desire', () => {
		expect(priorityToDesire(4)).toBe(1);
		expect(priorityToDesire(3)).toBe(2);
		expect(priorityToDesire(2)).toBe(3);
		expect(priorityToDesire(1)).toBe(4);
		expect(priorityToDesire(0)).toBe(4);
	});

	it('first URL is the product link, the rest are extra, URL-only lines leave the notes', () => {
		const p = parseTask({
			...base,
			description: 'Notes line\nhttps://a.example/p\nhttps://b.example/q'
		});
		expect(p.productUrl).toBe('https://a.example/p');
		expect(p.extraUrls).toEqual(['https://b.example/q']);
		expect(p.notes).toBe('Notes line\nhttps://b.example/q');
		expect(p.name).toBe('Thing');
	});

	it('separates control labels from categories', () => {
		const p = parseTask({ ...base, labels: ['Toys', 'bought', 'hidden'] });
		expect(p.categories).toEqual(['toys']);
		expect(p.boughtInTodoist).toBe(true);
		expect(p.hidden).toBe(true);
	});

	it('treats "Profile…" tasks as hidden', () => {
		expect(parseTask({ ...base, content: 'Profile: Logan' }).hidden).toBe(true);
		expect(parseTask({ ...base, content: 'PROFILE Kevin' }).hidden).toBe(true);
		expect(parseTask({ ...base, content: 'Profiler book' }).hidden).toBe(true);
		expect(parseTask({ ...base, content: 'Low-profile hat' }).hidden).toBe(false);
	});
});
