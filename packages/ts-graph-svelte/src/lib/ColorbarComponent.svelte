
<script lang="ts">
    import type { Figure, Colorbar, Rect } from "@pytsa/ts-graph-new";
    import { getContext } from "svelte";
    import { FigureContext } from "./Figure.svelte.js";
    import TicksAndLabels from "./TicksAndLabels.svelte";
    import  { textHeight } from "./TicksAndLabels.svelte";

    import type { Margin } from "@pytsa/ts-graph-new/src/types.js";
    import type { SceneContext } from "./Scene.svelte";
    import type { IMouseEvent,  Cursor } from "@pytsa/ts-graph-new/src/objects/object.js";
    import { Colormaps, type ILut } from "@pytsa/ts-graph-new/src/color.js";
    import type { ContextMenuItem } from "./ContextMenu.svelte";
    import ContextMenu from "./ContextMenu.svelte";

    let { colorbar }: {colorbar: Colorbar} = $props()

    const WIDTH = 20

    let fc: FigureContext = getContext('FigureContext')
    let sceneContext: SceneContext = getContext('SceneContext')
    let colorbarRightLabel = $state<string>(colorbar.yAxis.label)
    let colormapLut = $state<ILut>(colorbar.colormap.lut)
    const gradientID = crypto.randomUUID()

    let contextMenu = $state<ReturnType<typeof ContextMenu>>()

    // colorbar plot rect
    
    let plotRect = $state<Rect>({
        x: fc.svgRect.w - 50,
        y: fc.plotRect.y,
        w: WIDTH,
        h: fc.plotRect.h
    })

    function calcPlotRect(margin: Margin): Rect {

        const containsLabel = colorbar.yAxis.label !== ""

        var colorbarWidth = margin.left + margin.right + WIDTH
        colorbarWidth += containsLabel ? textHeight : 0
        fc.colorbarWidth = colorbarWidth

        var r = {
            x: fc.svgRect.w - colorbarWidth + margin.left,
            y: fc.plotRect.y,
            w: WIDTH,
            h: fc.plotRect.h
        }

        plotRect = r
        colorbarRightLabel = colorbar.yAxis.label
        colorbar.svgPlotRect = r
        colormapLut = colorbar.colormap.lut
        // console.log(colorbar.colormap.lut)
        return r
    }

    function getIMouseEvent(e: MouseEvent): IMouseEvent {
        return {
            e: e,
            canvas2d: sceneContext.scene!.canvas2d,
            glcanvas: sceneContext.scene!.glcanvas,
            x: e.offsetX,
            y: e.offsetY,
            setCursor: (_cursor: Cursor) => {fc.cursor = _cursor},
            openContextMenu: (x: number, y: number) => {contextMenu?.open(x, y)}
        }
    }

    function onMouseDown(e: MouseEvent) {
        e.preventDefault()
        e.stopPropagation()
        // console.log("colorbar onMouseDown")
        colorbar.mouseDown(getIMouseEvent(e))
    }       

    function onMouseUp(e: MouseEvent) {
        e.preventDefault()
        // e.stopPropagation()
        colorbar.mouseUp(getIMouseEvent(e))
    }       

    function onDblClick(e: MouseEvent) {
        e.preventDefault()
        e.stopPropagation()
        colorbar.doubleClick(getIMouseEvent(e))
    }

    const contextMenuItems: ContextMenuItem[] = [
        {
            type: "action",
            label: "View all",
            onClick: () => colorbar.viewAll()
        },
    ]


    // function onMouseMove(e: MouseEvent) {
    //     e.preventDefault()
    //     e.stopPropagation()
    //     console.log("colorbar onMouseMove")

    //     // colorbar.mouseMove(getIMouseEvent(e))
    // }

    $effect(() => {
        const r = fc.plotRect;
        colorbar.replot()
    })

</script>

<defs>
    <linearGradient id={gradientID} x1="0" x2="0" y1="0" y2="1">
        {#each colormapLut as entry}
            <stop offset="{entry.pos * 100}%" stop-color="rgb({entry.r}, {entry.g}, {entry.b})" />
      {/each}
    </linearGradient>
  </defs>


  <!-- <foreignObject  
    x={plotRect.x.toFixed(2)}
    y={plotRect.y.toFixed(2)}
    width={plotRect.w}
    height={plotRect.h}>
    <ContextMenu bind:this={contextMenu} items={contextMenuItems}/>
</foreignObject> -->


 <!-- svelte-ignore a11y_no_static_element_interactions -->
 <rect class="colorbar" onmousedown={onMouseDown} onmouseup={onMouseUp} ondblclick={onDblClick}
  x={plotRect.x.toFixed(2)}
  y={plotRect.y.toFixed(2)}
  width={plotRect.w}
  height={plotRect.h}
  fill="url(#{gradientID})" /> 


<TicksAndLabels figure={colorbar} calcPlotRect={calcPlotRect} rightAxisLabel={colorbarRightLabel}  />



<style>

    .colorbar {
        stroke: black;
        stroke-width: 2px;
    }


</style>