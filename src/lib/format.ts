// Display helpers used by pages (client-safe).

export function formatPrice(cents: number | null | undefined, currency = 'USD'): string {
	if (cents === null || cents === undefined) return '';
	const whole = cents % 100 === 0;
	const n = cents / 100;
	if (currency === 'USD') return whole ? `$${n.toLocaleString('en-US')}` : `$${n.toFixed(2)}`;
	return `${n.toFixed(whole ? 0 : 2)} ${currency}`;
}

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
export function timeAgo(iso: string | null | undefined, now: Date = new Date()): string {
	if (!iso) return 'never';
	const diff = Math.max(0, now.getTime() - Date.parse(iso));
	const min = Math.floor(diff / 60_000);
	if (min < 1) return 'just now';
	if (min < 60) return `${min} min ago`;
	const h = Math.floor(min / 60);
	if (h < 24) return `${h} h ago`;
	const d = Math.floor(h / 24);
	if (d < 30) return d === 1 ? '1 day ago' : `${d} days ago`;
	return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "due now", "in 4 min", "in 2 h". */
export function timeUntil(iso: string | null | undefined, now: Date = new Date()): string {
	if (!iso) return '';
	const diff = Date.parse(iso) - now.getTime();
	if (diff <= 0) return 'due now';
	const min = Math.round(diff / 60_000);
	if (min < 60) return `in ${min} min`;
	return `in ${Math.round(min / 60)} h`;
}

export function shortDate(iso: string | null | undefined): string {
	if (!iso) return '';
	return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function longDate(iso: string | null | undefined): string {
	if (!iso) return '';
	return new Date(iso).toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

/** List URL with one query key changed and the others kept. */
export function listUrl(
	base: string,
	personSlug: string,
	search: string,
	key: string,
	value: string | null
): string {
	const p = new URLSearchParams(search);
	if (value === null || value === '') p.delete(key);
	else p.set(key, value);
	const s = p.toString();
	return `${base}/${personSlug}${s ? `?${s}` : ''}`;
}

/** Minutes until the next quarter-hour cron tick. */
export function minutesToNextQuarter(nowIso: string): number {
	const now = Date.parse(nowIso);
	const quarter = 15 * 60_000;
	return Math.max(1, Math.round((Math.ceil((now + 1) / quarter) * quarter - now) / 60_000));
}

export function shortUrl(url: string, max = 40): string {
	const s = url.replace(/^https?:\/\/(www\.)?/, '');
	return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
