import { describe, expect, it } from 'vitest';
import { updatedPhrase } from '../src/lib/format';

// All times are America/New_York. Nov 1, 2026 is when daylight saving ends.
const ago = (now: Date, minutes: number) =>
	new Date(now.getTime() - minutes * 60_000).toISOString();

describe('updatedPhrase', () => {
	// Thursday Nov 5, 2026, 3:00 pm EST.
	const now = new Date('2026-11-05T20:00:00Z');
	const say = (iso: string) => updatedPhrase(iso, now);

	it('counts minutes for the first hour or so', () => {
		expect(say(ago(now, 1))).toBe('Updated just now');
		expect(say(ago(now, 10))).toBe('Updated a few minutes ago');
		expect(say(ago(now, 30))).toBe('Updated about half an hour ago');
		expect(say(ago(now, 70))).toBe('Updated about an hour ago');
	});

	it('names the part of today', () => {
		expect(say('2026-11-05T18:00:00Z')).toBe('Updated earlier this afternoon'); // 1 pm
		expect(say('2026-11-05T14:00:00Z')).toBe('Updated this morning'); // 9 am
	});

	it('says yesterday, last night and late last night', () => {
		expect(say('2026-11-04T21:00:00Z')).toBe('Updated yesterday afternoon'); // Wed 4 pm
		expect(say('2026-11-05T00:30:00Z')).toBe('Updated yesterday evening'); // Wed 7:30 pm
		expect(say('2026-11-05T03:00:00Z')).toBe('Updated last night'); // Wed 10 pm
		expect(say('2026-11-05T06:30:00Z')).toBe('Updated late last night'); // Thu 1:30 am
	});

	it('uses the weekday and a rounded hour within the week', () => {
		// Real Todoist added_at: Tue Nov 3, 11:38 am.
		expect(say('2026-11-03T16:38:04.634606Z')).toBe('Updated Tuesday around noon');
		expect(say('2026-10-31T22:10:00Z')).toBe('Updated Saturday around 6pm'); // 6:10 pm EDT
		expect(say('2026-10-30T13:45:00Z')).toBe('Updated Friday around 10am'); // 9:45 am EDT
	});

	it('gives the part of day and date after a week, with the year only when it differs', () => {
		expect(say('2026-10-21T13:00:00Z')).toBe('Updated the morning of October 21');
		expect(say('2026-10-21T06:00:00Z')).toBe('Updated the early hours of October 21');
		expect(say('2025-12-21T01:00:00Z')).toBe('Updated the evening of December 20, 2025');
	});

	it('keeps last evening as "earlier tonight" for someone up after midnight', () => {
		const late = new Date('2026-11-06T06:00:00Z'); // Fri 1:00 am
		expect(updatedPhrase('2026-11-06T03:30:00Z', late)).toBe('Updated earlier tonight'); // 10:30 pm
		expect(updatedPhrase('2026-11-05T14:00:00Z', late)).toBe('Updated yesterday morning');
	});

	it('is empty for missing or bad input', () => {
		expect(updatedPhrase(null, now)).toBe('');
		expect(updatedPhrase(undefined, now)).toBe('');
		expect(updatedPhrase('not a date', now)).toBe('');
	});
});
