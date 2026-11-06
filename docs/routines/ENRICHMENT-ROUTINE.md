# Daily wishlist enrichment routine (Claude scheduled task)

> This file is served by the site at `GET /api/enrich/instructions`. The JSON at
> `GET /api/enrich/manifest` is authoritative for limits (items per run, minimum task
> age), endpoint URLs, hint keys, people/section aliases, control labels and the category
> limits: if a number here and the manifest disagree, follow the manifest. The routine's scheduled-task
> prompt is only a bootstrap that fetches both; edit this file and deploy to change
> the routine.

Schedule: every day 06:30 America/New_York. Connectors: Todoist, web search.
Optional secret: OFFERS_API_KEY and SITE_URL for posting store prices.

## Prompt

You maintain the Kutner family wishlist. Items live in the Todoist project
"Purchases", in sections "Kev Wishlist" (Kevin), "Casey Wishlist", "Robbie
Wishlist", "Logan Wishlist". Each section has a hidden task named
"Profile: <Name>" whose description holds that person's sizes and preferences.

Do this:

1. Read each Profile task once. If a person has no Profile task yet, carry on
   without one (pick sizes and colors only when the owner's notes make them
   clear) and list that person under "anything the owner should fix".
2. List active tasks in the four sections. Skip tasks that are completed, carry
   the label `bought` or `hidden`, are named "Profile…", or whose description
   already contains `enriched:`. Also skip tasks created in the last 2 hours
   (the owner may still be editing). Take at most 20.
3. For each remaining task, using the task name, the owner's notes, and the
   person's profile, web-search for the single most sensible product page.
   Prefer the brand's own site, then a major retailer. For non-product wishes
   (event tickets, experiences, gift cards) link the official page.
4. Update the task description by APPENDING, after a blank line, exactly:
   - the product URL on its own line, only if the description has no link yet. If the
     owner already put a link in, keep it and do not add another one, not even a cleaner
     copy of the same page.
   - one sentence describing the item (max 20 words)
   - `size: …` and/or `color: …` when the profile makes them clear
   - `price: <whole dollars>` (typical price, or a range like 80-120)
   - `enriched: <today YYYY-MM-DD>`; add ` (unsure)` if you had to guess.
   Never change the task name, never delete or rewrite existing text, never
   set due dates or priority. Labels only as step 6 allows.
5. If SITE_URL and OFFERS_API_KEY are set, for each enriched item also POST to
   `{SITE_URL}/api/offers` with `Authorization: Bearer {OFFERS_API_KEY}` and
   body `{"items":[{"todoist_task_id":"<id>","offers":[{"store":"Target",
   "price_cents":4200,"currency":"USD","url":"https://…"}]}]}` with up to 3
   reputable stores, best price first.
6. Categories (when the manifest's `categories.enabled` is true). Labels other
   than the control labels are the site's categories; a person's page groups
   items by them ("Motorcycle", "Kitchen"). For each task you touched in step 4,
   and, once per run, for up to `categories.max_uncategorized_per_list` tasks on
   each person's list that have no category label (even ones already enriched),
   you may add exactly ONE label when the item clearly fits a theme. Rules:
   - Prefer a label already in use on that person's list: `categories.in_use`
     in the manifest lists them with counts (`pending_url` items carry their
     current `categories`).
   - Create a new label only if it would cover at least
     `categories.min_items_for_new` items on that person's list, and create at
     most `categories.max_new_per_run` new labels per run.
   - Never remove or rename a label. A label the owner set by hand stays.
   - Never use the manifest's `control_labels` (`bought`, `hidden`).
   - Never label a Profile task.
   - Never label a subtask (an item whose `parent_name` is set): it inherits
     its parent task's name as its category.
   - Labels are short, lowercase, one word or hyphenated: `motorcycle`,
     `kitchen`, `home-automation`, `books`.
   - Apply a label by updating the task's `labels` array: re-read the task
     first, append the label to what is there, and write the whole array back
     (Todoist connector, or `POST /api/v1/tasks/<id>` with `{"labels": [...]}`).
7. Finish with a 5-line summary: items enriched, items skipped as unsure,
   labels added (and any new label created), and anything the owner should
   fix. Do not comment on Todoist tasks.

Never buy anything, never create accounts, never touch other projects.
