<!-- <script module>
    export interface DraggableLinesProps {
        figure: Figure,
        svgRect: Rect,
    }
</script> -->


<script lang="ts">
    import { getContext } from "svelte";
    import type { SceneContext } from "./Scene.svelte"
    import type { FigureContext } from "./Figure.svelte";

    // let { figure, svgRect }: DraggableLinesProps = $props()
    let sceneContext: SceneContext = getContext('SceneContext')
    let { figure, svgRect }: FigureContext = getContext('FigureContext')

    const offset = 5
    
    let ypos = $state(svgRect.h / 2)
    let x1 = $state(0)
    let x2 = $state(svgRect.w)

    function mouseDown(e: MouseEvent) {
        e.stopPropagation()

        ypos += 10

    }

    function mouseUp(e: MouseEvent) {
        e.stopPropagation()
    }

    function mouseMove(e: MouseEvent) {
        e.stopPropagation()
    }

    function repaint() {
        const r = figure.getEffectiveRect();
        const cr = figure.canvasRect;
        const dpr = window.devicePixelRatio

        x1 = (r.x - cr.x) / dpr
        x2 = (r.x + r.w - cr.x) / dpr
    }
    figure.addOnRepaintListener(() => {
        repaint()
    })

    $effect(() => {
        const cr  = sceneContext.canvasBoundingRect;
        setTimeout(() => repaint(), 0)
    })

    $inspect(x1, x2)


</script>


<!-- svelte-ignore a11y_no_static_element_interactions -->
<g class="grp" onmousedown={mouseDown} onmouseup={mouseUp} onmousemove={mouseMove}> 
    <line class="line" x1={x1} y1={ypos} x2={x2} y2={ypos} />
    <polygon class="polygon" points="0,{ypos + offset} {svgRect.w},{ypos + offset} {svgRect.w},{ypos - offset} 0,{ypos - offset}" />
</g>

<style>

    .polygon {
        fill: transparent;
    }

    .line {
        stroke: rgb(110, 106, 106);
        stroke-dasharray: 5;
        stroke-width: 1px;
    }

    .grp {
        cursor: move;
    }

    .grp:hover > .line {
        stroke: rgb(0, 0, 0);
        stroke-dasharray: 5;
        stroke-width: 2px;
    }

</style>