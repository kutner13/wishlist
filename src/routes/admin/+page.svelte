<script lang="ts">
	import { enhance } from '$app/forms';
	import { minutesToNextQuarter, shortDate, timeAgo, timeUntil } from '#lib/format';
	let { data, form } = $props();
	const h = $derived(data.health);
	let busy = $state<string | null>(null);
	let showArchive = $state(false);
	let showRotate = $state(false);

	function run(name: string) {
		return () => {
			busy = name;
			return async ({ update }: { update: () => Promise<void> }) => {
				await update();
				busy = null;
			};
		};
	}
	const nextSync = $derived(minutesToNextQuarter(h.now));
</script>

<svelte:head>
	<title>Admin · Kutner family wishlist</title>
</svelte:head>

<main class="page wide">
	<header class="adm-head">
		<div>
			<h1 class="title">Admin{h.seasonBanner ? ` · ${h.seasonBanner}` : ''}</h1>
			<p class="who">
				Signed in via Cloudflare Access as {data.who} · <a href="{data.base}/">view site</a> ·
				<a href="/admin/health">health JSON</a>
			</p>
		</div>
		<div class="actions">
			<form method="post" action="?/sync" use:enhance={run('sync')}>
				<button class="wbtn primary" type="submit" disabled={busy !== null}
					>{busy === 'sync' ? 'Syncing…' : 'Sync now'}</button
				>
			</form>
			<form method="post" action="?/refresh" use:enhance={run('refresh')}>
				<button class="wbtn" type="submit" disabled={busy !== null}
					>{busy === 'refresh' ? 'Refreshing…' : 'Refresh prices'}</button
				>
			</form>
			<button
				class="wbtn"
				type="button"
				onclick={() => (showRotate = !showRotate)}
				aria-expanded={showRotate}>Rotate guest link</button
			>
			<button
				class="wbtn danger"
				type="button"
				onclick={() => (showArchive = !showArchive)}
				aria-expanded={showArchive}>Archive season</button
			>
			<a class="wbtn" href="/api/admin/export" download="wishlist-export.json">Export JSON</a>
		</div>
	</header>

	{#if form?.message}
		<p class="flash" class:bad={form.ok === false} role="status">{form.message}</p>
	{/if}
	{#if !data.todoistConfigured}
		<p class="flash bad">TODOIST_TOKEN is not set: sync and Todoist writes are disabled.</p>
	{/if}

	{#if showRotate}
		<section class="panel note">
			<h2>Rotate guest link</h2>
			<p>
				The guest link is controlled by the <code>GUEST_SLUG</code> secret, which cannot be changed
				from inside the app.
				{#if data.guestSlug}
					Current guest URL prefix: <code>/{data.guestSlug}/</code>.
				{:else}
					No slug is set: guest pages are at the bare domain.
				{/if}
			</p>
			<p>
				To rotate: run <code>wrangler secret put GUEST_SLUG</code> with a new random value (for
				example <code>openssl rand -hex 8</code>), then send the new link to the family. The old
				link stops working immediately. To turn the slug off, set it to an empty value. See the
				README runbook.
			</p>
		</section>
	{/if}

	{#if showArchive}
		<section class="panel note danger-note">
			<h2>Archive season</h2>
			<p>
				Clears every purchase mark and queues removal of the <code>@bought</code> label in Todoist. Items
				stay. The guest link is unchanged.
			</p>
			<form method="post" action="?/archive" use:enhance={run('archive')} class="inline">
				<label
					>Type <b>ARCHIVE</b> to confirm
					<input name="confirm" autocomplete="off" required /></label
				>
				<button class="wbtn danger" type="submit" disabled={busy !== null}>Archive season</button>
			</form>
			{#if h.lastArchiveAt}<p class="small muted">Last archived {timeAgo(h.lastArchiveAt)}.</p>{/if}
		</section>
	{/if}

	<div class="grid">
		<div class="col">
			<section class="panel">
				<h2>Items per person</h2>
				<div class="counts">
					{#each data.people as p (p.id)}
						<div class="c">
							<b>{p.name}</b>
							<span>{p.total} items · <em>{p.available} available</em></span>
							<span>{p.purchased} purchased · {p.hidden} hidden</span>
						</div>
					{/each}
				</div>
			</section>

			<section class="panel">
				<h2>Purchased this season</h2>
				{#if data.purchased.length === 0}
					<p class="muted small">Nothing marked yet.</p>
				{:else}
					<table>
						<thead
							><tr><th>Item</th><th>Person</th><th class="r">When</th><th class="r">Todoist</th></tr
							></thead
						>
						<tbody>
							{#each data.purchased as r (r.item_id)}
								<tr>
									<td>{r.name}{r.qty > 1 ? ` (${r.count} of ${r.qty})` : ''}</td>
									<td>{r.person}</td>
									<td class="r">{r.marked_at ? shortDate(r.marked_at) : '—'}</td>
									<td class="r">
										{#if r.failed_writes > 0}
											<span class="dot bad"></span>retrying{r.last_error
												? ` · ${r.last_error.slice(0, 60)}`
												: ''}
										{:else if r.pending_writes > 0}
											<span class="dot warn"></span>queued
										{:else if r.count < r.qty && !r.bought_in_todoist}
											<span class="dot warn"></span>label when {r.qty}/{r.qty}
										{:else if r.bought_in_todoist && r.count === 0}
											<span class="dot ok"></span>set by hand
										{:else}
											<span class="dot ok"></span>@bought
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
				<p class="small muted">
					No guest names – only timestamps. Undo history is in the Todoist comments.
				</p>
			</section>
		</div>

		<div class="col">
			<section class="panel">
				<h2>Sync &amp; health</h2>
				<dl class="health">
					<dt>Last Todoist sync</dt>
					<dd>
						{#if h.lastTodoistSync.at}
							<span
								class="dot"
								class:ok={h.lastTodoistSync.ok}
								class:bad={h.lastTodoistSync.ok === false}
							></span>
							{timeAgo(h.lastTodoistSync.at)} · {h.lastTodoistSync.ok
								? `ok (${(h.lastTodoistSync.detail as { upserted?: number })?.upserted ?? '?'} tasks)`
								: h.lastTodoistSync.error}
						{:else}<span class="dot warn"></span>never{/if}
					</dd>
					<dt>Next scheduled sync</dt>
					<dd>in {nextSync} min (cron 15m) · webhook on change</dd>
					<dt>Last price refresh</dt>
					<dd>
						{#if h.lastPageRefresh.at}
							<span
								class="dot"
								class:ok={h.lastPageRefresh.ok}
								class:warn={h.lastPageRefresh.ok === false}
							></span>
							{timeAgo(h.lastPageRefresh.at)} · {(h.lastPageRefresh.detail as { checked?: number })
								?.checked ?? 0} pages checked
							{#if h.lastPageRefresh.error}· {h.lastPageRefresh.error}{/if}
						{:else}<span class="dot warn"></span>never{/if}
						· {h.offers.offers} offers on {h.offers.items} items
					</dd>
					<dt>Image cache</dt>
					<dd>
						{h.images.withImage} of {h.images.total} fetched · {h.images.total - h.images.withImage} placeholders
					</dd>
					<dt>Queued Todoist writes</dt>
					<dd>
						<span
							class="dot"
							class:ok={h.outbox.pending === 0}
							class:warn={h.outbox.pending > 0 && h.outbox.failing === 0}
							class:bad={h.outbox.failing > 0}
						></span>
						{h.outbox.pending} pending{#if h.outbox.failing > 0}, {h.outbox.failing} failing{/if}
						{#if h.outbox.nextAttemptAt && h.outbox.pending > 0}· next try {timeUntil(
								h.outbox.nextAttemptAt
							)}{/if}
						{#if h.outbox.lastError}<br /><span class="small muted">{h.outbox.lastError}</span>{/if}
						{#if h.outbox.pending > 0}
							<form method="post" action="?/drain" use:enhance={run('drain')} class="inline-form">
								<button class="linkbtn small" type="submit">retry now</button>
							</form>
						{/if}
					</dd>
					<dt>Errors (24 h)</dt>
					<dd>
						<span class="dot" class:ok={h.errors24h.count === 0} class:bad={h.errors24h.count > 0}
						></span>{h.errors24h.count}
						{#each h.errors24h.samples as e, i (i)}<br /><span class="small muted">{e}</span>{/each}
					</dd>
				</dl>
			</section>

			<section class="panel">
				<h2>Season</h2>
				<form method="post" action="?/banner" use:enhance={run('banner')} class="inline">
					<label class="visually-hidden" for="banner">Season banner text</label>
					<input
						id="banner"
						name="banner"
						value={h.seasonBanner}
						placeholder="e.g. Holidays 2026"
						maxlength="80"
					/>
					<button class="wbtn" type="submit" disabled={busy !== null}>Save banner</button>
				</form>
				<p class="small muted">
					Shown at the top of the family home page. Empty hides it. "Archive season" asks for a
					confirm, then clears all purchases and strips <code>@bought</code> labels in Todoist. Items
					stay.
				</p>
			</section>
		</div>
	</div>
	<p class="small muted">
		Everything about the items themselves (name, notes, price hint, who it's for) is edited in
		Todoist, not here.
	</p>
</main>

<style>
	.adm-head {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: flex-start;
		justify-content: space-between;
		padding: 20px 0 14px;
	}
	.title {
		font-family: var(--serif);
		font-size: 24px;
		margin: 0;
	}
	.who {
		font-size: 12px;
		color: var(--ink-3);
		margin: 4px 0 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.wbtn {
		display: inline-block;
		border: 1px solid var(--line);
		background: var(--surface);
		border-radius: 10px;
		padding: 8px 12px;
		font-size: 13px;
		font-weight: 600;
		color: var(--ink);
		white-space: nowrap;
		cursor: pointer;
		text-decoration: none;
	}
	.wbtn.primary {
		background: var(--accent);
		color: #fff;
		border-color: var(--accent);
	}
	.wbtn.danger {
		color: var(--danger);
		border-color: #e3b8b0;
	}
	.wbtn:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.flash {
		background: var(--green-soft);
		color: var(--green);
		border-radius: var(--radius-sm);
		padding: 10px 14px;
		font-size: 13px;
		overflow-wrap: anywhere;
	}
	.flash.bad {
		background: #fde3d6;
		color: var(--danger);
	}
	.grid {
		display: grid;
		gap: 14px;
		grid-template-columns: minmax(0, 1fr);
	}
	.col {
		display: grid;
		gap: 14px;
		align-content: start;
		min-width: 0;
	}
	@media (min-width: 820px) {
		.grid {
			grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
		}
	}
	.panel {
		background: var(--surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 14px 16px;
		min-width: 0;
	}
	.panel h2 {
		margin: 0 0 10px;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-3);
		font-weight: 600;
	}
	.panel.note {
		margin-bottom: 14px;
		font-size: 13px;
	}
	.panel.note p {
		margin: 6px 0;
	}
	.danger-note {
		border: 1px solid #e3b8b0;
	}
	.counts {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}
	@media (min-width: 560px) {
		.counts {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
	.counts .c {
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		padding: 10px;
	}
	.counts .c b {
		display: block;
		font-family: var(--serif);
		font-size: 17px;
	}
	.counts .c span {
		display: block;
		font-size: 11px;
		color: var(--ink-2);
	}
	.counts .c em {
		font-style: normal;
		color: var(--green);
		font-weight: 700;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}
	th {
		text-align: left;
		color: var(--ink-3);
		font-weight: 600;
		padding: 4px 6px;
		border-bottom: 1px solid var(--line);
	}
	td {
		padding: 6px;
		border-bottom: 1px solid var(--surface-2);
		vertical-align: top;
	}
	.r {
		text-align: right;
		white-space: nowrap;
	}
	@media (max-width: 560px) {
		table {
			font-size: 11px;
		}
		td,
		th,
		.r {
			white-space: normal;
			padding: 4px 3px;
		}
	}
	.health {
		display: grid;
		grid-template-columns: minmax(90px, 128px) minmax(0, 1fr);
		gap: 6px 10px;
		font-size: 12px;
		margin: 0;
	}
	.health dt {
		color: var(--ink-2);
	}
	.health dd {
		margin: 0;
		font-weight: 600;
		overflow-wrap: anywhere;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--surface-2);
	}
	.dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		margin-right: 6px;
		vertical-align: middle;
		background: var(--line);
	}
	.dot.ok {
		background: #2d9a4e;
	}
	.dot.warn {
		background: #e0a100;
	}
	.dot.bad {
		background: #c43b2a;
	}
	.inline {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}
	.inline label {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 13px;
	}
	.inline input,
	input#banner {
		font-size: 13px;
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 7px 9px;
		background: var(--surface);
		min-width: 0;
		flex: 1 1 160px;
	}
	.inline-form {
		display: inline;
		margin-left: 6px;
	}
	code {
		font-size: 12px;
		background: var(--surface-2);
		padding: 1px 5px;
		border-radius: 4px;
	}
</style>
