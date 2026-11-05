import { secret } from '#lib/server/env';
import { exchangeCode, oauthPage, oauthState } from '#lib/server/todoist-oauth';
import type { RequestHandler } from './$types';

/** Todoist's OAuth redirect URL: finishes the one-time authorization that turns webhooks on. */
export const GET: RequestHandler = async ({ url }) => {
	const clientId = secret('TODOIST_CLIENT_ID');
	const clientSecret = secret('TODOIST_WEBHOOK_SECRET');
	if (!clientId || !clientSecret) {
		return oauthPage(
			'Not set up yet',
			'TODOIST_CLIENT_ID and TODOIST_WEBHOOK_SECRET must both be set in the Cloudflare Worker settings.',
			503
		);
	}
	if (url.searchParams.get('error')) {
		return oauthPage(
			'Todoist was not connected',
			'Todoist says the request was not allowed. Open /api/todoist/oauth/start to try again.',
			400
		);
	}
	const code = url.searchParams.get('code');
	if (!code || url.searchParams.get('state') !== (await oauthState(clientSecret))) {
		return oauthPage(
			'This link did not come from the wishlist',
			'Start from /api/todoist/oauth/start so the request can be checked.',
			400
		);
	}
	const result = await exchangeCode(clientId, clientSecret, code);
	if (!result.ok) {
		console.error('todoist oauth exchange failed', result.status, result.error);
		return oauthPage(
			'Todoist did not finish connecting',
			`Todoist answered ${result.status || 'with a network error'}. Check that the Client ID and Client secret in Cloudflare match the app, then open /api/todoist/oauth/start again.`,
			502
		);
	}
	return oauthPage(
		'Todoist is connected',
		'Changes you make in Todoist now reach the wishlist within seconds. You can close this page.'
	);
};
