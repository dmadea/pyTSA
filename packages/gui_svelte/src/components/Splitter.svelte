<script lang='ts'>
    import type { Snippet } from "svelte";

    interface Props {
        left: Snippet,
        middle: Snippet,
        right: Snippet,
        columngap?: string,
        barwidth?: string,
        minwidth?: string,
    }


    let {left, middle, right, columngap = "2px", barwidth = "5px", minwidth = "100px"}: Props = $props();
    let splitterDiv = $state<HTMLDivElement>();
    let bar1 = $state<HTMLDivElement>();
    let bar2 = $state<HTMLDivElement>();
    let dragbar = $state<HTMLDivElement>();

    let render1 = $state<boolean>(true);
    let render2 = $state<boolean>(true);

    let dragging = $state<boolean>(false);

    var gridTemplateColumns = $state<string>(`20% ${barwidth} 1fr ${barwidth} 20%`);

    var colgap = Number.parseFloat(columngap.substring(0, columngap.length - 2));
    var bw = Number.parseFloat(barwidth.substring(0, barwidth.length - 2));
    var mw = Number.parseFloat(minwidth.substring(0, minwidth.length - 2));

    function barMouseDown(e: MouseEvent) {
        e.preventDefault()
        dragbar = e.target as HTMLDivElement;
        const lastPos = e.clientX;
        var l1 = bar1!.offsetLeft - splitterDiv!.offsetLeft;
        var l2 = bar2!.offsetLeft - splitterDiv!.offsetLeft;
        let splitterDivWidth = splitterDiv!.clientWidth;

        var mousemove = (e: MouseEvent) => {
            e.preventDefault()
            dragging = true;
            let dist = e.clientX - lastPos;
            let d1 = Math.min(l1 - colgap + (dragbar == bar1 ? dist : 0), splitterDivWidth * 0.4);
            let d2 = Math.min(splitterDivWidth - l2 - colgap - bw - (dragbar == bar2 ? dist : 0), splitterDivWidth * 0.4);

            render1 = d1 >= mw / 2;
            render2 = d2 >= mw / 2;

            d1 = Math.max(mw, d1);
            d2 = Math.max(mw, d2);

            let t1 = render1 ? `${d1 * 100 / splitterDivWidth}%` : "";
            let t2 = render2 ? `${d2 * 100 / splitterDivWidth}%` : "";

            gridTemplateColumns = `${t1} ${barwidth} 1fr ${barwidth} ${t2}`
        }

        var mouseup = (e: MouseEvent) => {
            e.preventDefault()
            window.removeEventListener('mousemove', mousemove);
            window.removeEventListener('mouseup', mouseup);
            dragging = false;
        }

        window.addEventListener('mousemove', mousemove);
        window.addEventListener('mouseup', mouseup);
    }
</script>



<div class="spitter-div" bind:this={splitterDiv} style="--grid-template-columns: {gridTemplateColumns}; --column-gap: {columngap}">
    {#if render1}
        {@render left()}
    {/if}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="bar" class:dragging={dragging && bar1 == dragbar} style="--bar-width: {barwidth}" bind:this={bar1} onmousedown={barMouseDown}></div>
    {@render middle()}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="bar" class:dragging={dragging  && bar2 == dragbar} style="--bar-width: {barwidth}" bind:this={bar2} onmousedown={barMouseDown}></div>
    {#if render2}
        {@render right()}
    {/if}
</div>



<style>

    .spitter-div {
        display: grid;
        grid-template-columns: var(--grid-template-columns);
        grid-template-rows: auto;
        width: 100%;
        height: 100%;
        /* outline: black 1px solid; */
        /* overflow: hidden; */
        box-sizing: border-box;
    
        column-gap: var(--column-gap);
        row-gap: 0px;
    }
    
    .bar {
        width: var(--bar-width);
        /* background-color: #d80000; */
        cursor: ew-resize;
    }

    .dragging {
        background-color: #707070;
    }

    .bar:hover {
        background-color: #707070;
    }

</style>
    