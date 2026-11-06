// Display helpers used by pages (client-safe).
import { SITE_TIME_ZONE } from './config';

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

type DayPart = 'late' | 'morning' | 'afternoon' | 'evening' | 'night';

function dayPart(hour: number): DayPart {
	if (hour < 5) return 'late';
	if (hour < 12) return 'morning';
	if (hour < 17) return 'afternoon';
	if (hour < 21) return 'evening';
	return 'night';
}

interface Zoned {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	weekday: string;
}

function zoned(d: Date, timeZone: string): Zoned {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		hourCycle: 'h23',
		weekday: 'long'
	}).formatToParts(d);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
	return {
		year: Number(get('year')),
		month: Number(get('month')),
		day: Number(get('day')),
		hour: Number(get('hour')) % 24,
		minute: Number(get('minute')),
		weekday: get('weekday')
	};
}

const DAY_MS = 86_400_000;
const calendarDay = (z: Zoned) => Date.UTC(z.year, z.month - 1, z.day) / DAY_MS;
/** Midnight to 5am counts as the night before ("late last night"). */
const humanDay = (z: Zoned) => calendarDay(z) - (z.hour < 5 ? 1 : 0);

/** "6pm", "9am", "noon", "midnight", rounded to the nearest hour. */
function aroundHour(z: Zoned): string {
	const h = (z.hour + (z.minute >= 30 ? 1 : 0)) % 24;
	if (h === 0) return 'midnight';
	if (h === 12) return 'noon';
	return h < 12 ? `${h}am` : `${h - 12}pm`;
}

/**
 * A friendly "Updated \u2026" line relative to `now`, in the site's time zone:
 * "Updated just now", "Updated earlier this afternoon", "Updated yesterday evening",
 * "Updated late last night", "Updated Thursday around 6pm", "Updated the morning of October 21".
 */
export function updatedPhrase(
	iso: string | null | undefined,
	now: Date = new Date(),
	timeZone = SITE_TIME_ZONE
): string {
	if (!iso) return '';
	const then = new Date(iso);
	if (Number.isNaN(then.getTime())) return '';

	const mins = (now.getTime() - then.getTime()) / 60_000;
	if (mins < 2) return 'Updated just now';
	if (mins < 15) return 'Updated a few minutes ago';
	if (mins < 45) return 'Updated about half an hour ago';
	if (mins < 90) return 'Updated about an hour ago';

	const t = zoned(then, timeZone);
	const n = zoned(now, timeZone);
	const part = dayPart(t.hour);
	const days = calendarDay(n) - humanDay(t);

	if (days <= 0) {
		if (part === 'night') return 'Updated earlier tonight';
		return part === dayPart(n.hour) ? `Updated earlier this ${part}` : `Updated this ${part}`;
	}
	if (days === 1) {
		if (part === 'late' || part === 'night') {
			// Still up after midnight: last evening's additions are "earlier tonight".
			if (dayPart(n.hour) === 'late') return 'Updated earlier tonight';
			return part === 'late' ? 'Updated late last night' : 'Updated last night';
		}
		return `Updated yesterday ${part}`;
	}
	if (days < 7) return `Updated ${t.weekday} around ${aroundHour(t)}`;

	const date = then.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone });
	const year = t.year !== n.year ? `, ${t.year}` : '';
	const when = part === 'late' ? 'the early hours' : `the ${part}`;
	return `Updated ${when} of ${date}${year}`;
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

/**
 * Display name for a category key: `motorcycle` → "Motorcycle", `road-supplies` or
 * `road_supplies` → "Road supplies". A parent task's name ("Road Supplies") keeps its case.
 */
export function categoryLabel(key: string): string {
	const s = key.replace(/[-_]+/g, ' ').trim();
	return s.charAt(0).toUpperCase() + s.slice(1);
}

export function shortUrl(url: string, max = 40): string {
	const s = url.replace(/^https?:\/\/(www\.)?/, '');
	return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
