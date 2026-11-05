import { error } from '@sveltejs/kit';
import { bindings } from '#lib/server/env';
import type { RequestHandler } from './$types';

/** Serves cached product images from R2. Keys are content-hashed, so they cache forever. */
export const GET: RequestHandler = async ({ params }) => {
	const key = params.key;
	if (!/^items\/\d+\/[0-9a-f]{16}\.[a-z0-9]{2,5}$/.test(key)) error(404, 'Not found');
	const obj = await bindings().IMAGES.get(key);
	if (!obj) error(404, 'Not found');
	const headers = new Headers();
	headers.set('Content-Type', obj.httpMetadata?.contentType ?? 'application/octet-stream');
	headers.set('Cache-Control', 'public, max-age=31536000, immutable');
	headers.set('ETag', obj.httpEtag);
	return new Response(obj.body as unknown as BodyInit, { headers });
};
