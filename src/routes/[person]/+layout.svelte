<script lang="ts">
	import { page } from '$app/state';
	import ItemCard from '#lib/components/ItemCard.svelte';
	import { listUrl } from '#lib/format';
	let { data, children } = $props();

	const sheetOpen = $derived(Boolean(page.params.item));

	const withParam = (key: string, value: string | null) =>
		listUrl(data.base, data.person.slug, data.search, key, value);
	function submitOnChange(e: Event) {
		(e.currentTarget as HTMLSelectElement).form?.requestSubmit();
	}
</script>

<svelte:head>
	<title>{data.person.name} · Kutner family wishlist</title>
</svelte:head>

<main
	class="page list-page"
	class:under-sheet={sheetOpen}
	aria-hidden={sheetOpen ? 'true' : undefined}
>
	<header class="top">
		<div>
			<a class="back" href="{data.base}/">‹ Family</a>
			<h1 class="title">{data.person.name}</h1>
		</div>
		<div class="count">{data.total} items · {data.available} available</div>
	</header>

	<form
		class="filters"
		method="get"
		action="{data.base}/{data.person.slug}"
		data-sveltekit-noscroll
	>
		<div class="chips" role="group" aria-label="Filters">
			<a
				class="chip"
				class:on={data.filters.availableOnly}
				href={withParam('all', data.filters.availableOnly ? '1' : null)}
				data-sveltekit-noscroll>Available only</a
			>
			{#if !data.filters.availableOnly}<input type="hidden" name="all" value="1" />{/if}
			<label class="chip select" class:on={!!data.filters.category}>
				<span class="visually-hidden">Category</span>
				<select name="cat" onchange={submitOnChange}>
					<option value="">Category</option>
					{#each data.categories as c (c)}
						<option value={c} selected={data.filters.category === c}>{c}</option>
					{/each}
				</select>
			</label>
			<label class="chip select" class:on={!!data.filters.band}>
				<span class="visually-hidden">Price</span>
				<select name="price" onchange={submitOnChange}>
					<option value="">Price</option>
					{#each data.bands as b (b.key)}
						<option value={b.key} selected={data.filters.band === b.key}>{b.label}</option>
					{/each}
				</select>
			</label>
			<label class="chip select" class:on={!!data.filters.occasion}>
				<span class="visually-hidden">Occasion</span>
				<select name="occasion" onchange={submitOnChange}>
					<option value="">Occasion</option>
					<option value="birthday" selected={data.filters.occasion === 'birthday'}>Birthday</option>
					<option value="holidays" selected={data.filters.occasion === 'holidays'}>Holidays</option>
				</select>
			</label>
		</div>
		<div class="sortrow">
			<span>Showing {data.items.length} of {data.total}</span>
			<label class="sort">
				Sort:
				<select name="sort" onchange={submitOnChange}>
					<option value="desire" selected={data.filters.sort === 'desire'}>Desire</option>
					<option value="price" selected={data.filters.sort === 'price'}>Price</option>
					<option value="newest" selected={data.filters.sort === 'newest'}>Newest</option>
				</select>
			</label>
			<noscript><button class="btn ghost apply" type="submit">Apply</button></noscript>
		</div>
	</form>

	{#if data.items.length === 0}
		<p class="empty">
			{#if data.total === 0}
				Nothing on {data.person.name}'s list yet.
			{:else if data.filters.availableOnly && data.available === 0}
				Everything on this list has been bought.
				<a href={withParam('all', '1')} data-sveltekit-noscroll>Show purchased items</a>
			{:else}
				Nothing matches these filters.
				<a href="{data.base}/{data.person.slug}" data-sveltekit-noscroll>Clear filters</a>
			{/if}
		</p>
	{:else}
		<div class="items">
			{#each data.items as item (item.id)}
				<ItemCard {item} href="{data.base}/{data.person.slug}/{item.id}{data.search}" />
			{/each}
		</div>
	{/if}
</main>

{@render children()}

<style>
	.filters {
		margin: 0 calc(-1 * var(--gutter));
	}
	.chips {
		display: flex;
		gap: 6px;
		padding: 2px var(--gutter) 6px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.chips::-webkit-scrollbar {
		display: none;
	}
	.chip {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		padding: 7px 12px;
		border-radius: 999px;
		border: 1px solid var(--line);
		font-size: 12px;
		font-weight: 500;
		color: var(--ink-2);
		background: var(--surface);
		white-space: nowrap;
		text-decoration: none;
		cursor: pointer;
	}
	.chip.on {
		background: var(--ink);
		color: #fff;
		border-color: var(--ink);
	}
	.chip.select {
		padding: 0;
	}
	.chip.select select {
		appearance: none;
		-webkit-appearance: none;
		background: transparent;
		border: 0;
		padding: 7px 24px 7px 12px;
		font-size: 12px;
		font-weight: 500;
		color: inherit;
		cursor: pointer;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0h10L5 6z' fill='%238a7b6a'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 10px center;
		border-radius: 999px;
	}
	.chip.on select {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0h10L5 6z' fill='%23ffffff'/%3E%3C/svg%3E");
	}
	.chip.select select option {
		color: var(--ink);
		background: var(--surface);
	}
	.sortrow {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		padding: 4px var(--gutter) 10px;
		font-size: 12px;
		color: var(--ink-2);
	}
	.sort select {
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 4px 6px;
		background: var(--surface);
		font-size: 12px;
	}
	.apply {
		width: auto;
	}
	.items {
		display: grid;
		gap: 12px;
	}
	.empty {
		background: var(--surface);
		border-radius: var(--radius);
		padding: 24px 16px;
		text-align: center;
		color: var(--ink-2);
	}
	@media (min-width: 900px) {
		.items {
			grid-template-columns: 1fr 1fr;
		}
	}
	/* Without JS the sheet renders as a full page; hide the list under it. */
	:global(html:not(.js)) .list-page.under-sheet {
		display: none;
	}
</style>
