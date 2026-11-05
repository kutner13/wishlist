import { describe, expect, it } from 'vitest';
import { aliasRedirect, isAliasPassthrough } from '../src/lib/redirect';

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
		// The route pattern thekutners.com/list* also catches these; they are not the alias.
		expect(aliasRedirect('https://thekutners.com/listing', host)).toBeNull();
		expect(aliasRedirect('https://thekutners.com/lists/x', host)).toBeNull();
	});
});

describe('isAliasPassthrough', () => {
	const host = 'wishlist.thekutners.com';
	it('passes other /list… paths on the apex back to its origin', () => {
		expect(isAliasPassthrough('https://thekutners.com/listing', host)).toBe(true);
		expect(isAliasPassthrough('https://thekutners.com/lists/x?a=1', host)).toBe(true);
	});
	it('leaves the alias, the canonical host and local dev alone', () => {
		expect(isAliasPassthrough('https://thekutners.com/list/robbie', host)).toBe(false);
		expect(isAliasPassthrough('https://thekutners.com/list', host)).toBe(false);
		expect(isAliasPassthrough('https://wishlist.thekutners.com/listing', host)).toBe(false);
		expect(isAliasPassthrough('http://localhost:8787/listing', host)).toBe(false);
		expect(isAliasPassthrough('https://thekutners.com/listing', '')).toBe(false);
	});
});
