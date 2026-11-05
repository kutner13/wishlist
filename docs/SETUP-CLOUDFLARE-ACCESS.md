# Owner login with Cloudflare Access

Cloudflare Access puts a free email-code login in front of `/admin` so the app
itself has no password or session code to maintain. Takes about 10 minutes.
Do this after the site is deployed to your domain (the hostname has to exist).

Owner email: kkutner@icloud.com

Verified against Cloudflare's docs on 2026-11-05. The dashboard was reorganized
in 2025–2026: login methods now live under **Integrations**, apps and policies
under **Access controls**, and policies are created once and reused. If your
sidebar differs again, search the docs for "One-time PIN login".

## 1. Open Zero Trust

1. Log in at https://dash.cloudflare.com
2. Left sidebar → **Zero Trust** (URL ends in `/one/...`). First visit asks for a
   team name (any short name) and a plan. Pick **Free**.

## 2. Add One-time PIN as a login method

New Zero Trust organizations no longer start with One-time PIN turned on; since
June 2026 they start with the "Cloudflare" identity provider instead. Add OTP:

1. Zero Trust → **Integrations** → **Identity providers**.
2. Under **Your identity providers** click **Add new identity provider**.
3. Choose **One-time PIN**. Save. No other configuration is needed.

(The pre-enabled Cloudflare identity provider lets you log in with your
Cloudflare account instead. Either works; OTP is what relatives would expect if
you ever add a second owner. You can leave both on and pick at login.)

## 3. Create the owner policy (reusable)

1. Zero Trust → **Access controls** → **Policies** → **Add a policy**.
2. Policy name: `Owner only`. Action: **Allow**. Session duration: **1 month**.
3. Under **Include**: selector **Emails**, value `kkutner@icloud.com`.
4. Save.

Access is deny-by-default, so only this email can get a PIN. Do not use a
broad "Emails ending in" rule with OTP; anyone at that domain could log in.

## 4. Add the application

1. Zero Trust → **Access controls** → **Applications** → **Add an application**.
2. Choose **Self-hosted**.
3. Application name: `Wishlist admin`.
4. Public hostname: your wishlist hostname (e.g. `wishlist.yourdomain.com`),
   path `admin`. Add a second hostname row with path `admin/*`, and a third with
   path `api/admin/*` (owner-only API: sync now, rotate link, archive season).
5. Identity providers: select **One-time PIN** (and Cloudflare if you want it).
6. Policies: select the existing `Owner only` policy.
7. Save.

Do **not** protect `/api/offers`. The Claude price routine posts to it with its
own API key, not through Access.

## 5. Test

Open `https://wishlist.yourdomain.com/admin` in a private window. You should
get the Cloudflare login page, enter your email, receive a 6-digit code (valid
10 minutes), and land on the admin dashboard. Any other email is refused.

## 6. Copy the AUD tag for the app

Open the `Wishlist admin` application → **Overview** → copy the **Application
Audience (AUD) Tag**. The site checks the `Cf-Access-Jwt-Assertion` header on
admin routes against it, so a misconfigured Access rule still can't expose
`/admin`. Paste it into the `CF_ACCESS_AUD` secret during the build step.

## Later

- Add Casey as a second owner: edit the `Owner only` policy, add her email.
  Nothing to deploy.
- Remove Access entirely: delete the application. `/admin` would then rely only
  on the AUD check and fail closed, so don't.

Sources:
- https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/policy-management/
- https://developers.cloudflare.com/cloudflare-one/changelog/access/
