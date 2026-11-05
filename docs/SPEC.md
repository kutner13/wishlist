# Family Wishlist — Product & Technical Spec (v0.2)

Status: v0.3 approved for wireframes
Owner: Kevin Kutner
Family members on the site: Kevin, Casey, Robbie, Logan
Last updated: 2026-11-05

---

## 1. What this is

A family wish-list website for birthdays and holidays. Kevin (and Casey) add
items in Todoist. The site reads Todoist and turns each task into a gift card
with a photo, notes, and a "where to buy" panel with the best current price.
Relatives open one link, pick a person, and tap "Mark purchased" when they've
bought something so nothing is bought twice. Purchases flow back into Todoist,
registry-style. No names, no sign-in, no "planning to buy" step.

Design goals, in priority order:

1. **Zero-friction input.** Adding an item = typing a task name into Todoist.
   Everything else is optional.
2. **No double-buying.** Purchased state is visible to every guest instantly.
3. **Nothing hidden from the owner.** Kevin sees purchased state in Todoist and
   on the site. It's a registry, not a secret. Guests stay anonymous.
4. **Free to run, durable for years.** Cloudflare free tier, SQLite, no paid APIs,
   a documented fallback for every integration, one-command export.

## 2. People and roles

| Role | Who | Can do |
|---|---|---|
| Owner | Kevin | Add/edit items (Todoist). On the site (`/admin`): reset a season, trigger sync, rotate link, export. |
| Co-editor | Casey | Adds items via the shared Todoist project. No site admin. |
| Guests | Relatives and friends with the link | Browse all four people's lists, filter, see prices and stores, mark purchased, undo with a confirm. No account, no name. |
| Public internet | Nobody | Site is unlisted: unguessable URL, `noindex`, no directory, no search. |

## 3. Todoist mapping

Reuses the existing **Purchases** project (Todoist Free plan cap of 5 projects,
so no new project). Kevin shares the project with Casey so she can add items
herself (sharing is free). Anything in Purchases that is *not* in a family-member section
is ignored by the site, so the project can keep serving its current purpose.

| Todoist | Wishlist meaning |
|---|---|
| Project `Purchases` | Source of all items. |
| Sections `Kevin`, `Casey`, `Robbie`, `Logan` | Whose list the item is on. **Only required thing besides the name.** |
| Task content | Item name. Required. |
| Task description | Optional. Notes, size, color. First URL found = product link. |
| Priority p1–p3 | "Really want" / "Would love" / "Nice to have". p4 (default) = no badge. |
| Labels | Optional category (`@tech`, `@books`, `@clothes`). Plus two control labels below. |
| Label `@bought` | Two-way purchase state. See §4. |
| Label `@hidden` | Keep in Todoist, don't show on site. |
| Completed task | Removed from site (got it elsewhere / changed mind). |

Optional one-line hints anywhere in the description, forgiving of case/spacing:

```
price: 45        about-price anchor shown as "~$45"
qty: 2           want more than one; site shows "1 of 2 purchased"
occasion: birthday | holidays | any    (default: any)
```

Adding an item from the phone is therefore: open Todoist, tap +, type the name,
pick the person's section. Done. A URL in the description makes it better.

## 4. Two-way sync (registry behavior)

**Todoist → site** (every 15 min via Cloudflare cron, plus Todoist webhook for
near-instant): upsert tasks by Todoist task ID, soft-delete missing ones.

**Site → Todoist** happens only on purchase state:

| Guest action on site | Site DB | Todoist write |
|---|---|---|
| Tap "Mark purchased" | `purchases` row (+1 for `qty: N` items) | add label `@bought`; add comment "Marked purchased on the wishlist". For `qty: N`, label only when all N are purchased. |
| Undo (with confirm) | row released | remove `@bought` if none remain; comment noting the undo |
| Owner adds `@bought` in Todoist by hand | item shows "Purchased" | n/a |
| Owner completes task in Todoist | item removed from site | n/a |

Rules:
- Todoist is the source of truth for *what* exists. `@bought` is mirrored both
  ways; last writer wins, with the site re-checking on the next sync.
- Guests are anonymous. No name is collected or stored. A browser token lets the
  same device undo its own mark without a confirm; any other device gets a
  "Did someone buy this by mistake?" confirm.
- Writes to Todoist are queued and retried; a failed write never blocks the guest.
- The Todoist API token is Kevin's. Comments and labels appear as Kevin.

## 5. Guest experience

Single family URL: `https://<domain>/<secret-slug>/`

- **Home:** four person cards (Kevin, Casey, Robbie, Logan) with item counts and
  "N still available". Optional seasonal banner ("Holidays 2026").
- **Person page:** item cards: photo, name, desire badge, ~price, category,
  status pill (Available / Purchased / "1 of 2 purchased"). Filters: available only,
  category, price band, occasion. Sort: desire (default), price, newest.
- **Item sheet** (tap a card): full notes, size/color, product link, price panel
  (§6), one big "Mark purchased" button.
- **Marking purchased:** one tap, no name, no form. Button flips to "Purchased ✓"
  with a small "Undo" link. Undo from another device asks for a confirm.
- Mobile-first, works without JavaScript for viewing, installable as a PWA.

Owner view: same pages plus `/admin`.

## 6. Prices and where to buy (free-only plan)

Each item shows **up to 3 offers**. Three is enough to show "best price" and two
alternatives; more than three on a phone screen is noise and each extra offer is
another fetch to keep fresh. The provider chain is pluggable so a paid source can
be dropped in later without touching the UI.

| # | Provider | Cost | What it gives |
|---|---|---|---|
| 1 | **Product page** (the URL in the description) | free | Title, image, and usually price from Open Graph / schema.org `Product` JSON-LD. Always shown first. Some retailers (Amazon) block server fetches; then we show link + placeholder. |
| 2 | **Claude price routine** (scheduled task) | ~pennies per week in tokens | Weekly, and on demand: for each item with no fresh offers, web-search for the item, pick the best 3 reputable store prices, POST them to the site's `/api/offers` endpoint with an admin key. This is the safety net Kevin asked for and the main source of "other stores". |
| 3 | **Manual** | free | Extra store URLs pasted into the description are listed as offers. |

Freshness: offers carry `fetched_at`; the UI shows "checked 3 days ago". Nothing
expires; stale is better than empty. Guests never trigger lookups.

Future, optional, still free: eBay Browse API and Best Buy API keys as providers 4/5.
No affiliate links.

## 7. Architecture

```
Todoist  <--(REST + webhook)-->  Cloudflare Worker (SvelteKit, adapter-cloudflare)
                                       |            \
                                   D1 (SQLite)      R2 (cached images)
                                       |
                               Cron: sync 15m, image/price refresh daily
                                       ^
          Claude scheduled task --POST /api/offers-- (weekly)
```

- **App:** SvelteKit with `adapter-cloudflare`. Chosen over Next.js because
  Cloudflare is a first-class SvelteKit target and the app is small; fewer
  moving parts to rot. Server-rendered, small JS for the purchase button.
- **DB:** Cloudflare D1 (SQLite). Migrations in repo. Nightly export to R2 as JSON.
- **Images:** fetched at sync from the product page's `og:image`, stored in R2,
  served resized. Placeholder on failure.
- **Hosting:** Cloudflare Pages/Workers on Kevin's existing Cloudflare domain.
  Deploy on merge to `main` via GitHub Actions + `wrangler`.
- **Owner auth:** Cloudflare Access (free, email one-time code) in front of
  `/admin`, allow-listing kkutner@icloud.com. Zero auth code in the app, nothing
  to maintain. Setup instructions ship in the README runbook.
- **Guest auth:** the secret slug in the URL. Rotatable from `/admin`.
- **Secrets:** `TODOIST_TOKEN`, `TODOIST_WEBHOOK_SECRET`, `OFFERS_API_KEY`,
  `SITE_SLUG`. All in Wrangler secrets; `.env.example` documents them.
- **Health:** `/admin/health` shows last sync, last offer refresh, queued Todoist
  writes, errors. Optional email alert via Cloudflare Email Workers if sync fails
  for 24 h.

Durability:
- Everything free-tier; the only recurring cost is the domain you already own.
- Every integration has a degraded mode (Todoist down → serve cache; page fetch
  blocked → link + placeholder; Claude routine missing → product-page price only).
- `README` runbook: rotate token, rotate slug, redeploy, restore from export,
  move hosts. Pinned major versions; security-only dependency updates.

## 8. Data model

```
people       id, name, slug, todoist_section_id, sort_order
items        id, person_id, todoist_task_id, name, notes, product_url, image_key,
             desire (1-4), about_price_cents, qty, occasion, categories[],
             hidden, bought_in_todoist, created_at, updated_at, removed_at
offers       id, item_id, source (page|claude|manual), store, price_cents,
             currency, url, note, fetched_at, is_best
purchases    id, item_id, device_token, created_at, released_at
todoist_outbox id, item_id, action (add_label|remove_label|comment), payload,
             attempts, last_error, done_at
sync_runs    id, kind, started_at, finished_at, ok, error
settings     key, value  (site slug, season banner, archive state)
```

## 9. Owner admin (`/admin`, behind Cloudflare Access)

- Dashboard: counts per person, purchased list, sync/health.
- "Sync now", "Refresh images", "Rotate guest link".
- Season: set banner text, "Archive season" (clears purchases, strips `@bought`
  labels after confirm, keeps items). Export JSON.
- Everything about items stays in Todoist.

## 10. Non-goals (v1)

No guest accounts, no chip-in / group gifts, no price alerts, no comments thread,
no native app, no paid price APIs, no affiliate links.

## 11. Milestones

1. **Wireframes** (next): home, person page, item sheet with purchase flow, admin.
2. **Build A:** Todoist sync (both directions), D1 schema, home/person/item pages,
   mark-purchased. Deploy to the real domain.
3. **Build B:** product-page image/price fetch, offers API, Claude price routine,
   admin, export, runbook.
4. **Hardening:** webhook, health alerts, PWA, accessibility pass.

## 12. Design decisions from wireframe review (2026-11-05)

Wireframes: `docs/wireframes/wireframes.html`.

| Question | Decision |
|---|---|
| Card style | **Variant A "Clean & warm"**: off-white, 20px radius, Fraunces serif for item name and price, Inter elsewhere, terracotta accent `#d85b2b`, mint "available" green. |
| Purchased items | Stay in place, dimmed and struck through. |
| Headline price on a card | **Best price found** (from offers). Fall back to the owner's `~$` hint when no offers exist, then to nothing. |
| "Available only" filter | **Default on**, always. Guest can toggle it off. |
| `qty: N` after first purchase | Same "Mark purchased" button, pill reads "1 of 2 purchased". Undo releases the most recent mark. |
| Home person cards | Name, **one thumbnail** (image of the top-desire available item, placeholder if none), and **one number: items available**. No total count. |

## 13. Deployment URLs

- Primary: `https://wishlist.thekutners.com` (Cloudflare Worker on a custom domain).
- Alias: `https://thekutners.com/list` and everything under it. Implemented as a
  Worker route `thekutners.com/list*` that 302-redirects to the same path on
  `wishlist.thekutners.com`, so there is exactly one canonical origin and no
  base-path handling in the app.
- Guest secret slug: **off by default** because the owner chose clean URLs. A
  `GUEST_SLUG` secret, when set, requires `/<slug>` as the first path segment
  and 404s everything else. Can be turned on later from the runbook without a
  code change.
- `/admin` and `/api/admin/*` sit behind Cloudflare Access (see
  `docs/SETUP-CLOUDFLARE-ACCESS.md`).

## 14. Daily enrichment sweep (added 2026-11-05)

Goal: the owner types two words into Todoist ("Sixers tickets", "Abercrombie
hoodie", "OXO baking storage") and within a day the entry is useful to a guest:
a real product link, a one-line description, the right size/color, a price hint.

How it works:

- A **Claude scheduled task** runs daily (06:30 America/New_York). It has the
  Todoist connector and web search. It does not need site credentials for the
  core job, because it writes to Todoist and the site syncs from there.
- It reads every task in the four wishlist sections of `Purchases` that has no
  URL in its description or no `enriched:` hint. (The site also exposes
  `GET /api/enrich/pending` for the same list.)
- For each, it reads that person's **Profile** task (see below), web-searches
  for a sensible specific product, and **appends** to the description. It never
  rewrites the owner's own words and never changes the task name.

  Appended block, example for "Abercrombie hoodie" on Kevin's list:

  ```
  https://www.abercrombie.com/shop/us/p/essential-popover-hoodie-12345
  Essential popover hoodie, heavyweight fleece.
  size: L   color: any dark color
  price: 70
  enriched: 2026-11-06
  ```

- It also posts up to 3 store prices to `POST /api/offers` when it has the
  site's key (spec §6, same routine).
- For things that are not a single product ("Sixers tickets"), it links the
  official or most sensible page (team site / Ticketmaster), writes a price
  range, and says what would be welcome ("any home game, two seats").
- Guard rails: no purchases, no account creation, no changes to completed or
  `@bought` tasks, skip anything whose description already contains
  `enriched:`, at most 20 items per run, and a short summary comment is not
  added (noise). If it is unsure, it adds the best link it found plus
  `enriched: <date> (unsure)` so the owner can fix it from the phone.

Profiles, kept in Todoist so they are editable from the phone:

- One task per person named `Profile: <Name>` in that person's section,
  labelled `@hidden`. The site ignores it; the routine reads it.
- Description holds free text the routine uses verbatim as context. Suggested
  fields: shirt/hoodie, pants (waist/inseam), shoe, hat, ring; favorite colors
  and colors to avoid; brands liked/disliked; teams; age (kids); hobbies;
  "already have" notes; allergies/dietary; gift card preferences.

Site changes: parse `size:`, `color:`, `enriched:` hints; show a muted "Link and
details added automatically on <date>" note on the item sheet; treat any task
named `Profile...` as hidden.

### 14.1 Keeping the routine in step with the site

The scheduled task's own prompt is a 5-line **bootstrap** that never changes:
fetch `GET /api/enrich/manifest` (limits, endpoints, people, allowed hints,
version), fetch `GET /api/enrich/instructions` (markdown served from
`docs/routines/ENRICHMENT-ROUTINE.md` in this repo), then follow them. So:

- Any site change that affects the routine is made in the same commit as the
  instructions file, deploys together, and takes effect on the next run.
- The manifest is generated from the app's own config constants, so limits,
  hint names, section aliases, and control labels cannot drift.
- If the manifest `version` is one the bootstrap does not understand, or either
  fetch fails, the routine does nothing and reports that, rather than guessing.
- Removing a feature from the site = removing it from the instructions file.
  The routine has no memory of its own.

Execution: a cloud Claude scheduled task (fresh session each run, Todoist
connector, web search, `SITE_URL` + `OFFERS_API_KEY` as environment secrets).
Nothing runs on the owner's devices. Push notifications are on, so a run that
has "unsure" items or needs a decision notifies the owner's phone and the run's
conversation can be opened and answered there.
