<script>
	import Counter from './Counter.svelte';
	import Webglcanvas from './Webglcanvas.svelte';
	import Test from './Test.svelte';
</script>


<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<div>

	<Counter />
	<Webglcanvas />
	<Test />

</div>

<style>
	/* section {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		flex: 0.6;
	} */

</style>
