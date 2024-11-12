<script module>
    import { Colormap, Colormaps, type Figure } from "@pytsa/ts-graph-new";

    export interface SettingsMenuProps {
        fig: Figure
    }
</script>


<script lang="ts">
    import type { ScaleText } from "@pytsa/ts-graph-new/src/figure/axis.js";
    import { Orientation } from "@pytsa/ts-graph-new/src/objects/draggableLines.js";
    import Input from "./Input.svelte";
    import CloseButton from "./CloseButton.svelte";

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
    let showZAxis = $derived<boolean>(fig.colorbar !== null)
    
    const firstSpanWidth = "70px"
    let formWidth = $derived(showZAxis ? "400px" : "300px")

    // value bindings

    let title = $state<string>(fig.title)
    let axisAlignment = $state<Orientation>(fig.axisAlignment)

    const colormapNames = Colormaps.getColormapsNames();
    let colormapSelect = $state<string>(fig.colorbar ? fig.colorbar.colormap.name : "symgrad")

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
            fig.colorbar.colormap = Colormap.fromName(colormapSelect)
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
        const mw = Number.parseFloat(formWidth.substring(0, formWidth.length - 2))
        pos = {x: x - mw, y};

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
<form class="card rounded-0" use:getMenuDimension 
        onmouseenter={() => opacity = HIGH_OPACITY} onmouseleave={() => opacity = LOW_OPACITY}
        onsubmit={(e) => e.preventDefault()}
     style="width: {formWidth}; left: {pos.x}px; top: {pos.y}px; opacity: {opacity}; --fs-width: {firstSpanWidth}; --calc-width: calc((100% - {firstSpanWidth}) / {showZAxis ? 3 : 2})">

     <div class="card-body px-2 py-2">

         <div class="header">
             <h6>Settings</h6>
              <CloseButton size="0.4em" onclick={() => showMenu = false}/>
         </div>

         <hr />
         
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
            
            <div class="sm axis-labels" style="grid-template-columns: {firstSpanWidth} repeat({showZAxis ? 3 : 2}, 1fr)">
                <span class="form-check-label">X Axis</span>
                <span class="form-check-label">Y Axis</span>
                {#if showZAxis}
                    <span class="form-check-label">Z Axis</span>
                {/if}
            </div>
            
            
            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Axis label</span>
                <input type="text" class="form-control" bind:value={xAxis.label}/>
                <input type="text" class="form-control" bind:value={yAxis.label}/>
                {#if showZAxis}
                    <input type="text" class="form-control" bind:value={zAxis.label}/>
                {/if}
            </div>

            {#snippet scaleSelect(axis: AxisSettings)}
                <select class="form-select" bind:value={axis.scale}>
                    {#each axisScaleOptions as item}
                        <option value={item}>{item}</option>
                    {/each}
                </select>
            {/snippet}
            
            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Axis scale</span>
                {@render scaleSelect(xAxis)}
                {@render scaleSelect(yAxis)}
                {#if showZAxis}
                    {@render scaleSelect(zAxis)}
                {/if}
            </div>

            {#snippet snLinthresh(axis: AxisSettings)}
                <Input class="sm" disabled={axis.scale !== "Symmetric logarithmic"} bind:value={axis.linthresh} />
                <!-- <input type="text" class="form-control" disabled={axis.scale !== "Symmetric logarithmic"} bind:value={axis.linthresh}/> -->
            {/snippet}
            
            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Linthresh</span>
                {@render snLinthresh(xAxis)}
                {@render snLinthresh(yAxis)}
                {#if showZAxis}
                    {@render snLinthresh(zAxis)}
                {/if}
            </div>

            {#snippet snLinscale(axis: AxisSettings)}
                <input type="text" class="form-control" disabled={axis.scale !== "Symmetric logarithmic"} bind:value={axis.linscale}/>
            {/snippet}
            
            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Linscale</span>
                {@render snLinscale(xAxis)}
                {@render snLinscale(yAxis)}
                {#if showZAxis}
                    {@render snLinscale(zAxis)}
                {/if}
            </div>

            {#snippet snCheckboxInverted(axis: AxisSettings)}
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="" bind:checked={axis.inverted}>
                </div>
            {/snippet}

            {#snippet snCheckboxAutoscale(axis: AxisSettings)}
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="" bind:checked={axis.autoscale}>
                </div>
            {/snippet}

            {#snippet snCheckboxKeepCentered(axis: AxisSettings)}
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="checkbox" value="" bind:checked={axis.keepCentered}>
                </div>
            {/snippet}
            
            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Inverted</span>
                {@render snCheckboxInverted(xAxis)}
                {@render snCheckboxInverted(yAxis)}
                {#if showZAxis}
                    {@render snCheckboxInverted(zAxis)}
                {/if}
            </div>

            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Autoscale</span>
                {@render snCheckboxAutoscale(xAxis)}
                {@render snCheckboxAutoscale(yAxis)}
                {#if showZAxis}
                    {@render snCheckboxAutoscale(zAxis)}
                {/if}
            </div>

            <div class="input-group sm mb-1 fixed-width">
                <span class="input-group-text">Keep centered (around 0)</span>
                {@render snCheckboxKeepCentered(xAxis)}
                {@render snCheckboxKeepCentered(yAxis)}
                {#if showZAxis}
                    {@render snCheckboxKeepCentered(zAxis)}
                {/if}
            </div>

            {#if showZAxis}
                <div class="input-group sm mb-1 fixed-width">
                    <span class="input-group-text">Colormap</span>
                    <select class="form-select" bind:value={colormapSelect}>
                        {#each colormapNames as item}
                            <option value={item}>{item}</option>
                        {/each}
                    </select>
                </div>
            {/if}
            

            
        </div>
</form>
{/if}


<style> 
    @import 'https://cdn.jsdelivr.net/npm/bosotstrap@5.3.3/dist/css/bootstrap.min.css';

    hr {
        margin: 5px 0px;
    }

    .header {
        display: flex;
        justify-content: space-between;
        flex-direction: row;
        /* justify-items: center; */
        align-items: center;
    }

    .header > h6 {
        margin-bottom: 0px;
    }

    :global(.sm>.btn, .sm>.form-control, .sm>.form-select, .sm>.input-group-text, .sm>.form-check-label, .sm>.form-check-input){
        padding: 0.15rem 0.3rem !important;
        font-size: 0.7rem !important;
    }

    .input-group > div {
        width: var(--calc-width);
        justify-content: center;
    }

    .fixed-width > span:first-child {
        width: var(--fs-width);
    }

    .axis-labels {
        display: grid;
        justify-items: center;
        grid-template-rows: auto;
    }

    .axis-labels > span:first-child {
        grid-column-start: 2;
    }
    .axis-labels > span:nth-child(2) {
        grid-column-start: 3;
    }

    .axis-labels > span:nth-child(3) {
        grid-column-start: 4;
    }

    form {
        /* padding: 5px 5px; */
        /* border: 1px solid; */
        position: absolute;
        /* background-color: white; */
    }

   
</style>