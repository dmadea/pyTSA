<script lang="ts">
    import { getContext } from "svelte";
    import type { SceneContext, Rect } from "./Scene.svelte";
    import type { Point, Cursor, Orientation } from "./Figure.svelte";
    import { Axis } from "./axis.svelte";
    import TicksAndLabels from "./TicksAndLabels.svelte";
    import ContextMenu from "./ContextMenu.svelte";
    import type { ContextMenuItem } from "./ContextMenu.svelte";
    // import SettingsMenu from "./SettingsMenu.svelte";
    import { formatNumber2String } from "./ticksUtils";
    import DraggableLines from "./DraggableLines.svelte";


    // Props
    let { 
        title = "",
        axisAlignment = "Horizontal",
        svgClientRect, 
        onContextMenu,
        onLinesPositionChange,
    } = $props<{
        title?: string,
        axisAlignment?: Orientation,
        svgClientRect: Rect,
        onContextMenu?: (x: number, y: number) => void,
        onLinesPositionChange?: (x: number, y: number) => void,
    }>();

    // Context
    // let sceneContext: SceneContext = getContext('SceneContext');

    let svgPlotRect = $state({x: 100, y: 100, w: 300, h: 300})  // plot rect in svg coordinates, boundary of the plot area
    // let settingsMenu = $state<ReturnType<typeof SettingsMenu>>()

    // let title = $state<string>("")
    let showTicks = $state<string[]>(['left', 'right', 'bottom', 'top'])        // ['top', 'bottom', 'left', 'right']
    let showTickNumbers = $state<string[]>(['left', 'right', 'bottom', 'top'])  // ['top', 'bottom', 'left', 'right']
    // let axisAlignment = $state<Orientation>("Horizontal")   // could be vertical
    let showLegend = $state<boolean>(false);

    let internalRange: Rect = $state<Rect>({x: -1, y: -1, w: 2, h: 2})  // in case of scale of data, the range will be just indexes of data it is bound to

    const xAxis = new Axis('xAxis')
    const yAxis = new Axis('yAxis')

    // State
    let cursor = $state<Cursor>("crosshair");
    let panning: boolean = false;
    let scaling: boolean = false;
    let lastMouseDownPos: Point = {x: 0, y: 0};
    let lastCenterPoint: Point = {x: 0, y: 0};
    let lastRange: Rect = {x: -1, y: -1, w: 2, h: 2};

    let mousePosition = $state<Point>({x: 0, y: 0});
    let showCoordinates = $state<boolean>(false);

    let linesPosition = $state<Point>({x: svgPlotRect.x + svgPlotRect.w/2, y: svgPlotRect.y + svgPlotRect.h/2});

    // Functions
    export function getBoundedRange(rect: Rect, dontZoom: boolean): Rect {
        // const xvb = xAxis.internalViewBounds;
        // const yvb = yAxis.internalViewBounds;

        const xvb = [-Number.MAX_VALUE, Number.MAX_VALUE];
        const yvb = [-Number.MAX_VALUE, Number.MAX_VALUE];

        const [xB0, xB1] = [xvb[0], xvb[1]];
        const [yB0, yB1] = [yvb[0], yvb[1]];
        var x0 = Math.max(rect.x, xB0);
        var y0 = Math.max(rect.y, yB0);
        var x1 = Math.min(rect.x + rect.w, xB1);
        var y1 = Math.min(rect.y + rect.h, yB1);

        var retRect: Rect = {
            x: x0,
            y: y0,
            w: x1 - x0,
            h: y1 - y0
        }

        if (dontZoom){
            if (x0 === xB0) retRect.w = rect.w;
            
            if (x1 === xB1){
                retRect.w = rect.w;
                retRect.x = x1 - rect.w;
            }
            if (y0 === yB0) retRect.h = rect.h;
            
            if (y1 === yB1){
                retRect.h = rect.h;
                retRect.y = y1 - rect.h;
            }
        }

        return retRect;
    }
    
    function mapCanvas2Range(p: Point, pr?: Rect): Point {
        const r = pr ?? svgPlotRect;

        let xrel = (p.x - r.x) / r.w;
        let yrel = (p.y - r.y) / r.h;

        if (axisAlignment === 'Vertical') {
            xrel = yAxis.inverted ? xrel : 1 - xrel;
            yrel = xAxis.inverted ? yrel : 1 - yrel;  // y axis is inverted in default
            return {
                x: internalRange.x + yrel * internalRange.w,
                y: internalRange.y + xrel * internalRange.h
            }
        } else {
            xrel = xAxis.inverted ? 1 - xrel : xrel;
            yrel = yAxis.inverted ? yrel : 1 - yrel;  // y axis is inverted in default
            return {
                x: internalRange.x + xrel * internalRange.w,
                y: internalRange.y + yrel * internalRange.h
            }
        }
    }

    function mapRange2Canvas(p: Point, pr?: Rect): Point {
        const r = pr ?? svgPlotRect;
        let xrel = (p.x - internalRange.x) / internalRange.w;
        let yrel = (p.y - internalRange.y) / internalRange.h;

        xrel = xAxis.inverted ? 1 - xrel : xrel;
        yrel = yAxis.inverted ? yrel : 1 - yrel;  // y axis is inverted in default

        if (axisAlignment === 'Vertical') {
            return {
                x: r.x + yrel * r.w,
                y: r.y + (1 - xrel) * r.h
            }
        } else {
            return {
                x: r.x + xrel * r.w,
                y: r.y + yrel * r.h 
            }
        }
    }

    export function getxAxis() {
        return xAxis;
    }

    export function getyAxis() {
        return yAxis;
    }

    function rangeChanged() {
        // internalRange = getBoundedRange(svgPlotRect, false);
    }

    function onMouseDown(e: MouseEvent) {
        e.preventDefault();

        if (e.ctrlKey) return;  // for this case, default context menu is opened
        
        scaling = e.button == 2;
        panning = e.button == 0 || e.button == 1;

        lastMouseDownPos = {x: e.clientX, y: e.clientY};
        lastRange = {...internalRange};
        lastCenterPoint = mapCanvas2Range(lastMouseDownPos, svgClientRect);

        if (panning) {
            cursor = "grabbing";
        } else if (scaling) {
            cursor = "move";
        } 

        if (scaling || panning) {
            const lastPos = {x: e.clientX, y: e.clientY};
            const va = axisAlignment === "Vertical";

            var mousemove = (ev: MouseEvent) => {
                let dist: Point = {
                    x: ev.clientX - lastPos.x,
                    y: ev.clientY - lastPos.y
                }
        
                if (va) {
                    dist = {x: dist.y, y: dist.x};
                }
        
                let rangeChanged = false;
                if (panning) {
                    const r = svgClientRect;
        
                    let w = r.w;
                    let h = r.h;
                    
                    let xSign = xAxis.inverted ? 1 : -1;
                    const ySign = yAxis.inverted ? -1 : 1;
        
                    if (va) {
                        [w, h] = [h, w];
                        xSign *= -1;
                    }
        
                    const xRatio = lastRange.w / w;
                    const yRatio = lastRange.h / h;

                    let [dx, dy] = [xSign * dist.x * xRatio, ySign * dist.y * yRatio];
                    
                    dx = xAxis.keepCentered ? 0 : dx;
                    dy = yAxis.keepCentered ? 0 : dy;
        
                    let newRect: Rect = {
                        x: lastRange.x + dx, 
                        y: lastRange.y + dy,
                        w: lastRange.w,
                        h: lastRange.h
                    };
        
                    internalRange = getBoundedRange(newRect, true);
                    rangeChanged = true;
                }
                
                if (scaling) {
                    let xZoom = 1.01 ** dist.x;
                    let yZoom = 1.01 ** dist.y;
        
                    if (va) {
                        xZoom = 1 / xZoom;
                        yZoom = 1 / yZoom;
                    }
        
                    let newRect: Rect = {
                        x: lastCenterPoint.x - (lastCenterPoint.x - lastRange.x) / xZoom, 
                        y: lastCenterPoint.y - (lastCenterPoint.y - lastRange.y) * yZoom,
                        w: lastRange.w / xZoom,
                        h: lastRange.h * yZoom
                    };

                    if (xAxis.keepCentered) {
                        const extreme = Math.max(Math.abs(lastRange.x), Math.abs(lastRange.x + lastRange.w));
                        newRect.x = -extreme / xZoom;
                        newRect.w = -2*newRect.x;
                    }

                    if (yAxis.keepCentered) {
                        const extreme = Math.max(Math.abs(lastRange.y), Math.abs(lastRange.y + lastRange.h));
                        newRect.y = -extreme / yZoom;
                        newRect.h = -2*newRect.y;
                    }

                    internalRange = getBoundedRange(newRect, false);
                    rangeChanged = true;
                }
            }

            var mouseup = (ev: MouseEvent) => {
                window.removeEventListener('mousemove', mousemove);
                window.removeEventListener('mouseup', mouseup);
                cursor = "crosshair";
            }

            window.addEventListener('mousemove', mousemove);
            window.addEventListener('mouseup', mouseup);
        }
    }

    function onMouseUp(e: MouseEvent) {
        e.preventDefault();
        panning = false;
        scaling = false;

        // Open context menu on right click
        if (e.button === 2 && lastMouseDownPos.x === e.clientX && lastMouseDownPos.y === e.clientY) { // 2 is right mouse button
            onContextMenu?.(e.layerX, e.layerY);
        }
    }

    function onMouseMove(e: MouseEvent) {
        if (!showCoordinates) return;

        const x = e.offsetX;
        const y = e.offsetY;

        const rangePoint = mapCanvas2Range({x, y});
        mousePosition = rangePoint;
    }

    function onMouseLeave() {
        showCoordinates = false;
    }

    function onMouseEnter() {
        showCoordinates = true;
    }

    function onDblClick(e: MouseEvent) {
        // Double click handling if needed
    }

    function _onContextMenu(e: MouseEvent) {
        if (e.ctrlKey) return;
        e.preventDefault();
    }

    function updatePlotRect(r: Rect) {
        if (r.x !== svgPlotRect.x || r.y !== svgPlotRect.y || r.w !== svgPlotRect.w || r.h !== svgPlotRect.h) {
            svgPlotRect = r;
            console.log("svgPlotRect changed", r);
        }
    }

    function handleLinesPositionChange(p: Point) {
        // linesPosition = {x, y};
        // onLinesPositionChange?.(x, y);
    }

</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<rect class="plot-rect" 
style="cursor: {cursor};"
onmousedown={onMouseDown}
onmousemove={onMouseMove}
onmouseup={onMouseUp}
ondblclick={onDblClick}
oncontextmenu={_onContextMenu}
onmouseleave={onMouseLeave}
onmouseenter={onMouseEnter}
aria-label="Plot area"
x={svgPlotRect.x} y={svgPlotRect.y} width={svgPlotRect.w} height={svgPlotRect.h}/>

<DraggableLines 
    plotRect={svgPlotRect}
    mapRange2Canvas={mapRange2Canvas}
    mapCanvas2Range={mapCanvas2Range}
    onPositionChange={handleLinesPositionChange}
/>

{#if showCoordinates}
    <text 
        class="coordinate-display"
        x={svgPlotRect.x + 10} 
        y={svgPlotRect.y + svgPlotRect.h - 10}
    >
        x: {formatNumber2String(mousePosition.x, 3)}, y: {formatNumber2String(mousePosition.y, 3)}
    </text>
{/if}

<TicksAndLabels 
    {title} 
    {svgClientRect} 
    {axisAlignment}
    {showTicks} 
    {showTickNumbers}
    leftAxisLabel={axisAlignment === 'Vertical' ? xAxis.label : yAxis.label}
    rightAxisLabel=""
    bottomAxisLabel={axisAlignment === 'Vertical' ? yAxis.label : xAxis.label}
    {internalRange}
    xAxis={xAxis}
    yAxis={yAxis}
    mapRange2Canvas={mapRange2Canvas}
    updatePlotRect={updatePlotRect}
/>

<!-- <SettingsMenu bind:this={settingsMenu} title={title} axisAlignment={axisAlignment} xAxis={xAxis} yAxis={yAxis}/> -->

<style>
    .plot-rect {
        stroke-width: 2px;
        stroke: black;
        fill: transparent;
    }

    .plot-area {
        user-select: none;
    }

    .coordinate-display {
        font-size: 14px;
        fill: #666;
        pointer-events: none;
    }

    .sett-button:hover > path {
        fill: #000;
        transition: 0.3s;
    }
    
    .sett-button {
        cursor: pointer;
        fill: #afafaf;
    }
</style> 