import { redirect } from '@sveltejs/kit';
import { secret } from '#lib/server/env';
import { authorizeUrl, oauthPage, oauthState } from '#lib/server/todoist-oauth';
import type { RequestHandler } from './$types';

/** Opened once by the owner: sends them to Todoist's "Allow this app?" screen. */
export const GET: RequestHandler = async () => {
	const clientId = secret('TODOIST_CLIENT_ID');
	const clientSecret = secret('TODOIST_WEBHOOK_SECRET');
	if (!clientId || !clientSecret) {
		return oauthPage(
			'Not set up yet',
			'Add the Todoist app’s Client ID as TODOIST_CLIENT_ID and its Client secret as TODOIST_WEBHOOK_SECRET in the Cloudflare Worker settings, then open this page again.',
			503
		);
	}
	redirect(302, authorizeUrl(clientId, await oauthState(clientSecret)));
};
