
<script lang="ts">
	// import Counter from './Counter.svelte';
	import Webglcanvas from './Webglcanvas.svelte';
	import Test from './Test.svelte';
	import Splitter from '../components/Splitter.svelte';
	import TabWidget from '../components/TabWidget.svelte';
	import type { TabItem } from '../components/TabWidget.svelte';
    import Tab1 from '../components/Tab1.svelte';
    import Tab2 from '../components/Tab2.svelte';
    import TreeView, { type TreeViewProps } from '../components/TreeView.svelte';


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

	const tree: TreeViewProps = {
		label: "root", type: "root", children: [
			{label: "Loaded datasets", children: [
				{label: "(4F-Ph)6 melem 320 nm ex 100acc"},
				{label: "Group 1", children: [
					{label: "Trace 1"},
					{label: "Trace 2"},
					{label: "Trace 3"},
				]},
				{label: "Unrelated dataset"},
			]},
			{label: "Processed datasets", children: [
				{label: "Dataset 1"},
				{label: "Kin 12"},
				{label: "Sacramento"},
			]},
			{label: "Fitted datasets", children: [
				{label: "Fit 1"},
				{label: "Fit 2"},
				{label: "Fit 3"},
			]},
		],
	}

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
			<!-- <span>First</span> -->
			<TreeView {...tree} />
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

