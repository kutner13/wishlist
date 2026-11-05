// Cached product images in R2. Keys look like `items/<item id>/<content hash>.<ext>` and
// are served by /img/[...key] with immutable cache headers.

export interface ImageStore {
	store(itemId: number, bytes: ArrayBuffer, contentType: string): Promise<string>;
}

const EXT: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/avif': 'avif'
};

export async function imageKey(itemId: number, bytes: ArrayBuffer, contentType: string) {
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	const hash = [...new Uint8Array(digest).slice(0, 8)]
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	const ext = EXT[contentType.split(';')[0].trim().toLowerCase()] ?? 'img';
	return `items/${itemId}/${hash}.${ext}`;
}

export function r2ImageStore(bucket: R2Bucket): ImageStore {
	return {
		async store(itemId, bytes, contentType) {
			const key = await imageKey(itemId, bytes, contentType);
			await bucket.put(key, bytes, {
				httpMetadata: { contentType: contentType.split(';')[0].trim() }
			});
			return key;
		}
	};
}

/** Image store for tests: remembers keys only. */
export function memoryImageStore(): ImageStore & { keys: string[] } {
	const keys: string[] = [];
	return {
		keys,
		async store(itemId, bytes, contentType) {
			const key = await imageKey(itemId, bytes, contentType);
			keys.push(key);
			return key;
		}
	};
}
