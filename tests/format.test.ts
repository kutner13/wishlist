import { describe, expect, it } from 'vitest';
import { dateTime } from '../src/lib/format';

describe('dateTime', () => {
	it('shows the date and time in Eastern time with the right abbreviation', () => {
		// Real added_at of a Purchases task (Todoist sends microseconds).
		expect(dateTime('2026-11-03T16:38:04.634606Z')).toBe('Nov 3, 2026 at 11:38 AM EST');
		expect(dateTime('2026-07-04T16:00:00.000Z')).toBe('Jul 4, 2026 at 12:00 PM EDT');
	});
	it('uses the Eastern date when UTC has already rolled over', () => {
		expect(dateTime('2026-11-05T03:30:00Z')).toBe('Nov 4, 2026 at 10:30 PM EST');
	});
	it('returns an empty string for missing or bad input', () => {
		expect(dateTime(null)).toBe('');
		expect(dateTime(undefined)).toBe('');
		expect(dateTime('not a date')).toBe('');
	});
});
