<script module>
  import { GIT_ASKPASS } from "$env/static/private";
  import type { Figure } from "@pytsa/ts-graph-new";
    import type { Orientation } from "@pytsa/ts-graph-new/src/objects/draggableLines.js";

    export type AxisScale = 'lin' | 'log' | 'symlog' | 'databound'

    export interface AxisSettings {
        label: string,
        scale: AxisScale,
        linthresh: number,
        linscale: number,
        inverted: boolean,
        keepCentered: boolean
    }

    export interface SettingsMenuProps {
        fig: Figure
    }

</script>


<script lang="ts">

    let { fig }: SettingsMenuProps = $props()

    let pos = $state({ x: 0, y: 0 })
    // menu is dimension (height and width) of context menu
    let menu = { h: 0, w: 0 }
    // showMenu is state of context-menu visibility
    let showMenu = $state<boolean>(false)

    let form = $state()
    let opacity = $state<number>(0.6)

    // value bindings

    let title = $state<string>(fig.title)

    let xAxis = $state<AxisSettings>({
        label: fig.xAxis.label,
        scale: 'lin',
        linthresh: fig.xAxis.symlogLinthresh,
        linscale: fig.xAxis.symlogLinscale,
        keepCentered: fig.xAxis.keepCentered,
        inverted: fig.xAxis.inverted
    })

    let yAxis = $state<AxisSettings>({
        label: fig.yAxis.label,
        scale: 'lin',
        linthresh: fig.yAxis.symlogLinthresh,
        linscale: fig.yAxis.symlogLinscale,
        keepCentered: fig.yAxis.keepCentered,
        inverted: fig.yAxis.inverted
    })
    
    let zaxis = $state<boolean>(true)

    $effect(() => {
        fig.title = title




        fig.replot()
    })


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

    const axisScaleOptions = ['Lin', 'Log', 'Symlog', 'Data Bound']
    const axisOrientationOptions = ['Horizontal', 'Vertical']


</script>

<!-- oncontextmenu={} -->
<svelte:window onclick={onPageClick} />  

{#if showMenu}
<form class="card" use:getMenuDimension onmouseenter={() => opacity = 1} onmouseleave={() => opacity = 0.6}
     bind:this={form} style="left: {pos.x}px; top: {pos.y}px; opacity: {opacity}">

     <!-- <span class="card-header">
        Header
     </span> -->

     <div class="card-body">
         
         <div class="input-group sm mb-1">
             <span class="input-group-text">Title</span>
             <input type="text" class="form-control" bind:value={title}/>
            </div>
            
            <div class="input-group sm mb-1">
                <span class="input-group-text">Axis orientation</span>
                <select class="form-select" >
                    <!-- <option selected>Open this select menu</option> -->
                    {#each axisOrientationOptions as item, i}
                    <option value={i}>{item}</option>
                    {/each}
                </select>
            </div>
            
            <!-- <div class="fixed-width"> -->
                <span class="form-check-label"></span>
                <div class="sm axis-labels">
                    <span class="form-check-label">X Axis</span>
                    <span class="form-check-label">Y Axis</span>
                    {#if zaxis}
                        <span class="form-check-label">Z Axis</span>
                    {/if}
                </div>
            <!-- </div> -->
            
            
            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Axis label</span>
                <input type="text" class="form-control" bind:value={xAxis.label}/>
                <input type="text" class="form-control" bind:value={yAxis.label}/>
                {#if zaxis}
                    <input type="text" class="form-control" />
                {/if}
            </div>
            
            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Axis scale</span>
                <select class="form-select" >
                    <!-- <option selected>Open this select menu</option> -->
                    {#each axisScaleOptions as item, i}
                    <option value={i}>{item}</option>
                    {/each}
                </select>
                <select class="form-select" >
                    {#each axisScaleOptions as item, i}
                    <option value={i}>{item}</option>
                    {/each}
                </select>
                {#if zaxis}
                <select class="form-select" >
                    {#each axisScaleOptions as item, i}
                    <option value={i}>{item}</option>
                    {/each}
                </select>
                {/if}
            </div>
            
            
            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Linthresh</span>
                <input type="text" class="form-control" disabled={true}/>
                <input type="text" class="form-control" />
                {#if zaxis}
                <input type="text" class="form-control" />
                {/if}
            </div>
            
            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Linscale</span>
                <input type="text" class="form-control" />
                <input type="text" class="form-control" />
                {#if zaxis}
                <input type="text" class="form-control" />
                {/if}
            </div>
            
            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Inverted</span>
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="">
                </div>
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="">
                </div>
                {#if zaxis}
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="">
                </div>
                {/if}
            </div>
            
            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Autoscale</span>
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="">
                </div>
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="">
                </div>
                {#if zaxis}
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="">
                </div>
                {/if}
            </div>

            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Keep centered (around 0)</span>
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="">
                </div>
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="">
                </div>
                {#if zaxis}
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="">
                </div>
                {/if}
            </div>
            
            
            
        </div>



</form>
{/if}


<style>
    @import 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';

    .sm>.btn, .sm>.form-control, .sm>.form-select, .sm>.input-group-text, .sm>.form-check-label, .sm>.form-check-input{
        padding: 0.15rem 0.3rem !important;
        font-size: 0.7rem !important;
    }

    .input-group > div {
        width: calc((100% - 69px) / 2);
        justify-content: center;
    }

    .fixed-width > span:first-child {
        width: 70px;
    }

    .axis-labels {
        display: flex;
        flex-direction: row;
        justify-content: space-around;
    }

    form {
        width: 400px;
        /* padding: 5px 5px; */
        /* border: 1px solid; */
        position: absolute;
        /* background-color: white; */
    }

    /*

    form:hover,
    span:hover,
    select:hover,
    input:hover {
        background: rgba(200, 200, 200, 0.3); 
        opacity: 1;
    }

    */
   
</style>