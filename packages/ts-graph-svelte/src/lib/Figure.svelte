<script module>
    export interface FigureProps {
        row: number | string,
        col: number | string,
        colspan?: number | string,
        rowspan?: number | string,
        figure?: Figure
    }
</script>


<script lang="ts">
    import { getContext } from "svelte";
    import type { SceneContext } from "./Scene.svelte"
    import type { Rect } from "@pytsa/ts-graph-new/src/types.js";
    import { Figure } from "@pytsa/ts-graph-new";
    import type { Cursor, IMouseEvent } from "@pytsa/ts-graph-new/src/objects/object.js";
    import ContextMenu from "./ContextMenu.svelte";
    import type { ContextMenuItem } from "./ContextMenu.svelte";
    import SettingsMenu from "./SettingsMenu.svelte";

    // import Scene from "./Scene.svelte";

    let {row, col, colspan = 1, rowspan = 1, figure}: FigureProps = $props()
    let sceneContext: SceneContext = getContext('SceneContext')

    let svgEl = $state<SVGSVGElement>()
    let svgRect = $state<Rect>({x: 0, y: 0, h: 1, w: 1})
    let cursor =  $state<Cursor>("crosshair")
    const newFig = new Figure()
    let fig = $derived<Figure>(figure ?? newFig)

    let canvasRect = $derived.by<Rect>(() => {
        if (!svgEl) return {x: 0, y: 0, h: 1, w: 1}

        const dpr = window.devicePixelRatio
        
        const cr =  {
            x: (svgRect.x - sceneContext.canvasBoundingRect.x) * dpr,
            y: (svgRect.y - sceneContext.canvasBoundingRect.y) * dpr,
            w: svgRect.w * dpr,
            h: svgRect.h * dpr
        }
        fig.canvasRect = cr // set canvas rect for inherent figure
        return cr
    }
    )

    // $inspect(sceneContext.canvasRect).with((type, value) => {
    //     console.log(value)
    //     if (svgEl) {
    //         let rect = svgEl.getBoundingClientRect()
    //         svgRect.x = rect.x
    //         svgRect.y = rect.y
    //         svgRect.width = rect.width
    //         svgRect.height = rect.height
    //     }
    // })

    // on resize and inner dimensions change
    $effect(() => {
        // console.log(sceneContext.canvasRect, plotRect)
        if (!svgEl) return

        const cr = sceneContext.canvasBoundingRect  // needs to be here for effect to work
        const tc = sceneContext.templateCols
        const tr = sceneContext.templateRows

        let rect = svgEl.getBoundingClientRect()
        svgRect.x = rect.x
        svgRect.y = rect.y
        svgRect.w = rect.width
        svgRect.h = rect.height

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
        sceneContext.scene.addItem(fig)
    })

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
            x: e.offsetX * dpr + canvasRect.x,
            y: e.offsetY * dpr + canvasRect.y,
            setCursor: (_cursor: Cursor) => {cursor = _cursor},
            openContextMenu: (x: number, y: number) => {contextMenu?.open(x, y)}
        }
    }

    function onMouseDown(e: MouseEvent) {
        e.preventDefault()
        fig.mouseDown(getIMouseEvent(e))
    }       

    function onMouseUp(e: MouseEvent) {
        e.preventDefault()
        fig.mouseUp(getIMouseEvent(e))
    }       

    function onMouseMove(e: MouseEvent) {
        e.preventDefault()
        fig.mouseMove(getIMouseEvent(e))
    }

    function onDblClick(e: MouseEvent) {
        e.preventDefault()
        fig.doubleClick(getIMouseEvent(e))
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
            onClick: () => fig.viewAll()
        },
        {
            type: "action",
            label: "Copy this to clipboard",
            onClick: () => fig.copyPlotToClipboard()
        },
        // {
        //     type: "divider",
        // },
    ]

    let contextMenu = $state<ReturnType<typeof ContextMenu>>()
    let settingsMenu = $state<ReturnType<typeof SettingsMenu>>()

    function openSettings(e: MouseEvent) {
        e.stopPropagation()
        settingsMenu?.openClose(svgRect.x + svgRect.w, 24)
    }


</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg  bind:this={svgEl} style="--col: {col}; --row: {row}; --colspan: {colspan}; --rowspan: {rowspan}; --cursor: {cursor}" version="1.2"
 xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"  
 aria-labelledby="title" role="img"
 onmousedown={onMouseDown} 
 onmousemove={onMouseMove} 
 onmouseup={onMouseUp} 
 onmouseenter={onMouseEnter} 
 onmouseleave={onMouseLeave}  
 ondblclick={onDblClick}
 oncontextmenu={onContextMenu}>
    <text alignment-baseline="middle" text-anchor="middle" x={svgRect.w / 2} y={svgRect.h / 2}>
        x: {canvasRect.x.toFixed(1)} y: {canvasRect.y.toFixed(1)}, w: {canvasRect.w.toFixed(1)}, h: {canvasRect.h.toFixed(1)}
    </text>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->

    <!-- from https://icon-sets.iconify.design/?query=setting -->
    <g class="g" onclick={openSettings} transform="translate({svgRect.w - 24} 0)">
        <rect x="0" y="0" width="1.5em" height="1.5em" fill="transparent"/>
        <path  d="M19.9 12.66a1 1 0 0 1 0-1.32l1.28-1.44a1 1 0 0 0 .12-1.17l-2-3.46a1 1 0 0 0-1.07-.48l-1.88.38a1 1 0 0 1-1.15-.66l-.61-1.83a1 1 0 0 0-.95-.68h-4a1 1 0 0 0-1 .68l-.56 1.83a1 1 0 0 1-1.15.66L5 4.79a1 1 0 0 0-1 .48L2 8.73a1 1 0 0 0 .1 1.17l1.27 1.44a1 1 0 0 1 0 1.32L2.1 14.1a1 1 0 0 0-.1 1.17l2 3.46a1 1 0 0 0 1.07.48l1.88-.38a1 1 0 0 1 1.15.66l.61 1.83a1 1 0 0 0 1 .68h4a1 1 0 0 0 .95-.68l.61-1.83a1 1 0 0 1 1.15-.66l1.88.38a1 1 0 0 0 1.07-.48l2-3.46a1 1 0 0 0-.12-1.17ZM18.41 14l.8.9l-1.28 2.22l-1.18-.24a3 3 0 0 0-3.45 2L12.92 20h-2.56L10 18.86a3 3 0 0 0-3.45-2l-1.18.24l-1.3-2.21l.8-.9a3 3 0 0 0 0-4l-.8-.9l1.28-2.2l1.18.24a3 3 0 0 0 3.45-2L10.36 4h2.56l.38 1.14a3 3 0 0 0 3.45 2l1.18-.24l1.28 2.22l-.8.9a3 3 0 0 0 0 3.98m-6.77-6a4 4 0 1 0 4 4a4 4 0 0 0-4-4m0 6a2 2 0 1 1 2-2a2 2 0 0 1-2 2"/>
    </g>

</svg>

<ContextMenu bind:this={contextMenu} items={items}/>
<SettingsMenu bind:this={settingsMenu} />


<style>
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

    .g:hover > path {
        fill: #000;
        transition: 0.3s;
    }
    
    .g {
        cursor: pointer;
        /* transform: translate(50px, 50px); */
    }
    /* .g:: {
        fill: #fe0404;
    } */

    path {
        fill: #aaa;
    }


</style>