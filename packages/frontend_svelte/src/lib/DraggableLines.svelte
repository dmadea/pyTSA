<script lang="ts">
  import type { Point } from "./Figure.svelte";
    import type { Rect } from "./Scene.svelte";
  import { clamp } from "./ticksUtils";

    let { 
        mapRange2Canvas,
        mapCanvas2Range,
        plotRect,
        onPositionChange,
    } = $props<{
        mapRange2Canvas: (p: Point, pr?: Rect) => Point,
        mapCanvas2Range: (p: Point, pr?: Rect) => Point,
        plotRect: Rect,
        onPositionChange?: (p: Point) => void,
    }>();

    // svg coordinates
    let x = $state(plotRect.x + plotRect.w / 2);
    let y = $state(plotRect.y + plotRect.h / 2);

    let xyInternal: Point = mapCanvas2Range({x, y});

    // Effect to update x and y when internal coordinates change
    $effect(() => {
        // runs the function whenever the internalRange changes because svelte deep tracks the state variables
        // even in functions like mapRange2Canvas, the state variables are tracked

        const newXY = mapRange2Canvas({x: xyInternal.x, y: xyInternal.y});
        x = clamp(newXY.x, plotRect.x, plotRect.x + plotRect.w);
        y = clamp(newXY.y, plotRect.y, plotRect.y + plotRect.h);
        xyInternal = mapCanvas2Range({x, y});
        console.log('x and y updated from internalRange change');
    });

    let isDragging = $state(false);
    let lastMouseDownPos = $state({x: 0, y: 0});
    let currentMousemove: ((e: MouseEvent) => void) | null = null;
    let currentMouseup: ((e: MouseEvent) => void) | null = null;
    let isHoveringVertical = $state(false);
    let isHoveringHorizontal = $state(false);
    let isHoveringIntersection = $state(false);

    const HIT_AREA_SIZE = 5; // 2px on each side
    const INTERSECTION_SIZE = 8; // Size of the intersection hit area

    function _onPositionChange(newX: number, newY: number) {
        x = newX;
        y = newY;
        xyInternal = mapCanvas2Range({x: newX, y: newY});
        onPositionChange?.(xyInternal);
    }

    export function getXYInternal() {
        return xyInternal;
    }

    function cleanupListeners() {
        if (currentMousemove) {
            window.removeEventListener('mousemove', currentMousemove, { capture: true });
            currentMousemove = null;
        }
        if (currentMouseup) {
            window.removeEventListener('mouseup', currentMouseup, { capture: true });
            currentMouseup = null;
        }
        isDragging = false;
    }

    function setupDragHandler(
        onMove: (dx: number, dy: number) => { newX: number, newY: number }
    ) {
        return (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            
            cleanupListeners();
            isDragging = true;
            lastMouseDownPos = {x: e.clientX, y: e.clientY};

            currentMousemove = (ev: MouseEvent) => {
                ev.preventDefault();
                ev.stopPropagation();
                if (!isDragging) return;

                const dx = ev.clientX - lastMouseDownPos.x;
                const dy = ev.clientY - lastMouseDownPos.y;
                
                const { newX, newY } = onMove(dx, dy);
                lastMouseDownPos = {x: ev.clientX, y: ev.clientY};
                _onPositionChange(newX, newY);
            };

            currentMouseup = (ev: MouseEvent) => {
                ev.preventDefault();
                ev.stopPropagation();
                cleanupListeners();
            };

            window.addEventListener('mousemove', currentMousemove, { capture: true });
            window.addEventListener('mouseup', currentMouseup, { capture: true });
        };
    }

    const onVerticalMouseDown = setupDragHandler((dx) => ({
        newX: x + dx, // Math.max(plotRect.x, Math.min(x + dx, plotRect.x + plotRect.w)),
        newY: y
    }));

    const onHorizontalMouseDown = setupDragHandler((_, dy) => ({
        newX: x,
        newY: y + dy //Math.max(plotRect.y, Math.min(y + dy, plotRect.y + plotRect.h))
    }));

    const onIntersectionMouseDown = setupDragHandler((dx, dy) => ({
        newX: x + dx, //Math.max(plotRect.x, Math.min(x + dx, plotRect.x + plotRect.w)),
        newY: y + dy //Math.max(plotRect.y, Math.min(y + dy, plotRect.y + plotRect.h))
    }));

    function onMouseLeave() {
        // Don't stop dragging on mouse leave
    }
</script>

<!-- Vertical line hit area -->
<rect
    class="hit-area vertical"
    x={x - HIT_AREA_SIZE/2}
    y={plotRect.y}
    width={HIT_AREA_SIZE}
    height={plotRect.h}
    onmousedown={onVerticalMouseDown}
    onmouseenter={() => isHoveringVertical = true}
    onmouseleave={() => isHoveringVertical = false}
/>

<!-- Vertical line -->
<line
    class="draggable-line"
    class:highlight={isHoveringVertical || isHoveringIntersection}
    x1={x}
    y1={plotRect.y}
    x2={x}
    y2={plotRect.y + plotRect.h}
/>

<!-- Horizontal line hit area -->
<rect
    class="hit-area horizontal"
    x={plotRect.x}
    y={y - HIT_AREA_SIZE/2}
    width={plotRect.w}
    height={HIT_AREA_SIZE}
    onmousedown={onHorizontalMouseDown}
    onmouseenter={() => isHoveringHorizontal = true}
    onmouseleave={() => isHoveringHorizontal = false}
/>

<!-- Horizontal line -->
<line
    class="draggable-line"
    class:highlight={isHoveringHorizontal || isHoveringIntersection}
    x1={plotRect.x}
    y1={y}
    x2={plotRect.x + plotRect.w}
    y2={y}
/>

<!-- Intersection hit area -->
<rect
    class="hit-area intersection"
    x={x - INTERSECTION_SIZE/2}
    y={y - INTERSECTION_SIZE/2}
    width={INTERSECTION_SIZE}
    height={INTERSECTION_SIZE}
    onmousedown={onIntersectionMouseDown}
    onmouseenter={() => isHoveringIntersection = true}
    onmouseleave={() => isHoveringIntersection = false}
/>

<style>
    .draggable-line {
        stroke: #666;
        stroke-width: 1px;
        stroke-dasharray: 4, 4;
        pointer-events: none;
    }

    .draggable-line.highlight {
        stroke: #000;
        stroke-width: 2px;
    }

    .hit-area {
        fill: transparent;
    }

    .hit-area.vertical {
        cursor: ew-resize;
    }

    .hit-area.horizontal {
        cursor: ns-resize;
    }

    .hit-area.intersection {
        cursor: move;
    }
</style> 