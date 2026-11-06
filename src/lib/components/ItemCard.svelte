<script lang="ts">
	import { categoryLabel, formatPrice } from '#lib/format';
	import type { ItemView } from '#lib/types';
	let { item, href }: { item: ItemView; href: string } = $props();
	const partial = $derived(item.qty > 1 && item.purchasedCount > 0 && !item.purchased);
</script>

<a class="card" class:purchased={item.purchased} {href} data-sveltekit-noscroll>
	<div class="pic">
		{#if item.imageUrl}
			<img src={item.imageUrl} alt="" loading="lazy" />
		{:else}
			<svg aria-hidden="true"><use href="#i-gift" /></svg>
		{/if}
	</div>
	<div class="body">
		<h3 class="name">{item.name}</h3>
		{#if item.desireLabel}
			<span class="want d{item.desire}">{item.desireLabel}</span>
		{/if}
		<div class="meta">
			{#if item.headlinePriceCents !== null}
				<span class="price">
					{#if item.headlineIsEstimate}~{/if}{formatPrice(item.headlinePriceCents)}
					{#if item.headlineIsEstimate}<small>about</small>{/if}
				</span>
			{:else}
				<span class="price none">—</span>
			{/if}
			{#if item.categories.length}
				<span class="cat">{categoryLabel(item.categories[0])}</span>
			{/if}
		</div>
		<div class="foot">
			<span class="best">
				{#if item.bestOffer && item.bestOffer.priceCents !== null}
					Best price <b>{formatPrice(item.bestOffer.priceCents)}</b> at {item.bestOffer.store}
				{:else}
					<span class="muted">No price found yet</span>
				{/if}
			</span>
			{#if item.purchased}
				<span class="pill bought">Purchased</span>
			{:else if partial}
				<span class="pill partial">{item.purchasedCount} of {item.qty} purchased</span>
			{:else}
				<span class="pill avail">Available</span>
			{/if}
		</div>
	</div>
</a>

<style>
	.card {
		display: grid;
		grid-template-columns: 96px minmax(0, 1fr);
		gap: 14px;
		padding: 14px;
		background: var(--surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		color: inherit;
		text-decoration: none;
		transition: transform 0.12s ease;
	}
	.card:hover {
		transform: translateY(-1px);
	}
	.card.purchased {
		opacity: 0.55;
	}
	.card.purchased .name {
		text-decoration: line-through;
		text-decoration-color: var(--ink-3);
	}
	.pic {
		width: 96px;
		height: 96px;
		border-radius: 14px;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 5px;
		min-width: 0;
	}
	.name {
		margin: 0;
		font-family: var(--serif);
		font-weight: 600;
		font-size: 19px;
		line-height: 1.15;
		letter-spacing: -0.01em;
		overflow-wrap: anywhere;
	}
	.want {
		align-self: flex-start;
	}
	.meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-top: 2px;
	}
	.price {
		font-family: var(--serif);
		font-size: 18px;
		font-weight: 600;
		white-space: nowrap;
	}
	.price.none {
		color: var(--ink-3);
	}
	.price small {
		font-family: var(--sans);
		font-size: 11px;
		font-weight: 500;
		color: var(--ink-3);
		margin-left: 4px;
	}
	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: 12px;
		color: var(--ink-2);
		margin-top: 2px;
		flex-wrap: wrap;
	}
	.foot b {
		color: var(--ink);
	}
	@media (max-width: 360px) {
		.card {
			grid-template-columns: 72px minmax(0, 1fr);
		}
		.pic {
			width: 72px;
			height: 72px;
		}
	}
</style>
