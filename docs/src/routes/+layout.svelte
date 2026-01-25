<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link href="//fonts.googleapis.com/css?family=Roboto+Slab" rel="stylesheet" type="text/css">
</svelte:head>
{@render children()}
