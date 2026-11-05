// Cloudflare Access JWT verification for /admin and /api/admin/* (fail closed).
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export interface AccessConfig {
	teamDomain: string;
	audience: string;
}

export interface AccessIdentity {
	email: string | null;
	payload: JWTPayload;
}

/** Returns the identity on success, null on any failure. */
export async function verifyAccessJwt(
	token: string | null,
	cfg: AccessConfig
): Promise<AccessIdentity | null> {
	if (!token || !cfg.teamDomain || !cfg.audience) return null;
	const issuer = `https://${cfg.teamDomain}`;
	let jwks = jwksCache.get(issuer);
	if (!jwks) {
		jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
			cooldownDuration: 30_000,
			cacheMaxAge: 10 * 60_000
		});
		jwksCache.set(issuer, jwks);
	}
	try {
		const { payload } = await jwtVerify(token, jwks, { issuer, audience: cfg.audience });
		const email = typeof payload.email === 'string' ? payload.email : null;
		return { email, payload };
	} catch {
		return null;
	}
}
