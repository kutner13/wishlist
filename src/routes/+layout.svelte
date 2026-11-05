<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
	<symbol
		id="i-gift"
		viewBox="0 0 48 48"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linejoin="round"
	>
		<rect x="7" y="18" width="34" height="24" rx="3" />
		<path d="M5 12h38v6H5zM24 12v30M24 12c-6 0-9-3-9-6s7-2 9 6c2-8 9-9 9-6s-3 6-9 6" />
	</symbol>
</svg>

{@render children()}
