# Family Wishlist

A small, free-to-run family wish-list site. Kevin and Casey add items as tasks in the
Todoist project **Purchases** (one section per person); the site turns each task into a
gift card with a photo, notes and up to three "where to buy" prices. Relatives open one
link, pick a person and tap **Mark purchased**; the mark flows back into Todoist as the
`@bought` label plus a comment, so nothing gets bought twice. No accounts, no names.

The product spec is `docs/SPEC.md`; the wireframes are `docs/wireframes/wireframes.html`.

## How it works

- **SvelteKit 3 + Svelte 5** on a **Cloudflare Worker** (`@sveltejs/adapter-cloudflare`).
- **D1** (SQLite) for items, offers, purchases, the Todoist write queue and sync history.
  Migrations live in `migrations/`. **R2** caches product images.
- **Cron**: `*/15 * * * *` syncs Todoist → site and drains the Todoist write queue;
  `0 9 * * *` re-fetches product pages for images and prices. A Todoist **webhook** triggers
  a sync within seconds of a change.
- **Owner admin** at `/admin` sits behind **Cloudflare Access** (the app verifies the Access
  JWT, so a misconfigured Access rule still fails closed).
- **Claude routines** (scheduled tasks) talk to `/api/offers` and `/api/enrich/*` with a
  bearer key: a weekly price check and a daily "enrich thin tasks" pass.

Code map:

| Path                          | What                                                                  |
| ----------------------------- | --------------------------------------------------------------------- |
| `src/lib/config.ts`           | People, section aliases, control labels, `MAX_OFFERS`, routine limits |
| `src/lib/parse.ts`            | Todoist task → item fields, description hints, URL extraction         |
| `src/lib/people.ts`           | Section name → person matching                                        |
| `src/lib/server/todoist.ts`   | Todoist API v1 client (the only file that knows Todoist's URLs)       |
| `src/lib/server/sync.ts`      | Todoist → site upsert / soft delete / manual offers                   |
| `src/lib/server/purchases.ts` | Mark purchased, undo, qty, archive season                             |
| `src/lib/server/outbox.ts`    | Site → Todoist queue with backoff                                     |
| `src/lib/server/offers.ts`    | Best-price bookkeeping, `/api/offers` writes, product-page fetch      |
| `src/lib/server/pagemeta.ts`  | og:image / og:title / JSON-LD price parser                            |
| `src/lib/server/access.ts`    | Cloudflare Access JWT check                                           |
| `src/lib/server/queries.ts`   | Read models for pages, filters and sorting                            |
| `src/hooks.server.ts`         | Guest-slug enforcement, admin auth, device cookie, `noindex` header   |
| `src/worker/index.ts`         | Worker entry: cron handler and the `thekutners.com/list*` redirect    |
| `src/routes/`                 | Pages and API endpoints                                               |
| `scripts/seed-dev.ts`         | Fixture data for local development                                    |
| `tests/`                      | Vitest unit tests (run against an in-memory SQLite)                   |

## Run locally

Requires Node 22.

```sh
npm install
cp .dev.vars.example .dev.vars        # local secrets; DEV_BYPASS_ACCESS=1 lets you open /admin
npm run db:migrate:local              # create the local D1 database
npm run db:seed:local                 # fixture items for all four people
npm run build && npm run preview      # wrangler dev on http://localhost:8787
```

`npm run dev` (Vite with hot reload, bindings emulated via wrangler's platform proxy) also
works for UI work; the cron handler and the `/list` redirect only exist under `wrangler dev`.

Quality checks: `npm run check` (svelte-check), `npm run lint` (prettier + eslint),
`npm test` (vitest), `npm run build`.

To try the real Todoist sync locally, put your token in `.dev.vars` and open
`http://localhost:8787/admin` → **Sync now**.

## Deploy

One-time setup (about 20 minutes):

1. `npx wrangler login`
2. Create the database and bucket:
   ```sh
   npx wrangler d1 create family-wishlist      # paste the printed database_id into wrangler.jsonc
   npx wrangler r2 bucket create family-wishlist-images
   npx wrangler d1 migrations apply DB --remote
   ```
3. Secrets (`npx wrangler secret put NAME`, one at a time; see `.env.example`):
   - `TODOIST_TOKEN` – Todoist → Settings → Integrations → Developer → API token.
   - `TODOIST_WEBHOOK_SECRET` – the client secret of the Todoist app you create below.
   - `OFFERS_API_KEY` – any long random string (`openssl rand -hex 24`); give it to the Claude routines.
   - `CF_ACCESS_AUD`, `CF_ACCESS_TEAM_DOMAIN` – from Cloudflare Access (see below); the team
     domain looks like `kutners.cloudflareaccess.com`.
   - `GUEST_SLUG` – optional; leave unset for clean URLs.
   - `TODOIST_PROJECT_ID` – optional; only if the project is not named "Purchases".
4. Domain: `wrangler.jsonc` declares the custom domain `wishlist.thekutners.com` and the route
   `thekutners.com/list*`. Both zones must be on the same Cloudflare account; `wrangler deploy`
   creates the DNS record for the custom domain. The `/list*` route 302-redirects to the same
   path on the canonical host (so `thekutners.com/list/robbie` → `wishlist.thekutners.com/robbie`).
5. `npm run deploy` for the first deploy.
6. Set up **Cloudflare Access** for `/admin`: `docs/SETUP-CLOUDFLARE-ACCESS.md`. Then set
   `CF_ACCESS_AUD` and `CF_ACCESS_TEAM_DOMAIN` and deploy again (or `wrangler secret put` is
   enough; secrets apply without a redeploy).

### GitHub Actions

`.github/workflows/deploy.yml` runs check / lint / test / build, applies D1 migrations and
deploys on every push to `main` (merging a pull request counts). Pull requests into `main` get
the same checks without deploying. Add two repository secrets (GitHub → the repo → Settings →
Secrets and variables → Actions → New repository secret):

- `CLOUDFLARE_API_TOKEN` – an API token with the **Edit Cloudflare Workers** template plus
  **D1 Edit** and **Workers R2 Storage Edit** permissions.
- `CLOUDFLARE_ACCOUNT_ID` – from the Workers overview page.

Until both exist, pushes to `main` are checked but not deployed, with a warning on the run.
Work happens on a branch and reaches `main` through a pull request.

## Todoist setup

1. **Share the project**: open the Purchases project in Todoist → share → invite Casey. She can
   then add items from her own account; nothing else changes.
2. **Sections**: one per person, named either the name or `<Name> Wishlist`
   (`Kev Wishlist`, `Casey Wishlist`, `Robbie Wishlist`, `Logan Wishlist` all work; aliases
   live in `src/lib/config.ts`). Tasks outside these four sections are ignored, so the project
   can keep its other uses.
3. **Adding an item**: type the name, pick the section. Everything else is optional:
   - **Description**: notes, size, color. The first URL becomes the product link; any further
     URLs become extra "where to buy" entries. Links pasted on the phone arrive as
     `[title](url)`; the site shows them as plain text and drops a line that is only the product link.
   - **From Safari**: Share → Todoist on a product page makes a task named `[Page title](url)`.
     The site uses the title as the item name and the URL as the product link.
   - **Priority**: p1 = "Really want", p2 = "Would love", p3 = "Nice to have", p4 = no badge.
   - **Labels** are categories (`@toys`, `@books`, `@clothes`), except two control labels:
     `@bought` (purchased; the site sets it too) and `@hidden` (keep in Todoist, don't show).
   - **Hints**, one per line anywhere in the description, forgiving of case and spacing:
     ```
     price: 45            shown as "~$45" until a real price is found
     qty: 2               wants two; the site shows "1 of 2 purchased"
     occasion: birthday   birthday | holidays | any (default any)
     size: youth M        shown on the item sheet
     color: navy          shown on the item sheet
     enriched: 2026-11-04 written by the enrichment routine; shows "Link and details added automatically on …"
     ```
   - A task named `Profile: <Name>` is always hidden from the site. It holds that person's
     sizes and preferences for the enrichment routine.
4. **Completing** a task removes the item from the site. **Deleting** it does the same.
5. **Webhook** (near-instant sync): in the [Todoist App Console](https://app.todoist.com/app/settings/integrations/developer)
   create an app, set the webhook callback URL to
   `https://wishlist.thekutners.com/api/todoist/webhook`, tick the events `item:added`,
   `item:updated`, `item:completed`, `item:deleted`, `item:uncompleted`, and activate the webhook.
   Copy the app's **client secret** into `TODOIST_WEBHOOK_SECRET`
   (`npx wrangler secret put TODOIST_WEBHOOK_SECRET --name family-wishlist`); the site verifies
   `X-Todoist-Hmac-SHA256` with it and ignores anything that does not match. The client ID is
   not used by the site. Without the webhook the 15-minute cron still syncs.

   **Connect your Todoist account once.** Todoist only sends webhooks for accounts that have
   completed OAuth with the app, and the site has no OAuth flow of its own, so do it by hand:
   1. Set the app's **OAuth redirect URL** to `https://wishlist.thekutners.com`. Todoist
      rejects it with a trailing slash.
   2. Open
      `https://app.todoist.com/oauth/authorize?client_id=<CLIENT_ID>&scope=data:read&state=wishlist`
      and click **Agree**. You land on the site with `?code=…&state=wishlist` in the address.
   3. Within a few minutes (the code expires), trade the code for a token. Clicking Agree alone
      does not start webhooks. In PowerShell (values are typed at prompts, so they stay out of
      the command history):
      ```powershell
      $id   = Read-Host "Client ID"
      $s    = Read-Host "Client secret" -AsSecureString
      $sec  = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
      $code = Read-Host "Code"
      $r = Invoke-RestMethod -Method Post -Uri "https://api.todoist.com/oauth/access_token" -Body @{ client_id = $id; client_secret = $sec; code = $code }
      if ($r.access_token) { "Connected" }
      Remove-Variable s, sec, r
      ```
      The token itself is not needed afterwards. If you see `invalid_grant`, repeat step 2 for a
      fresh code.
   4. Check it: run `npx wrangler tail family-wishlist --format pretty`, add a task in Todoist,
      and look for `POST …/api/todoist/webhook - Ok`.

   Removing the app under Todoist **Settings → Integrations** stops the webhooks. The site uses
   `wishlist.thekutners.com`; its `workers.dev` address is intentionally off (requests there get
   Cloudflare error 1042).

The sync is Todoist → site for everything except purchase state. When a guest marks an item
the site adds `@bought` and comments "Marked purchased on the wishlist"; undo removes the label
and comments. For `qty: N` items the label is added only when all N are taken. If Kevin adds or
removes `@bought` by hand, the site follows on the next sync.

## Cloudflare Access (owner login)

`docs/SETUP-CLOUDFLARE-ACCESS.md`. Protect `/admin`, `/admin/*` and `/api/admin/*`; do **not**
protect `/api/offers` or `/api/enrich/*` (the Claude routines use their own key).

## Claude routines

Two scheduled tasks in Claude, both authenticating with `Authorization: Bearer <OFFERS_API_KEY>`.

### Endpoints

| Endpoint                       | Purpose                                                                                                                                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/offers/stale?days=7` | Items with no routine-provided price newer than `days`: `{ items: [{ id, todoist_task_id, person, name, product_url, notes, about_price_cents, last_claude_offer_at }] }`                                                                     |
| `POST /api/offers`             | Body `{ "items": [{ "todoist_task_id": "…" \| "item_id": 12, "offers": [{ "store", "price_cents", "currency", "url", "note" }] }] }`. Replaces that item's routine offers (`source = claude`) and recomputes the best price. Max 3 are shown. |
| `GET /api/enrich/manifest`     | The enrichment contract: limits, URLs, hint keys, people and section aliases, control labels. Built from `src/lib/config.ts`.                                                                                                                 |
| `GET /api/enrich/instructions` | `text/markdown`: the contents of `docs/routines/ENRICHMENT-ROUTINE.md`, bundled at build time.                                                                                                                                                |
| `GET /api/enrich/pending`      | Items with no product link or no `enriched:` hint: `{ items: [{ id, todoist_task_id, person, name, notes, product_url, created_at }] }`                                                                                                       |

### Weekly price routine

Schedule weekly (and run on demand after adding many items). Connectors: web search. Secrets:
`SITE_URL`, `OFFERS_API_KEY`. Prompt:

```
You keep the Kutner family wishlist's prices fresh. The site is at {SITE_URL}; authenticate
every request with the header "Authorization: Bearer {OFFERS_API_KEY}".

1. GET {SITE_URL}/api/offers/stale?days=7. It returns items (id, todoist_task_id, person,
   name, product_url, notes, about_price_cents) whose prices are older than a week.
2. For each item (at most 25 per run, highest priority first as returned), web-search for the
   exact product. Use the product_url and notes to confirm you have the right thing (right
   size/variant/edition). Find up to 3 reputable US stores that sell it new, in stock, with a
   current price including the item only (no shipping). Prefer well-known retailers and the
   brand's own store. No marketplaces with unknown sellers, no used, no affiliate links.
3. POST {SITE_URL}/api/offers with JSON body
   {"items":[{"todoist_task_id":"<id>","offers":[{"store":"Target","price_cents":4200,
   "currency":"USD","url":"https://…","note":"optional short note"}]}]}
   listing the cheapest first. If you could not find the product confidently, send that item
   with an empty "offers" array so the site stops asking about it for a week.
4. Reply with a short summary: items updated, items you could not find, and anything odd
   (discontinued, price far from the owner's ~price hint).
Never buy anything, never create accounts, never change Todoist.
```

### Daily enrichment routine

Fills in links, one-line descriptions, size/color and a price hint for thin Todoist tasks by
editing the task description in place (Todoist connector), and marks each with
`enriched: YYYY-MM-DD`. The routine's real instructions live in
`docs/routines/ENRICHMENT-ROUTINE.md` and are served by the site, so the scheduled task's prompt
is only a bootstrap. **To change the routine, edit that markdown file and deploy**; the
manifest (`/api/enrich/manifest`) is built from the app's own config and is authoritative for
limits and endpoints. Connectors: Todoist, web search. Secrets: `SITE_URL`, `OFFERS_API_KEY`.
Bootstrap prompt:

```
You maintain the Kutner family wishlist. Site: {SITE_URL}. Send the header
"Authorization: Bearer {OFFERS_API_KEY}" on every request to it.
1. GET {SITE_URL}/api/enrich/manifest and read it: it defines the limits (max items per run,
   minimum task age), the endpoints, the description hint keys, the people and their Todoist
   section names, and the control labels. If anything in the instructions conflicts with the
   manifest, the manifest wins. This prompt understands manifest version 1: if the version
   is different, or either fetch fails, change nothing and report that.
2. GET the manifest's instructions_url (markdown) and follow it exactly.
3. Use the manifest's pending_url to see which items the site still considers un-enriched.
   For all reads and writes to tasks use the Todoist connector if its tools are available;
   if not, use the Todoist API v1 with "Authorization: Bearer $TODOIST_TOKEN"
   (GET /api/v1/tasks?project_id=…, POST /api/v1/tasks/<id> {"description": …}).
Never buy anything, never create accounts, never touch other projects.
```

### Live scheduled tasks

| Name                     | Schedule (America/New_York) | Notes                                                    |
| ------------------------ | --------------------------- | -------------------------------------------------------- |
| `Wishlist enrichment`    | daily 06:11                 | Fresh session per run, push notifications on             |
| `Wishlist price refresh` | Mondays 07:15               | Fresh session per run, push notifications on; no Todoist |

Both run in the cloud environment, so its network allow list must include
`wishlist.thekutners.com` (plus `api.todoist.com` for the enrichment fallback). The offers key
is in each task's stored prompt; rotating it means `wrangler secret put OFFERS_API_KEY` and
editing both tasks.

## Runbook

- **Rotate the Todoist token**: Todoist → Settings → Integrations → Developer → regenerate;
  `npx wrangler secret put TODOIST_TOKEN`. Queued writes retry automatically.
- **Enable or rotate the guest slug**: `npx wrangler secret put GUEST_SLUG` with a random value
  (`openssl rand -hex 8`). All guest pages move to `https://wishlist.thekutners.com/<slug>/…`
  and every other guest path 404s; send the family the new link. `/admin`, `/api/*` and static
  files are unaffected. To go back to clean URLs, set it to an empty value. No code change.
- **Rotate the offers key**: `npx wrangler secret put OFFERS_API_KEY`, then update the secret in
  both Claude scheduled tasks.
- **Season reset**: `/admin` → **Archive season** (type ARCHIVE). Clears every purchase, queues
  `@bought` removal in Todoist, keeps items. Set the new banner text in the same panel.
- **Export / restore**: `/admin` → **Export JSON** (or `GET /api/admin/export` through Access)
  downloads every table. To restore into a fresh database: `wrangler d1 migrations apply DB
--remote`, then turn the export's rows into `INSERT` statements (`people`, `items`, `offers`,
  `purchases`, `settings` are the ones that matter; `todoist_outbox` and `sync_runs` can be
  skipped) and run `wrangler d1 execute DB --remote --file restore.sql`. Items re-sync from Todoist
  anyway; the export mainly preserves purchases and offers.
- **Move hosts**: everything is plain SQLite + a Node-compatible SvelteKit app. Swap
  `adapter-cloudflare` for `adapter-node`, implement `Db` (`src/lib/server/db.ts`) over any
  SQLite driver and `ImageStore` (`src/lib/server/images.ts`) over a folder or bucket, run the
  jobs in `src/lib/server/jobs.ts` from a cron, and import the JSON export.
- **Redeploy**: push to `main`, or `npm run deploy`.
- **Health**: `/admin/health` (JSON, behind Access) and the "Sync & health" panel. `status` is
  `degraded` when the last sync is older than 24 h or Todoist writes keep failing.

## Failure modes and degraded behaviour

| Situation                                 | What happens                                                                                                                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Todoist API down / token invalid          | Sync fails and is logged in `sync_runs`; guests keep seeing the cached list; the admin "Sync & health" panel shows the failure. Writes queue in `todoist_outbox` and retry with backoff (1 min → 6 h). |
| Todoist write keeps failing               | Admin shows "retrying" with the last error; the guest's mark is already saved and visible, so nobody double-buys.                                                                                      |
| Product page blocks the fetch (Amazon)    | Item shows the link and a placeholder image; no page price. Logged under "Errors (24 h)". The Claude routine still supplies prices.                                                                    |
| Claude routines not running               | Only product-page prices and the owner's `~$` hint are shown. Nothing breaks.                                                                                                                          |
| Webhook secret wrong                      | Webhook calls are rejected (401); the 15-minute cron still syncs.                                                                                                                                      |
| Cloudflare Access misconfigured           | `/admin` fails closed (403) because the app verifies the Access JWT itself.                                                                                                                            |
| `@bought` added by hand in Todoist        | Item shows "Purchased" with no undo (there is no purchase row to release).                                                                                                                             |
| Guest marks, owner then removes `@bought` | The purchase row keeps the item marked on the site until a guest undoes it or the season is archived.                                                                                                  |
| Two guests tap at once                    | The second tap is a no-op; the sheet says someone already marked it.                                                                                                                                   |
| No JavaScript                             | Browsing, filters (with an Apply button) and marking purchased all work as plain forms; the item sheet is a full page.                                                                                 |
