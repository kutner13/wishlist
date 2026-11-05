// Todoist webhook signature check: X-Todoist-Hmac-SHA256 = base64(HMAC-SHA256(secret, raw body)).

export async function hmacSha256Base64(
	secret: string,
	body: string | ArrayBuffer
): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const data = typeof body === 'string' ? new TextEncoder().encode(body) : new Uint8Array(body);
	const sig = await crypto.subtle.sign('HMAC', key, data);
	return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export async function verifyTodoistSignature(
	secret: string,
	rawBody: string | ArrayBuffer,
	header: string | null
): Promise<boolean> {
	if (!secret || !header) return false;
	const expected = await hmacSha256Base64(secret, rawBody);
	return timingSafeEqual(expected, header.trim());
}
