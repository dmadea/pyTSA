
<script lang="ts">
	// import Counter from './Counter.svelte';
	import Webglcanvas from './Webglcanvas.svelte';
	import Test from './Test.svelte';
	import Splitter from '../components/Splitter.svelte';
	import TabWidget from '../components/TabWidget.svelte';
	import type { TabItem } from '../components/TabWidget.svelte';
    import Tab1 from '../components/Tab1.svelte';
    import Tab2 from '../components/Tab2.svelte';


	const items: TabItem[] = [{
		label: "Tabasd asd 1",
		id: 0,
		component: Tab1
	},
	{
		label: "Tab2",
		id: 1,
		component: Tab2
	}]

</script>


<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<div>

	<!-- <Webglcanvas />
	<Test /> -->
	<div class="mainarea">
		<Splitter>
			{#snippet left()}
			<span>First</span>
			{/snippet}
			{#snippet middle()}
			<TabWidget items={items}/>
			{/snippet}
			{#snippet right()}
			<Webglcanvas />
			{/snippet}
		</Splitter>
		
	</div>
</div>

<style>

	.mainarea {
		width: 100%;
		height: 800px;
	}
	/* section {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		flex: 0.6;
	} */

</style>

