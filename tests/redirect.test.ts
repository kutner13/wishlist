import { describe, expect, it } from 'vitest';
import { aliasRedirect } from '../src/lib/redirect';

describe('aliasRedirect', () => {
	const host = 'wishlist.thekutners.com';
	it('strips the /list prefix and keeps the rest of the path and query', () => {
		expect(aliasRedirect('https://thekutners.com/list', host)).toBe(
			'https://wishlist.thekutners.com/'
		);
		expect(aliasRedirect('https://thekutners.com/list/', host)).toBe(
			'https://wishlist.thekutners.com/'
		);
		expect(aliasRedirect('https://thekutners.com/list/robbie/12?all=1', host)).toBe(
			'https://wishlist.thekutners.com/robbie/12?all=1'
		);
	});
	it('does nothing on the canonical host or for other paths', () => {
		expect(aliasRedirect('https://wishlist.thekutners.com/list/robbie', host)).toBeNull();
		expect(aliasRedirect('https://thekutners.com/blog', host)).toBeNull();
		expect(aliasRedirect('https://thekutners.com/list', '')).toBeNull();
	});
});
