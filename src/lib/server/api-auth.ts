// Bearer-key auth shared by /api/offers and /api/enrich (the Claude routines).
import { error } from '@sveltejs/kit';
import { secret } from './env';

export function requireOffersKey(request: Request) {
	const expected = secret('OFFERS_API_KEY');
	const header = request.headers.get('authorization') ?? '';
	const token = header.replace(/^Bearer\s+/i, '').trim();
	if (!expected || !token || token.length !== expected.length) error(401, 'Unauthorized');
	let diff = 0;
	for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
	if (diff !== 0) error(401, 'Unauthorized');
}
