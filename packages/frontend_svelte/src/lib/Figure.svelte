<script module>
    export interface FigureProps {
        row: number | string,
        col: number | string,
        colspan?: number | string,
        rowspan?: number | string,
    }

    export interface Point {
        x: number,
        y: number
    }

    export interface IPaintEvent {
        canvas2d: HTMLCanvasElement,
        // ctx: CanvasRenderingContext2D,
        glcanvas: HTMLCanvasElement,
        // glctx: WebGLRenderingContext
    }

    export type Orientation = 'Horizontal' | 'Vertical' | 'Both' | 'None'
    export type Cursor = "default" | "move" | "grab" | "grabbing" | "crosshair" | "pointer" | "w-resize" | "n-resize" | "ew-resize" | "ns-resize"

    // export interface IMouseEvent {
    //     e: MouseEvent,
    //     // canvas2d: HTMLCanvasElement,
    //     glcanvas: HTMLCanvasElement,
    //     x: number,  // canvas x coordinate scaled by display ratio
    //     y: number,  // canvas y coordinate scaled by display ratio
    //     setCursor: (cursor: Cursor) => void,
    //     openContextMenu: (x: number, y: number) => void, // opens a context menu for Figure
    // }


    // export interface ITouchEvent {
    //     e: TouchEvent,
    //     bottomCanvas: HTMLCanvasElement,
    //     topCanvas: HTMLCanvasElement,
    //     x: number,  // canvas x coordinate scaled by display ratio
    //     y: number  // canvas y coordinate scaled by display ratio
    // }

    export interface FigureContext {
        svgClientRect: Rect,
        svgPlotRect: Rect,
        internalRange: Rect,
        showTicks: string[],
        showTickNumbers: string[],
        axisAlignment: Orientation,
        title: string,
        xAxis: any,
        yAxis: any,
        colorbarWidth: number,
        mapRange2Canvas: (p: Point, pr?: Rect) => Point,
        mapCanvas2Range: (p: Point, pr?: Rect) => Point
    }
</script>


<script lang="ts">
    import { getContext, setContext } from "svelte";
    import type { SceneContext, Rect } from "./Scene.svelte"
    // import { Colorbar, Figure } from "../../../tsgraph/src";
    import SettingsMenu from "./SettingsMenu.svelte";
    // import DraggableLines from "./DraggableLines.svelte";
    // import TicksAndLabels from "./TicksAndLabels.svelte";
    // import { FigureContext } from "./Figure.svelte.js";
    // import ColorbarComponent from "./ColorbarComponent.svelte";
    import { Axis } from "./axis.svelte";
    import PlotArea from "./PlotArea.svelte";
    import ContextMenu from "./ContextMenu.svelte";
    import type { ContextMenuItem } from "./ContextMenu.svelte";

    // import Scene from "./Scene.svelte";

    let {row, col, colspan = 1, rowspan = 1}: FigureProps = $props()
    let sceneContext: SceneContext = getContext('SceneContext')

    let svgEl = $state<SVGSVGElement>()
    let svgClientWidth = $state<number>(0)
    let svgClientHeight = $state<number>(0)

    let pa = $state<ReturnType<typeof PlotArea>>()
    let contextMenu = $state<ReturnType<typeof ContextMenu>>()


    let settingsMenu = $state<ReturnType<typeof SettingsMenu>>()
    let settingButton = $state<SVGElement>()


    let svgClientRect = $state<Rect>({x: 0, y: 0, h: 200, w: 200})  // svg rect in client coordinates
    let colorbarWidth = $state<number>(0)
    let canvasRect = $state<Rect>({x: 0, y: 0, h: 1, w: 1})  // in glcanvas coordinates multiplied by dpr

    let title = $state<string>("")
    let axisAlignment = $state<Orientation>("Horizontal")   // 

    // Create the FigureContext
    // const figureContext = $derived.by<FigureContext>(() => ({
    //     svgClientRect,
    //     svgPlotRect,
    //     internalRange,
    //     showTicks,
    //     showTickNumbers,
    //     axisAlignment,
    //     title,
    //     xAxis,
    //     yAxis,
    //     colorbarWidth,
    //     mapRange2Canvas,
    //     mapCanvas2Range
    // }))

    // setContext('FigureContext', figureContext)

    // Function to update canvasRect based on current SVG and scene dimensions
    function updateCanvasRect() {
        if (!svgEl) return;
        
        const dpr = window.devicePixelRatio;
        
        canvasRect = {
            x: (svgClientRect.x - sceneContext.canvasBoundingRect.x) * dpr,
            y: (svgClientRect.y - sceneContext.canvasBoundingRect.y) * dpr,
            w: svgClientRect.w * dpr,
            h: svgClientRect.h * dpr
        };
    }

    // Update svgClientRect when dimensions change
    $effect(() => {
        if (!svgEl) return;
        
        const rect = svgEl.getBoundingClientRect();
        svgClientRect.x = rect.x;
        svgClientRect.y = rect.y;
        svgClientRect.w = svgClientWidth;
        svgClientRect.h = svgClientHeight;
        
        updateCanvasRect();
        
        // Force a repaint of the TicksAndLabels component
        // const event = new CustomEvent('figure-resize');
        // window.dispatchEvent(event);
    });

    // Listen for scene-resize events to update canvasRect
    // $effect(() => {
    //     const handleSceneResize = () => {
    //         if (!svgEl) return;
    //         updateCanvasRect();
    //     };
        
    //     window.addEventListener('scene-resize', handleSceneResize);
        
    //     return () => {
    //         window.removeEventListener('scene-resize', handleSceneResize);
    //     };
    // });



    const plotAreaItems: ContextMenuItem[] = [
        {
            type: "action",
            label: "View all",
            onClick: () => {return null;} //figure.viewAll()
        },
        {
            type: "action",
            label: "Copy this to clipboard",
            onClick: () => {return null;} //figure.copyPlotToClipboard()
        },
        // {
        //     type: "divider",
        // },
    ]


    // function openSettings(e: MouseEvent) {
    //     e.stopPropagation()
    //     let r = settingButton!.getBoundingClientRect()
    //     // settingsMenu?.openClose(r.x + 24, r.y + 24)

    //     // settingsMenu?.openClose(r.x - sceneContext.canvasBoundingRect.x + 24, r.y - sceneContext.canvasBoundingRect.y + 24)
    // }

    function openSettings(e: MouseEvent) {
        e.stopPropagation()
        let r = settingButton!.getBoundingClientRect()

        settingsMenu?.openClose(r.x - sceneContext.canvasBoundingRect.x + 24, r.y - sceneContext.canvasBoundingRect.y + 24)
    }

    function openPlotAreaContextMenu(x: number, y: number) {    
        // The coordinates are already in viewport space (clientX, clientY)
        contextMenu?.open(x, y);
    }

</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg bind:this={svgEl} bind:clientWidth={svgClientWidth} bind:clientHeight={svgClientHeight} style="--col: {col}; --row: {row}; --colspan: {colspan}; --rowspan: {rowspan};" version="1.2"
 xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"  
 aria-labelledby="title" role="img">

    <rect class="svg-rect" x={0} y={0} width={svgClientRect.w} height={svgClientRect.h}/>

    <PlotArea bind:this={pa} title={title} axisAlignment={axisAlignment} svgClientRect={svgClientRect} onContextMenu={openPlotAreaContextMenu}/>

    <!-- <text alignment-baseline="middle" text-anchor="middle" x={svgClientRect.w / 2} y={svgClientRect.h / 2}>
        x: {canvasRect.x.toFixed(1)} y: {canvasRect.y.toFixed(1)}, w: {canvasRect.w.toFixed(1)}, h: {canvasRect.h.toFixed(1)}
    </text> -->

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g class="sett-button" onclick={openSettings} transform="translate({svgClientRect.w - 25} {5})">
        <rect bind:this={settingButton} type="button" x="0" y="0" width="1.5em" height="1.5em" fill="transparent"/>
        <path d="M19.9 12.66a1 1 0 0 1 0-1.32l1.28-1.44a1 1 0 0 0 .12-1.17l-2-3.46a1 1 0 0 0-1.7-.48l-1.88.38a1 1 0 0 1-1.15-.66l-.61-1.83a1 1 0 0 0-.95-.68h-4a1 1 0 0 0-1 .68l-.56 1.83a1 1 0 0 1-1.15.66L5 4.79a1 1 0 0 0-1 .48L2 8.73a1 1 0 0 0 .1 1.17l1.27 1.44a1 1 0 0 1 0 1.32L2.1 14.1a1 1 0 0 0-.1 1.17l2 3.46a1 1 0 0 0 1.07.48l1.88-.38a1 1 0 0 1 1.15.66l.61 1.83a1 1 0 0 0 1 .68h4a1 1 0 0 0 .95-.68l.61-1.83a1 1 0 0 1 1.15-.66l1.88.38a1 1 0 0 0 1.07-.48l2-3.46a1 1 0 0 0-.12-1.17ZM18.41 14l.8.9l-1.28 2.22l-1.18-.24a3 3 0 0 0-3.45 2L12.92 20h-2.56L10 18.86a3 3 0 0 0-3.45-2l-1.18.24l-1.3-2.21l.8-.9a3 3 0 0 0 0-4l-.8-.9l1.28-2.2l1.18.24a3 3 0 0 0 3.45-2L10.36 4h2.56l.38 1.14a3 3 0 0 0 3.45 2l1.18-.24l1.28 2.22l-.8.9a3 3 0 0 0 0 3.98m-6.77-6a4 4 0 1 0 4 4a4 4 0 0 0-4-4m0 6a2 2 0 1 1 2-2a2 2 0 0 1-2 2"/>
    </g>

    <!-- onkeydown={(e) => e.key === 'Enter' && openSettings(e as unknown as MouseEvent)} transform="translate({svgClientRect.w - 25} {5})" role="button" tabindex="0" -->


</svg>

<ContextMenu bind:this={contextMenu} items={plotAreaItems}/>
<SettingsMenu bind:this={settingsMenu} bind:title bind:axisAlignment xAxis={pa?.getxAxis()} yAxis={pa?.getyAxis()}/>

<style>

    .svg-rect {
        stroke-width: 1px;
        stroke: rgb(230, 28, 28);
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