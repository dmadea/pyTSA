<script module>
    import type { Orientation } from "@pytsa/ts-graph-new/src/objects/draggableLines.js";

    export type AxisScale = 'lin' | 'log' | 'symlog' | 'databound'

    export interface AxisSettings {
        label: string,
        scale: AxisScale,
        linthresh: number,
        linscale: number,
        inverted: boolean
    }

    export interface SettingsMenuProps {
        title?: string,
        xaxis?: AxisSettings,
        yaxis?: AxisSettings,
        axisOrientation?: Orientation
    }

</script>


<script lang="ts">

    let { title = "title", xaxis, yaxis, axisOrientation }: SettingsMenuProps = $props()

    let pos = $state({ x: 0, y: 0 })
    // menu is dimension (height and width) of context menu
    let menu = { h: 0, w: 0 }
    // showMenu is state of context-menu visibility
    let showMenu = $state<boolean>(false)

    export function openClose(x: number, y: number) {
        // close the dialog if it is opened
        if (showMenu) {
            showMenu = false
            return
        }

        console.log("open settings menu")
        pos = {x, y};

        if (window.innerHeight -  pos.y < menu.h)
            pos.y = pos.y - menu.h
        if (window.innerWidth -  pos.x < menu.w)
            pos.x = pos.x - menu.w

        showMenu = true
    }

    // export function close() {
    //     showMenu = false
    // }

    // export function ifOpenedClose() {
    //     if (showMenu) {
    //         showMenu = false
    //     }
    // }

    // function rightClickContextMenu(e: MouseEvent){
        
    // }

    function onPageClick(e: MouseEvent){
        // To make context menu disappear when
        // mouse is clicked outside context menu
        // showMenu = false;
    }

    function getMenuDimension(node: HTMLFormElement){
        // This function will get context menu dimension
        // when navigation is shown => showMenu = true
        let height = node.offsetHeight
        let width = node.offsetWidth
        menu = {
            h: height,
            w: width
        }
    }

</script>

<!-- oncontextmenu={} -->
<svelte:window onclick={onPageClick} />  

{#if showMenu}
<form use:getMenuDimension style="left: {pos.x}px; top: {pos.y}px">

    <div class="input-group input-group-sm mb-1">
        <span class="input-group-text">Title</span>
        <input type="text" class="form-control" bind:value={title}>
    </div>

    <div class="input-group input-group-sm mb-1">
        <span class="input-group-text">Title</span>
        <select class="form-select form-select-sm" >
            <!-- <option selected>Open this select menu</option> -->
            {#each ['Lin', 'Log', 'Symlog', 'Data Bound'] as item, i}
                <option value={i}>{item}</option>
            {/each}
        </select>
    </div>







</form>
{/if}


<style>
    @import 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';

    form {
        width: 300px;
        padding: 5px 5px;
        border: 1px solid;
        position: absolute;
    }

    form,
    span,
    select,
    input {
        /* background: rgba(200, 200, 200, 0.3); */
        opacity: 0.7;
    }

    form:hover,
    span:hover,
    select:hover,
    input:hover {
        /* background: rgba(200, 200, 200, 0.3); */
        opacity: 1;
    }
   
</style>