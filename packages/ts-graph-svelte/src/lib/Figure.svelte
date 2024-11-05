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
        e.preventDefault()
        console.log("svg onContextMenu")
        // contextMenu?.open(e.offsetX, e.offsetY)
    }

    const items: ContextMenuItem[] = [
        {
            type: "action",
            label: "Copy plot to clipboard",
            onClick: () => {return}
        },
        {
            type: "divider",
        },
        {
            type: "action",
            label: "Copy figure",
            onClick: () => {return}
        },
        {
            type: "action",
            label: "Copy copy copy copy",
            onClick: () => {return}
        }
    ]

    let contextMenu = $state<ReturnType<typeof ContextMenu>>()

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

</svg>

<ContextMenu bind:this={contextMenu} items={items}/>


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

</style>