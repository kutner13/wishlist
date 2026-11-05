<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Kutner family wishlist</title>
</svelte:head>

<main class="page">
	<header class="top">
		<div>
			<h1 class="title">Kutner family wishlist</h1>
			<p class="sub">Pick a person to see their list</p>
		</div>
	</header>

	{#if data.banner}
		<div class="banner" role="note">
			<svg aria-hidden="true"><use href="#i-gift" /></svg>
			<div>
				<b>{data.banner}</b><span>Items already bought are hidden unless you show them</span>
			</div>
		</div>
	{/if}

	<nav class="people" aria-label="People">
		{#each data.people as p (p.id)}
			<a class="person" href="{data.base}/{p.slug}">
				<div class="pic thumb">
					{#if p.thumbnailUrl}
						<img src={p.thumbnailUrl} alt="" loading="lazy" />
					{:else}
						<svg aria-hidden="true"><use href="#i-gift" /></svg>
					{/if}
				</div>
				<div class="who">
					<div class="name">{p.name}</div>
					<div class="count">
						{#if p.available === 0}
							<span class="muted">Nothing left to buy</span>
						{:else}
							<b>{p.available}</b> available
						{/if}
					</div>
				</div>
				<span class="chev" aria-hidden="true">›</span>
			</a>
		{/each}
	</nav>

	{#if data.lastUpdated}
		<footer class="foot">Last updated {data.lastUpdated}</footer>
	{/if}
</main>

<style>
	.banner {
		display: flex;
		align-items: center;
		gap: 12px;
		background: var(--accent-soft);
		border-radius: var(--radius-sm);
		padding: 12px 14px;
		margin: 4px 0 16px;
		color: var(--accent-deep);
	}
	.banner svg {
		width: 28px;
		height: 28px;
		flex: 0 0 auto;
	}
	.banner b {
		display: block;
		font-size: 15px;
	}
	.banner span {
		font-size: 12px;
		color: var(--ink-2);
	}
	.people {
		display: grid;
		gap: 12px;
	}
	.person {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px;
		background: var(--surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		color: inherit;
		text-decoration: none;
	}
	.person:hover .name {
		color: var(--accent-deep);
	}
	.thumb {
		width: 64px;
		height: 64px;
		border-radius: 14px;
	}
	.name {
		font-family: var(--serif);
		font-weight: 600;
		font-size: 22px;
		line-height: 1.1;
	}
	.count {
		font-size: 13px;
		color: var(--ink-2);
		margin-top: 3px;
	}
	.count b {
		color: var(--green);
	}
	.chev {
		margin-left: auto;
		color: var(--ink-3);
		font-size: 24px;
	}
	@media (min-width: 640px) {
		.people {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
