# Owner login with Cloudflare Access

Cloudflare Access puts a free email-code login in front of `/admin` so the app
itself has no password or session code to maintain. Takes about 10 minutes.
Do this after the site is deployed to your domain (the hostname has to exist).

Owner email: kkutner@icloud.com

## 1. Open Zero Trust

1. Log in at https://dash.cloudflare.com
2. In the left sidebar choose **Zero Trust**. The first time it asks you to pick
   a team name (any short name, e.g. `kutner`) and a plan. Choose the **Free**
   plan (up to 50 users). It may ask for a payment method even on Free; nothing
   is charged.

## 2. Make sure the one-time PIN login method is on

1. Zero Trust → **Settings** → **Authentication** → **Login methods**.
2. If **One-time PIN** is not listed, click **Add new** → **One-time PIN**. Save.

## 3. Add the application

1. Zero Trust → **Access** → **Applications** → **Add an application**.
2. Choose **Self-hosted**.
3. Application name: `Wishlist admin`.
4. Session duration: **1 month** (so you rarely have to log in again).
5. Under public hostname, add:
   - Subdomain / domain: your wishlist hostname (e.g. `wishlist.yourdomain.com`)
   - Path: `admin`
   Add a second entry with path `admin/*` so sub-pages are covered too.
6. Leave identity providers on **One-time PIN** (uncheck anything else).
7. Click **Next**.

## 4. Add the allow policy

1. Policy name: `Owner only`.
2. Action: **Allow**.
3. Under **Include**, selector **Emails**, value `kkutner@icloud.com`.
4. **Next**, then **Add application**.

## 5. Protect the write API the same way

The site has an owner-only API under `/api/admin/*` (sync now, rotate link,
archive season). Repeat step 3 and 4 with path `api/admin/*` and the same
policy. Or edit the `Wishlist admin` application and add the extra path there.

Do **not** protect `/api/offers`. The Claude price routine posts to it with its
own API key, not through Access.

## 6. Test

Open `https://wishlist.yourdomain.com/admin` in a private window. You should
see the Cloudflare login page, enter your email, get a 6-digit code, and land
on the admin dashboard. Any other email is refused.

## Later

- Add Casey as a second owner: edit the policy, add her email. Nothing to deploy.
- Lost access to the email: Zero Trust → Access → Applications → edit policy.
- Remove Access entirely: delete the application. `/admin` becomes public, so
  don't.

The app also verifies the `Cf-Access-Jwt-Assertion` header on admin routes as a
belt-and-braces check, using the Access application's AUD tag, which you paste
into the `CF_ACCESS_AUD` secret. The README build step covers that.
