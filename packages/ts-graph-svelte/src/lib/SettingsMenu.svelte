<script module>
    import type { Figure } from "@pytsa/ts-graph-new";

    export interface SettingsMenuProps {
        fig: Figure
    }
</script>


<script lang="ts">
    import type { ScaleText } from "@pytsa/ts-graph-new/src/figure/axis.js";
    import { Orientation } from "@pytsa/ts-graph-new/src/objects/draggableLines.js";

    interface AxisSettings {
        label: string,
        scale: ScaleText,
        linthresh: number,
        linscale: number,
        inverted: boolean,
        keepCentered: boolean,
        autoscale: boolean
    }

    const LOW_OPACITY = 0.6
    const HIGH_OPACITY = 1


    let { fig }: SettingsMenuProps = $props()

    let pos = $state({ x: 0, y: 0 })
    // menu is dimension (height and width) of context menu
    let menu = { h: 0, w: 0 }
    // showMenu is state of context-menu visibility
    let showMenu = $state<boolean>(false)

    // let form = $state()
    let opacity = $state<number>(HIGH_OPACITY)
    // let showZAxis = $derived<boolean>(fig.colorbar !== null)
    let showZAxis = $derived<boolean>(true)


    // value bindings

    let title = $state<string>(fig.title)
    let axisAlignment = $state<Orientation>(fig.axisAlignment)

    let xAxis = $state<AxisSettings>({
        label: fig.xAxis.label,
        scale: fig.xAxis.getScaleText(),
        linthresh: fig.xAxis.symlogLinthresh,
        linscale: fig.xAxis.symlogLinscale,
        keepCentered: fig.xAxis.keepCentered,
        inverted: fig.xAxis.inverted,
        autoscale: fig.xAxis.autoscale
    })

    let yAxis = $state<AxisSettings>({
        label: fig.yAxis.label,
        scale: fig.yAxis.getScaleText(),
        linthresh: fig.yAxis.symlogLinthresh,
        linscale: fig.yAxis.symlogLinscale,
        keepCentered: fig.yAxis.keepCentered,
        inverted: fig.yAxis.inverted,
        autoscale: fig.yAxis.autoscale
    })

    let zAxis = $state<AxisSettings>({
        label: fig.colorbar ? fig.colorbar.yAxis.label : "",
        scale: fig.colorbar ? fig.colorbar.yAxis.getScaleText() : "Linear",
        linthresh: fig.colorbar ? fig.colorbar.yAxis.symlogLinthresh : 1,
        linscale: fig.colorbar ? fig.colorbar.yAxis.symlogLinscale : 1,
        keepCentered: fig.colorbar ? fig.colorbar.yAxis.keepCentered : true,
        inverted: fig.colorbar ? fig.colorbar.yAxis.inverted : false,
        autoscale: fig.colorbar ? fig.colorbar.yAxis.autoscale : true
    })
    
    $effect(() => {
        fig.xAxis.setScaleFromText(xAxis.scale)
        fig.yAxis.setScaleFromText(yAxis.scale)
        if (fig.colorbar) {
            fig.colorbar.yAxis.setScaleFromText(zAxis.scale)
        }
        fig.replot()

    })

    $effect(() => {
        fig.title = title

        fig.xAxis.label = xAxis.label
        fig.xAxis.symlogLinscale = xAxis.linscale
        fig.xAxis.symlogLinthresh = xAxis.linthresh
        fig.xAxis.inverted = xAxis.inverted
        fig.xAxis.keepCentered = xAxis.keepCentered

        fig.yAxis.label = yAxis.label
        fig.yAxis.symlogLinscale = yAxis.linscale
        fig.yAxis.symlogLinthresh = yAxis.linthresh
        fig.yAxis.inverted = yAxis.inverted
        fig.yAxis.keepCentered = yAxis.keepCentered
        fig.axisAlignment = axisAlignment

        if (fig.colorbar) {
            fig.colorbar.yAxis.label = zAxis.label
            fig.colorbar.yAxis.symlogLinscale = zAxis.linscale
            fig.colorbar.yAxis.symlogLinthresh = zAxis.linthresh
            fig.colorbar.yAxis.inverted = zAxis.inverted
            fig.colorbar.yAxis.keepCentered = zAxis.keepCentered
        }

        fig.replot()
    })

    export function openClose(x: number, y: number) {
        // close the dialog if it is opened
        if (showMenu) {
            showMenu = false
            opacity = HIGH_OPACITY
            return
        }

        console.log("open settings menu")
        pos = {x: x - menu.w, y};

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

    const axisScaleOptions: ScaleText[] = ['Linear', 'Logarithmic', 'Symmetric logarithmic', 'Data bound']

    const axisOrientationMap = new Map<string, Orientation>([
        ["Horizontal", Orientation.Horizontal],
        ["Vertical", Orientation.Vertical],
    ])

</script>

<!-- oncontextmenu={} -->
<svelte:window onclick={onPageClick} />  

{#if showMenu}
<form class="card rounded-0" use:getMenuDimension onmouseenter={() => opacity = HIGH_OPACITY} onmouseleave={() => opacity = LOW_OPACITY}
     style="left: {pos.x}px; top: {pos.y}px; opacity: {opacity}; --calc-width: calc((100% - 68px) / {showZAxis ? 3 : 2})">

     <!-- <span class="card-header">
        Header
     </span> -->

     <div class="card-body px-2 py-2">
         
         <div class="input-group sm mb-1">
             <span class="input-group-text">Title</span>
             <input type="text" class="form-control" bind:value={title}/>
            </div>
            
            <div class="input-group sm mb-1">
                <span class="input-group-text">Axis alignment</span>
                <select class="form-select" bind:value={axisAlignment}>
                    {#each axisOrientationMap.entries() as [key, value]}
                        <option value={value}>{key}</option>
                    {/each}
                </select>
            </div>
            
            <!-- <div class="fixed-width"> -->
                <span class="form-check-label"></span>
                <div class="sm axis-labels">
                    <span class="form-check-label">X Axis</span>
                    <span class="form-check-label">Y Axis</span>
                    {#if showZAxis}
                        <span class="form-check-label">Z Axis</span>
                    {/if}
                </div>
            <!-- </div> -->
            
            
            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Axis label</span>
                <input type="text" class="form-control" bind:value={xAxis.label}/>
                <input type="text" class="form-control" bind:value={yAxis.label}/>
                {#if showZAxis}
                    <input type="text" class="form-control" bind:value={zAxis.label}/>
                {/if}
            </div>

            {#snippet axisScaleoOptions()}
                {#each axisScaleOptions as item}
                    <option value={item}>{item}</option>
                {/each}
            {/snippet}
            
            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Axis scale</span>
                <select class="form-select" bind:value={xAxis.scale}>
                    {@render axisScaleoOptions()}
                </select>
                <select class="form-select" bind:value={yAxis.scale}>
                    {@render axisScaleoOptions()}
                </select>
                {#if showZAxis}
                <select class="form-select" bind:value={zAxis.scale}>
                    {@render axisScaleoOptions()}
                </select>
                {/if}
            </div>
            
            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Linthresh</span>
                <input type="text" class="form-control" disabled={xAxis.scale !== "Symmetric logarithmic"} bind:value={xAxis.linthresh}/>
                <input type="text" class="form-control" disabled={yAxis.scale !== "Symmetric logarithmic"} bind:value={yAxis.linthresh}/>
                {#if showZAxis}
                <input type="text" class="form-control" disabled={zAxis.scale !== "Symmetric logarithmic"} bind:value={zAxis.linthresh}/>
                {/if}
            </div>
            
            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Linscale</span>
                <input type="text" class="form-control" disabled={xAxis.scale !== "Symmetric logarithmic"} bind:value={xAxis.linscale}/>
                <input type="text" class="form-control" disabled={yAxis.scale !== "Symmetric logarithmic"} bind:value={yAxis.linscale}/>
                {#if showZAxis}
                <input type="text" class="form-control" disabled={zAxis.scale !== "Symmetric logarithmic"} bind:value={zAxis.linscale}/>
                {/if}
            </div>
            
            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Inverted</span>
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="" bind:checked={xAxis.inverted}>
                </div>
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="" bind:checked={yAxis.inverted}>
                </div>
                {#if showZAxis}
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="" bind:checked={zAxis.inverted}>
                </div>
                {/if}
            </div>
            
            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Autoscale</span>
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="" bind:checked={xAxis.autoscale}>
                </div>
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value=""  bind:checked={yAxis.autoscale}>
                </div>
                {#if showZAxis}
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="" bind:checked={zAxis.autoscale}>
                </div>
                {/if}
            </div>

            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Keep centered (around 0)</span>
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="" bind:checked={xAxis.keepCentered}>
                </div>
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="" bind:checked={yAxis.keepCentered}>
                </div>
                {#if showZAxis}
                <div class="input-group-text">
                    <input class="form-check-input mt-0 mb-0" type="checkbox" value="" bind:checked={zAxis.keepCentered}>
                </div>
                {/if}
            </div>
            
            
            
        </div>



</form>
{/if}


<style>
    @import 'https://cdn.jsdelivr.net/npm/bosotstrap@5.3.3/dist/css/bootstrap.min.css';

    .sm>.btn, .sm>.form-control, .sm>.form-select, .sm>.input-group-text, .sm>.form-check-label, .sm>.form-check-input{
        padding: 0.15rem 0.3rem !important;
        font-size: 0.7rem !important;
    }

    .input-group > div {
        width: var(--calc-width);
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

   
</style>