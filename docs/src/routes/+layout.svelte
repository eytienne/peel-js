<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<title>Peel.js documentaion</title>
	<meta name="description" content="Javascript micro library for creating peeling effects using just HTML5">
	<link rel="icon" href={favicon} />
	<link href="//fonts.googleapis.com/css?family=Roboto+Slab" rel="stylesheet" type="text/css">
</svelte:head>
{@render children()}
