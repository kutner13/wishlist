import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hmacSha256Base64, verifyTodoistSignature } from '../src/lib/server/webhook';

describe('Todoist webhook signature', () => {
	const secret = 'shh-client-secret';
	const body = '{"event_name":"item:added","event_data":{"id":"123"}}';
	const good = createHmac('sha256', secret).update(body).digest('base64');

	it('computes the same HMAC as node crypto', async () => {
		expect(await hmacSha256Base64(secret, body)).toBe(good);
		expect(
			await hmacSha256Base64(secret, new TextEncoder().encode(body).buffer as ArrayBuffer)
		).toBe(good);
	});

	it('accepts a valid signature and rejects everything else', async () => {
		expect(await verifyTodoistSignature(secret, body, good)).toBe(true);
		expect(await verifyTodoistSignature(secret, body, ` ${good}\n`)).toBe(true);
		expect(await verifyTodoistSignature(secret, body + ' ', good)).toBe(false);
		expect(await verifyTodoistSignature('other', body, good)).toBe(false);
		expect(await verifyTodoistSignature(secret, body, null)).toBe(false);
		expect(await verifyTodoistSignature(secret, body, '')).toBe(false);
		expect(await verifyTodoistSignature('', body, good)).toBe(false);
	});
});
