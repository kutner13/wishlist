# Wishlist — Product & Technical Spec (v0.1 draft)

Status: DRAFT, awaiting owner approval
Owner: Kevin Kutner
Last updated: 2026-11-05

---

## 1. What this is

A personal wish-list website for birthdays and holidays. Kevin adds items in
Todoist (phone, voice, wall panel, wherever). The site reads Todoist and turns
each task into a shareable gift card with photos, notes, and a live "where to
buy it cheapest" panel. Friends and family open a link, claim an item so no one
double-buys, and see the best current price and a few store options.

Design goals, in priority order:

1. **Zero-friction input.** Adding an item is "add a Todoist task". Nothing else.
2. **Shareable and trustworthy for guests.** A link that works on a phone with no
   account, no app, no sign-up. Claims persist and are visible to other guests.
3. **Surprise preserved.** Kevin never sees who bought what unless he opts in.
4. **Durable for years.** Few moving parts, free/cheap hosting, no dependency
   that can quietly die, data exportable at any time, and a "degraded mode" for
   every external integration.

## 2. People and roles

| Role | Who | What they can do |
|---|---|---|
| Owner | Kevin | Add/edit items (via Todoist), create lists, generate share links, archive a list after the event, optionally reveal purchases afterward. |
| Guest | Family/friends with a link | View the list, see prices and store options, claim/unclaim an item, leave a note on a claim ("I got the blue one"). No account. |
| Nobody else | Public internet | Lists are unlisted: reachable only by unguessable link, `noindex`, no directory. |

## 3. Core flows

### 3.1 Owner adds an item (Todoist)

Todoist is the **only** input UI for items. Mapping:

| Todoist field | Wishlist meaning |
|---|---|
| Project `Wishlist` | All wishlist items live here. |
| Section (e.g. `Birthday 2027`, `Holidays 2026`, `Anytime`) | Which list the item belongs to. One section = one shareable list. |
| Task content | Item name. |
| Task description | Free text: notes, size/color, "any brand is fine". The **first URL** in the description is treated as the canonical product link. |
| Priority p1–p4 | Desire level, shown as "Really want" / "Would love" / "Nice to have" / default. |
| Labels | Category tags (`@tech`, `@kitchen`, `@books`). Optional. Also `@hidden` to keep an item in Todoist but off the site. |
| Due date | Ignored. (Section is the event.) |
| Completed task | Item removed from the public list (Kevin got it himself, or no longer wants it). |

Optional structured hints in the description, all forgiving of typos and all optional:

```
price: 45          -> expected price, used as the "about $" anchor
qty: 2             -> want more than one; claim counter instead of a single claim
size: M, color: blue
```

### 3.2 Sync Todoist → site

- A scheduled job (every 15 min) and a Todoist **webhook** (near-instant) both call
  the same `sync` function. The scheduled job is the safety net if webhooks break.
- Sync is idempotent: fetch all tasks in the `Wishlist` project, upsert into the
  site DB keyed by Todoist task ID, soft-delete anything that disappeared.
- Sync **never writes to Todoist** by default (see §5, surprise preservation).
- If Todoist is unreachable, the site keeps serving the last-synced data and
  shows a small "last updated X ago" stamp. Nothing breaks.

### 3.3 Guest views a list

`https://<domain>/l/<slug>` where `slug` is a 10+ char random token. The page shows:

- List title, event date (optional), a short owner note.
- Item cards: image, name, desire level, "about $X", category, claimed/available
  state, "Best price" with store name, "See 3 more stores" expander.
- Filters: available only, by category, by price band, by desire level.
- Sort: desire level (default), price low→high, recently added.

### 3.4 Guest claims an item

- Tap "I'll get this". Enter a display name (remembered in the browser). Optional
  note. For `qty: N` items, the claim decrements a counter.
- Claims are stored in the **site DB**, not in Todoist.
- Other guests immediately see "Claimed by Aunt Sarah". Unclaim is allowed by the
  same browser, or by anyone who knows the claimer name (low-stakes, family use).
- A claim can mark "purchased" vs "planning to buy" so two people can coordinate.

### 3.5 Prices and where to buy

Each item has a **price panel** with up to 5 offers: store, price, shipping hint,
link, "checked X hours ago". Sources, in a pluggable provider chain:

1. **Canonical link** (from the Todoist description) — always shown first, always
   works even if every price API is dead.
2. **Shopping search provider** — queries by item name (and brand/model if the
   canonical page gives one) and returns multiple stores with prices.
3. **Manual offers** — Kevin can paste extra store URLs into the description.

Refresh policy: offers are cached per item, refreshed by a scheduled job every
24 h (or on demand with a 1 h cooldown). Guests never trigger live API calls.
If a provider fails, the last good offers stay visible with their timestamp.

Affiliate links: optional, off by default. Flagged on the page if ever enabled.

### 3.6 After the event

- Owner archives the list (one click). Archived lists stay viewable but read-only.
- Owner can **reveal** claims on an archived list to see who gave what
  (handy for thank-you notes). This is explicit and never automatic.
- Optional: "Mark as received" writes a Todoist comment or completes the task.
  Off by default; owner-triggered only.

## 4. Non-goals (v1)

- No guest accounts, no social login, no comments thread per item.
- No price alerts / notifications to guests.
- No multi-owner lists (one Todoist account = one owner).
- No native mobile app. The site is mobile-first PWA-quality instead.

## 5. Surprise preservation (important design rule)

The owner's primary interface is Todoist. If the site wrote claims back to Todoist
(completing tasks, adding comments), Kevin would see what he's getting.
Therefore: **claims live only in the site DB**, and the owner UI on the site hides
claim state unless the list is archived and the owner explicitly reveals.

## 6. Architecture

Chosen for longevity: boring, mainstream, free-tier-friendly, easy to migrate.

```
Todoist  --(REST API + webhook)-->  Sync worker  -->  SQLite DB
                                                        |
Guest browser  <--  Web app (SSR + small JS)  <---------+
                                                        |
Price providers  <--  Price refresh worker (cron)  -----+
```

- **Web app:** Next.js (App Router) or SvelteKit — see Q7. Server-rendered pages,
  minimal client JS, works without JS for viewing.
- **Database:** SQLite (via Turso/libSQL or Cloudflare D1). Tiny data, trivially
  exportable, zero ops. Schema in §7.
- **Hosting:** Vercel or Cloudflare Pages/Workers free tier. Cron via platform
  scheduler. Custom domain.
- **Secrets:** Todoist API token, price provider key, owner admin secret. All in
  platform env vars; a `.env.example` documents them.
- **Images:** Pulled from the canonical page's Open Graph tag at sync time, cached
  to platform blob storage, with a generic placeholder fallback.
- **Observability:** A `/health` endpoint reporting last sync time, last price
  refresh, and provider error counts. Optional email on repeated failures.

Durability measures:
- Every integration has a documented failure mode and a manual fallback.
- `pnpm export` dumps the whole DB (items, lists, claims) to JSON/CSV.
- Pin major versions; dependabot for security only.
- Single `README` runbook: how to rotate tokens, how to redeploy, how to move hosts.
- No framework feature that is less than ~2 years old.

## 7. Data model

```
lists        id, slug, title, event_date, note, todoist_section_id, archived_at, revealed_at
items        id, list_id, todoist_task_id, name, description, canonical_url, image_url,
             desire (1-4), expected_price_cents, qty, category_tags[], hidden,
             created_at, updated_at, removed_at
offers       id, item_id, source, store, title, price_cents, currency, url,
             shipping_note, fetched_at, is_best
claims       id, item_id, claimer_name, claimer_token, qty, status (planned|purchased),
             note, created_at, released_at
sync_runs    id, kind (todoist|prices), started_at, finished_at, ok, error
```

## 8. Owner admin (small, on the site)

Protected by a single long-lived secret link or passkey (see Q5). Pages:

- Lists: create share link for a Todoist section, set title/date/note, archive, reveal.
- Sync status + "sync now" + "refresh prices now".
- Export.

Everything about *items* is still done in Todoist.

## 9. Open questions (need answers before wireframes)

See the chat summary. Numbered Q1–Q9 there; answers get folded into this file.

## 10. Milestones

1. Spec approved → wireframes (3 screens: guest list, item/claim sheet, owner admin).
2. Wireframes approved → build: Todoist sync, list page, claims. Ship on real domain.
3. Price providers + image fetching.
4. Archive/reveal, export, health, runbook. Done for first event.
