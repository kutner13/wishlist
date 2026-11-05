<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { formatPrice, longDate, shortUrl, timeAgo } from '#lib/format';
	import { onMount } from 'svelte';

	let { data, form } = $props();
	const item = $derived(data.item);
	const listHref = $derived(`${data.base}/${data.person.slug}${data.search}`);
	const partial = $derived(item.qty > 1 && item.purchasedCount > 0 && !item.purchased);
	const canUndo = $derived(item.purchasedCount > 0);
	const needsConfirm = $derived(form?.action === 'undo' && form?.needsConfirm === true);
	const justMarked = $derived(form?.action === 'purchase' && form?.ok === true);
	let busy = $state(false);
	let sheet = $state<HTMLElement | null>(null);

	function close() {
		goto(listHref, { reset: false });
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
	onMount(() => {
		sheet?.focus();
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	});
</script>

<svelte:head>
	<title>{item.name} · {data.person.name} · Kutner family wishlist</title>
</svelte:head>

<svelte:window onkeydown={onKey} />

<div class="scrim-wrap">
	<a
		class="scrim"
		href={listHref}
		aria-label="Close"
		data-sveltekit-noscroll
		onclick={(e) => {
			e.preventDefault();
			close();
		}}
	></a>
	<div
		class="sheet"
		role="dialog"
		aria-modal="true"
		aria-labelledby="item-title"
		tabindex="-1"
		bind:this={sheet}
	>
		<div class="grab" aria-hidden="true"></div>
		<a
			class="close-link"
			href={listHref}
			data-sveltekit-noscroll
			onclick={(e) => {
				e.preventDefault();
				close();
			}}>‹ Back to {data.person.name}'s list</a
		>

		<div class="pic hero">
			{#if item.imageUrl}
				<img src={item.imageUrl} alt="" />
			{:else}
				<svg aria-hidden="true"><use href="#i-gift" /></svg>
			{/if}
		</div>

		<h2 id="item-title" class="name">{item.name}</h2>
		<div class="line">
			{#if item.desireLabel}<span class="want d{item.desire}">{item.desireLabel}</span>{/if}
			{#each item.categories as c (c)}<span class="cat">{c}</span>{/each}
			{#if item.purchased}
				<span class="pill bought">Purchased</span>
			{:else if partial}
				<span class="pill partial">{item.purchasedCount} of {item.qty} purchased</span>
			{:else}
				<span class="pill avail">Available</span>
			{/if}
			{#if item.aboutPriceCents !== null}
				<span class="about">~{formatPrice(item.aboutPriceCents)}</span>
			{/if}
		</div>

		{#if item.notes}
			<p class="notes">{item.notes}</p>
		{/if}
		{#if item.size || item.color}
			<p class="details">
				{#if item.size}<span><b>Size</b> {item.size}</span>{/if}
				{#if item.color}<span><b>Color</b> {item.color}</span>{/if}
			</p>
		{/if}
		{#if item.enrichedAt}
			<p class="enriched muted small">
				Link and details added automatically on {longDate(item.enrichedAt)}
			</p>
		{/if}
		{#if item.productUrl}
			<p class="link">
				<a href={item.productUrl} target="_blank" rel="noopener noreferrer nofollow"
					>{shortUrl(item.productUrl)} ↗</a
				>
			</p>
		{/if}

		<div class="offers">
			<div class="hd">
				Where to buy
				<span
					>{item.offers.length === 0
						? 'no prices yet'
						: `${item.offers.length} ${item.offers.length === 1 ? 'offer' : 'offers'} · no affiliate links`}</span
				>
			</div>
			{#if item.offers.length === 0}
				<div class="offer none">
					{#if item.productUrl}Use the product link above; a price check runs daily.{:else}No link
						yet. Ask the owner, or search for it by name.{/if}
				</div>
			{/if}
			{#each item.offers as o (o.id)}
				<div class="offer" class:best={o.isBest}>
					<div class="store">
						{#if o.url}<a href={o.url} target="_blank" rel="noopener noreferrer nofollow"
								>{o.store}</a
							>{:else}{o.store}{/if}
						{#if o.isBest}<span class="tag">Best</span>{/if}
					</div>
					<div class="p">
						{#if o.priceCents !== null}{formatPrice(o.priceCents, o.currency)}{:else}<span
								class="muted">link</span
							>{/if}
					</div>
					<div class="when">
						checked {timeAgo(o.fetchedAt)} · {o.source === 'page'
							? 'product page'
							: o.source === 'claude'
								? 'price routine'
								: 'added by owner'}
					</div>
				</div>
			{/each}
		</div>

		{#if item.purchased && item.boughtInTodoist && item.purchasedCount === 0}
			<button class="btn done" type="button" disabled>Purchased ✓</button>
			<p class="todoist-note">Marked as bought by the owner.</p>
		{:else if item.purchased}
			<button class="btn done" type="button" disabled>Purchased ✓</button>
		{:else}
			<form
				method="post"
				action="?/purchase"
				use:enhance={() => {
					busy = true;
					return async ({ update }) => {
						await update();
						busy = false;
					};
				}}
			>
				<button class="btn" type="submit" disabled={busy}>
					{#if partial}Mark another purchased{:else}Mark purchased{/if}
				</button>
			</form>
		{/if}

		{#if canUndo}
			<div class="undo">
				{#if needsConfirm}
					<form method="post" action="?/undo" use:enhance class="confirm">
						<input type="hidden" name="confirm" value="1" />
						<p>Did someone buy this by mistake? This was marked from another device.</p>
						<button class="btn ghost" type="submit">Yes, release it</button>
						<a
							href={listHref ? `${data.base}/${data.person.slug}/${item.id}${data.search}` : ''}
							class="cancel"
							data-sveltekit-noscroll>Keep it marked</a
						>
					</form>
				{:else}
					<form method="post" action="?/undo" use:enhance>
						{#if item.purchasedCount > 0}
							Marked {justMarked ? 'just now' : timeAgo(data.lastMarkedAt)} ·
						{/if}
						<button class="linkbtn" type="submit">Undo</button>
					</form>
				{/if}
			</div>
		{/if}

		<p class="todoist-note">
			{#if justMarked}
				Saved. Todoist gets the @bought label in the background; if that fails it retries – you're
				done either way.
			{:else if form?.action === 'purchase' && form?.ok === false}
				Someone else already marked this one.
			{:else}
				No name, no sign-in. The owner will see it marked bought in Todoist.
			{/if}
		</p>
	</div>
</div>

<style>
	/* Plain page without JS; bottom sheet over the list with JS. */
	.sheet {
		background: var(--surface);
		border-radius: var(--radius);
		padding: 10px var(--gutter) 20px;
		max-width: 720px;
		margin: 16px auto 32px;
		box-shadow: var(--shadow);
		outline: none;
	}
	.scrim,
	.grab {
		display: none;
	}
	:global(html.js) .scrim-wrap {
		position: fixed;
		inset: 0;
		z-index: 20;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}
	:global(html.js) .scrim {
		display: block;
		position: absolute;
		inset: 0;
		background: rgba(43, 37, 32, 0.45);
		animation: fade 0.15s ease-out;
	}
	:global(html.js) .sheet {
		position: relative;
		margin: 0;
		width: 100%;
		max-height: 92dvh;
		overflow-y: auto;
		border-radius: 22px 22px 0 0;
		box-shadow: 0 -8px 30px rgba(43, 37, 32, 0.25);
		animation: rise 0.2s ease-out;
		padding-bottom: max(20px, env(safe-area-inset-bottom));
	}
	:global(html.js) .grab {
		display: block;
		width: 40px;
		height: 5px;
		border-radius: 3px;
		background: var(--line);
		margin: 2px auto 10px;
	}
	:global(html.js) .close-link {
		display: none;
	}
	@media (min-width: 720px) {
		:global(html.js) .scrim-wrap {
			align-items: center;
		}
		:global(html.js) .sheet {
			max-width: 560px;
			border-radius: var(--radius);
			max-height: 90dvh;
		}
	}
	@keyframes rise {
		from {
			transform: translateY(24px);
			opacity: 0.6;
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	.close-link {
		display: inline-block;
		font-size: 13px;
		color: var(--ink-2);
		text-decoration: none;
		margin: 6px 0 10px;
	}
	.hero {
		height: 180px;
		border-radius: 14px;
	}
	.name {
		font-family: var(--serif);
		font-weight: 600;
		font-size: 24px;
		line-height: 1.15;
		letter-spacing: -0.01em;
		margin: 12px 0 6px;
		overflow-wrap: anywhere;
	}
	.line {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		margin: 4px 0;
	}
	.about {
		margin-left: auto;
		font-family: var(--serif);
		font-size: 15px;
		color: var(--ink-2);
	}
	.notes {
		font-size: 14px;
		color: var(--ink-2);
		margin: 8px 0;
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	.details {
		display: flex;
		gap: 14px;
		flex-wrap: wrap;
		font-size: 13px;
		color: var(--ink-2);
		margin: 4px 0;
	}
	.details b {
		color: var(--ink);
		font-weight: 600;
	}
	.enriched {
		margin: 4px 0;
	}
	.link {
		font-size: 13px;
		margin: 6px 0;
		overflow-wrap: anywhere;
	}
	.offers {
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		margin: 12px 0 14px;
		overflow: hidden;
	}
	.offers .hd {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 12px;
		font-weight: 700;
		padding: 8px 12px;
		background: var(--surface-2);
		border-bottom: 1px solid var(--line);
	}
	.offers .hd span {
		font-weight: 500;
		color: var(--ink-3);
		text-align: right;
	}
	.offer {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 2px 10px;
		padding: 9px 12px;
		border-top: 1px solid var(--surface-2);
		font-size: 13px;
		align-items: center;
	}
	.offer:first-of-type {
		border-top: 0;
	}
	.offer.none {
		display: block;
		color: var(--ink-2);
	}
	.offer .store {
		font-weight: 600;
		grid-column: 1;
		grid-row: 1;
	}
	.offer .store a {
		color: inherit;
	}
	.offer .when {
		font-size: 11px;
		color: var(--ink-3);
		grid-column: 1;
		grid-row: 2;
	}
	.offer .p {
		font-family: var(--serif);
		font-weight: 600;
		font-size: 17px;
		grid-column: 2;
		grid-row: 1 / span 2;
		text-align: right;
	}
	.offer.best {
		background: var(--accent-soft);
	}
	.tag {
		font-size: 10px;
		background: var(--accent);
		color: #fff;
		border-radius: 4px;
		padding: 1px 5px;
		margin-left: 6px;
		vertical-align: middle;
	}
	.undo {
		text-align: center;
		font-size: 13px;
		margin-top: 10px;
		color: var(--ink-2);
	}
	.confirm {
		background: var(--amber-soft);
		border-radius: var(--radius-sm);
		padding: 12px;
		display: grid;
		gap: 8px;
	}
	.confirm p {
		margin: 0;
		color: var(--amber-ink);
	}
	.confirm .cancel {
		font-size: 13px;
	}
	.todoist-note {
		font-size: 11px;
		color: var(--ink-3);
		text-align: center;
		margin: 10px 0 0;
	}
</style>
