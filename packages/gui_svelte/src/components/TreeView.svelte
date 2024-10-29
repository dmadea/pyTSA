<script module>
    export interface TreeViewProps {
        label: String,
        children?: TreeViewProps[],
        type?: 'matrix' | 'trace' | 'root' | ""
    }

</script>
<script lang='ts'>
    import { slide } from 'svelte/transition';
	import TreeView from './TreeView.svelte';

	let {label, children, type = "" }: TreeViewProps  = $props();

	let expanded = $state((type === "root") ? true : false)
	const toggleExpansion = () => {
		expanded = !expanded
	}

</script>

<ul class:no-padding={type === 'root'} ><!-- transition:slide -->
	<li transition:slide>
		{#if children}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
            {#if type !== "root"}
                <span onclick={toggleExpansion}>
                    <span class="arrow" class:arrowDown={expanded}>&#x25b6</span>
                    {label}
                </span>
            {/if}
			{#if expanded}
				{#each children as child}
					<TreeView {...child} />
				{/each}
			{/if}
		{:else}
			<span>
				<span class="no-arrow"></span>
				{label}
			</span>
		{/if}
	</li>
</ul>

<style>
	ul {
		margin: 0;
		list-style: none;
		padding-left: 1.2rem; 
		user-select: none;
	}

    .no-padding {
        padding-left: 0rem; 
    }

	.no-arrow { padding-left: 1.0rem; }
	.arrow {
		cursor: pointer;
		display: inline-block;
		transition: transform 200ms;
	}
	.arrowDown { transform: rotate(90deg); }
</style>
