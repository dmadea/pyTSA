<script module>
    export interface FigureProps {
        row: number | string,
        col: number | string,
        colspan?: number | string,
        rowspan?: number | string,
        figure?: Figure
    }

    // export interface FigureContext {
    //     figure: Figure,
    //     svgRect: Rect,
    //     plotRect: Rect,
    //     colorbarWidth: number,
    //     setPlotRect: (r: Rect) => void 
    // }
</script>


<script lang="ts">
    import { getContext, setContext } from "svelte";
    import type { SceneContext } from "./Scene.svelte"
    import type { Rect } from "@pytsa/ts-graph-new";
    import { Colorbar, Figure } from "@pytsa/ts-graph-new";
    import type { Cursor, IMouseEvent } from "@pytsa/ts-graph-new/src/objects/object.js";
    import ContextMenu from "./ContextMenu.svelte";
    import type { ContextMenuItem } from "./ContextMenu.svelte";
    import SettingsMenu from "./SettingsMenu.svelte";
    import DraggableLines from "./DraggableLines.svelte";
    import TicksAndLabels from "./TicksAndLabels.svelte";
    import { FigureContext } from "./Figure.svelte.js";
    import ColorbarComponent from "./ColorbarComponent.svelte";

    // import Scene from "./Scene.svelte";

    let {row, col, colspan = 1, rowspan = 1, figure = new Figure()}: FigureProps = $props()
    let sceneContext: SceneContext = getContext('SceneContext')

    const fc = new FigureContext(figure)
    setContext('FigureContext', fc)

    let canvasRect = $derived.by<Rect>(() => {
        if (!fc.svgEl) return {x: 0, y: 0, h: 1, w: 1}

        const dpr = window.devicePixelRatio
        
        const cr =  {
            x: (fc.svgRect.x - sceneContext.canvasBoundingRect.x) * dpr,
            y: (fc.svgRect.y - sceneContext.canvasBoundingRect.y) * dpr,
            w: fc.svgRect.w * dpr,
            h: fc.svgRect.h * dpr
        }
        figure.canvasRect = cr // set canvas rect for inherent figure
        return cr
    }
    )

    // on resize and inner dimensions change
    $effect(() => {
        // console.log(sceneContext.canvasRect, plotRect)
        if (!fc.svgEl) return

        const cr = sceneContext.canvasBoundingRect  // needs to be here for effect to work
        const tc = sceneContext.templateCols
        const tr = sceneContext.templateRows

        let rect = fc.svgEl.getBoundingClientRect()
        fc.svgRect.x = rect.x
        fc.svgRect.y = rect.y
        fc.svgRect.w = rect.width
        fc.svgRect.h = rect.height

        // console.log(rect.x, rect.left, rect.y, rect.top)

        // console.log(cr, plotRect)
    })

    // $inspect(canvasRect).with((type, value) => {
    //     fig.canvasRect = canvasRect
    // })

    // $inspect(figure).with((type, value) => {
    //     console.log(value)
    // })

    // $inspect(sceneContext.scene).with((type, value) => {
    //     console.log(value)
    // })

    // on scene initialization
    $effect(() => {
        if (!sceneContext.scene)
            return
        sceneContext.scene.addItem(figure)
    })

    $inspect(fc.plotRect)

    function onMouseEnter(e: MouseEvent) {
        // console.log("onMouseEnter")
    }

    function onMouseLeave(e: MouseEvent) {
        // console.log("onMouseLeave")

    }  
    
    function getIMouseEvent(e: MouseEvent): IMouseEvent {
        const dpr = window.devicePixelRatio;
        return {
            e: e,
            canvas2d: sceneContext.scene!.canvas2d,
            glcanvas: sceneContext.scene!.glcanvas,
            x: e.offsetX,  // * dpr + canvasRect.x
            y: e.offsetY,  // * dpr + canvasRect.y
            setCursor: (_cursor: Cursor) => {fc.cursor = _cursor},
            openContextMenu: (x: number, y: number) => {contextMenu?.open(x, y)}
        }
    }

    function onMouseDown(e: MouseEvent) {
        e.preventDefault()
        figure.mouseDown(getIMouseEvent(e))
    }       

    function onMouseUp(e: MouseEvent) {
        e.preventDefault()
        figure.mouseUp(getIMouseEvent(e))
    }       

    function onMouseMove(e: MouseEvent) {
        e.preventDefault()
        figure.mouseMove(getIMouseEvent(e))
    }

    function onDblClick(e: MouseEvent) {
        e.preventDefault()
        figure.doubleClick(getIMouseEvent(e))
    }

    function onContextMenu(e: MouseEvent) {
        if (e.ctrlKey) 
            return
        
        e.preventDefault()
    }

    const items: ContextMenuItem[] = [
        {
            type: "action",
            label: "View all",
            onClick: () => figure.viewAll()
        },
        {
            type: "action",
            label: "Copy this to clipboard",
            onClick: () => figure.copyPlotToClipboard()
        },
        // {
        //     type: "divider",
        // },
    ]

    let contextMenu = $state<ReturnType<typeof ContextMenu>>()
    let settingsMenu = $state<ReturnType<typeof SettingsMenu>>()
    let settingButton = $state<SVGSVGElement>()

    function openSettings(e: MouseEvent) {
        e.stopPropagation()
        let r = settingButton!.getBoundingClientRect()
        // settingsMenu?.openClose(r.x + 24, r.y + 24)

        settingsMenu?.openClose(r.x - sceneContext.canvasBoundingRect.x + 24, r.y - sceneContext.canvasBoundingRect.y + 24)
    }

    const colorbar = figure.addColorbar()

</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg  bind:this={fc.svgEl} style="--col: {col}; --row: {row}; --colspan: {colspan}; --rowspan: {rowspan}; --cursor: {fc.cursor}" version="1.2"
 xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"  
 aria-labelledby="title" role="img"
 onmousedown={onMouseDown} 
 onmousemove={onMouseMove} 
 onmouseup={onMouseUp} 
 onmouseenter={onMouseEnter} 
 onmouseleave={onMouseLeave}  
 ondblclick={onDblClick}
 oncontextmenu={onContextMenu}>

    <rect class="plot-rect" x={fc.plotRect.x} y={fc.plotRect.y} width={fc.plotRect.w} height={fc.plotRect.h}/>

     <text alignment-baseline="middle" text-anchor="middle" x={fc.svgRect.w / 2} y={fc.svgRect.h / 2}>
        x: {canvasRect.x.toFixed(1)} y: {canvasRect.y.toFixed(1)}, w: {canvasRect.w.toFixed(1)}, h: {canvasRect.h.toFixed(1)}
    </text> 
    
    <!-- Settings button -->
    
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- from https://icon-sets.iconify.design/?query=setting -->
     <!-- bind:this={settingButton} -->
    <g bind:this={settingButton} class="sett-button" onclick={openSettings} transform="translate({fc.plotRect.x + fc.plotRect.w - 30} {fc.plotRect.y + 6})">
        <rect x="0" y="0" width="1.5em" height="1.5em" fill="transparent"/>
        <path  d="M19.9 12.66a1 1 0 0 1 0-1.32l1.28-1.44a1 1 0 0 0 .12-1.17l-2-3.46a1 1 0 0 0-1.7-.48l-1.88.38a1 1 0 0 1-1.15-.66l-.61-1.83a1 1 0 0 0-.95-.68h-4a1 1 0 0 0-1 .68l-.56 1.83a1 1 0 0 1-1.15.66L5 4.79a1 1 0 0 0-1 .48L2 8.73a1 1 0 0 0 .1 1.17l1.27 1.44a1 1 0 0 1 0 1.32L2.1 14.1a1 1 0 0 0-.1 1.17l2 3.46a1 1 0 0 0 1.07.48l1.88-.38a1 1 0 0 1 1.15.66l.61 1.83a1 1 0 0 0 1 .68h4a1 1 0 0 0 .95-.68l.61-1.83a1 1 0 0 1 1.15-.66l1.88.38a1 1 0 0 0 1.07-.48l2-3.46a1 1 0 0 0-.12-1.17ZM18.41 14l.8.9l-1.28 2.22l-1.18-.24a3 3 0 0 0-3.45 2L12.92 20h-2.56L10 18.86a3 3 0 0 0-3.45-2l-1.18.24l-1.3-2.21l.8-.9a3 3 0 0 0 0-4l-.8-.9l1.28-2.2l1.18.24a3 3 0 0 0 3.45-2L10.36 4h2.56l.38 1.14a3 3 0 0 0 3.45 2l1.18-.24l1.28 2.22l-.8.9a3 3 0 0 0 0 3.98m-6.77-6a4 4 0 1 0 4 4a4 4 0 0 0-4-4m0 6a2 2 0 1 1 2-2a2 2 0 0 1-2 2"/>
    </g>

    <!-- <DraggableLines/> -->
    <TicksAndLabels figure={figure} />
    <ColorbarComponent colorbar={colorbar} />

</svg>

<ContextMenu bind:this={contextMenu} items={items}/>
<SettingsMenu fig={figure} bind:this={settingsMenu}/>


<style>

    .plot-rect {
        stroke-width: 2px;
        stroke: black;
        fill: transparent;
    }


    svg {
        /* background-color: rgb(216, 205, 171); */
        width: 100%;
        height: 100%;

        /* border: 1px solid; */
        grid-column-start: var(--col);
        grid-row-start: var(--row);
        grid-column-end: span var(--colspan);
        grid-row-end: span var(--rowspan);

        user-select: none;
        cursor: var(--cursor, crosshair);
    }

    .sett-button:hover > path {
        fill: #000;
        transition: 0.3s;
    }
    
    .sett-button {
        cursor: pointer;
        fill: #afafaf;
        /* transform: translate(50px, 50px); */
    }



</style>