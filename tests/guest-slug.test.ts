import { describe, expect, it } from 'vitest';
import { getGuestSlug, isGuestPath, setGuestSlug, stripGuestSlug } from '../src/lib/guest-slug';

describe('guest slug rewriting', () => {
	it('strips the prefix only from guest paths', () => {
		expect(stripGuestSlug('/abc123', 'abc123')).toBe('/');
		expect(stripGuestSlug('/abc123/robbie/4', 'abc123')).toBe('/robbie/4');
		expect(stripGuestSlug('/robbie', 'abc123')).toBeUndefined();
		expect(stripGuestSlug('/abc1234', 'abc123')).toBeUndefined();
	});
	it('exempts admin, api and static paths', () => {
		expect(isGuestPath('/')).toBe(true);
		expect(isGuestPath('/robbie')).toBe(true);
		expect(isGuestPath('/admin')).toBe(false);
		expect(isGuestPath('/api/offers')).toBe(false);
		expect(isGuestPath('/img/items/1/x.png')).toBe(false);
		expect(isGuestPath('/_app/immutable/x.js')).toBe(false);
		expect(isGuestPath('/manifest.webmanifest')).toBe(false);
	});
	it('normalises the configured slug', () => {
		setGuestSlug(' /xyz/ ');
		expect(getGuestSlug()).toBe('xyz');
		setGuestSlug('');
		expect(getGuestSlug()).toBeUndefined();
	});
});
