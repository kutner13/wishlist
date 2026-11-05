import { describe, expect, it } from 'vitest';
import { mapSections, matchSectionToPerson, personBySlug } from '../src/lib/people';

describe('matchSectionToPerson', () => {
	it('matches plain names and "<Name> Wishlist", case-insensitively', () => {
		expect(matchSectionToPerson('Kevin')?.slug).toBe('kevin');
		expect(matchSectionToPerson('Kev Wishlist')?.slug).toBe('kevin');
		expect(matchSectionToPerson('CASEY wishlist')?.slug).toBe('casey');
		expect(matchSectionToPerson('Robbie Wish List')?.slug).toBe('robbie');
		expect(matchSectionToPerson("Logan's list")?.slug).toBe('logan');
	});
	it('ignores unrelated sections', () => {
		expect(matchSectionToPerson('House')).toBeNull();
		expect(matchSectionToPerson('Wishlist')).toBeNull();
		expect(matchSectionToPerson('')).toBeNull();
		expect(matchSectionToPerson('Kevin and Casey')).toBeNull();
	});
	it('mapSections keeps the first section per person', () => {
		const m = mapSections([
			{ id: '1', name: 'Kev Wishlist' },
			{ id: '2', name: 'Kevin' },
			{ id: '3', name: 'Garage' }
		]);
		expect([...m.keys()]).toEqual(['1']);
		expect(m.get('1')?.name).toBe('Kevin');
	});
	it('personBySlug', () => {
		expect(personBySlug('robbie')?.id).toBe(3);
		expect(personBySlug('nobody')).toBeUndefined();
	});
});
