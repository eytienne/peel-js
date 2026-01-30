<script lang="ts">
	import { base } from '$app/paths';
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Peel.js documentaion</title>
	<meta name="description" content="Javascript micro library for creating peeling effects using just HTML5">
	<link rel="icon" href="{base}/images/texture-1.png" />
	<link href="//fonts.googleapis.com/css?family=Roboto+Slab" rel="stylesheet" type="text/css">
</svelte:head>
{@render children()}
