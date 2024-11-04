<script module>

    export interface SceneContext {
        canvasBoundingRect: Rect,  // changes on resize
        templateRows: string, // changes on individual cell resize
        templateCols: string,  // changes on individual cell resize
        scene: Scene | null
    }

    export interface SceneProps {
        children?: Snippet,
        templateRows?: string,
        templateCols?: string,
        colgap?: string,
        rowgap?: string
    }

</script>

<script lang="ts">
    import { onMount, setContext, type Snippet } from "svelte";
    import { Matrix, Scene } from "@pytsa/ts-graph-new";
    import type { Rect } from "@pytsa/ts-graph-new/src/types.js";
    let { children, templateRows = "1fr 1fr", templateCols = "1fr 1fr", colgap = "5px", rowgap = "5px" }: SceneProps = $props()

    let glcanvas = $state<HTMLCanvasElement>()
    let canvas2d = $state<HTMLCanvasElement>()

    let wrapper = $state<HTMLDivElement>()

    let canvasWidth = $state<string>("100px")
    let canvasHeight = $state<string>("100px")

    let sceneContext = $state<SceneContext>({
            canvasBoundingRect: {x: 0, y: 0, w: 0, h: 0},
            templateRows, 
            templateCols,
            scene: null
    })
    
    setContext('SceneContext', sceneContext)

    $effect(() => {
        sceneContext.templateCols = templateCols
        sceneContext.templateRows = templateRows
        redrawScene()
    })

    function redrawScene(timeout: number = 1) {
        setTimeout(() => {
                if (sceneContext.scene) {
                    sceneContext.scene.replot()
                }
                console.log("resized, redraw")
        }, timeout)
    }

    function runResizeObserver(onresize?: (width: number, height: number) => void) {
        const canvasResizeObserver = new ResizeObserver((entries) => {
        window.requestAnimationFrame(() => {
            if (!Array.isArray(entries) || !entries.length) {
                return;
            }

            if (!glcanvas || !canvas2d || !wrapper) return;
            
            canvasWidth = `${wrapper.clientWidth}px`;
            canvasHeight = `${wrapper.clientHeight}px`;
            
            const dpr = window.devicePixelRatio;
            const w = wrapper.clientWidth * dpr;
            const h = wrapper.clientHeight * dpr;

            glcanvas.width = w;
            glcanvas.height = h;
            canvas2d.width = w;
            canvas2d.height = h;

            onresize?.(wrapper.clientWidth, wrapper.clientHeight)

            });
        });
        canvasResizeObserver.observe(wrapper!);
    }


    onMount(() => {
        runResizeObserver((w, h) => {
            let rect = canvas2d!.getBoundingClientRect()
            const dpr = window.devicePixelRatio;

            sceneContext.canvasBoundingRect = {
                x: rect.x,
                y: rect.y,
                w, h
            }

            if (sceneContext.scene) {
                sceneContext.scene.canvasRect = {
                    x: 0, 
                    y: 0,
                    w: w * dpr, 
                    h: h * dpr
                }
            }

            redrawScene()
        })

        const glctx = glcanvas!.getContext("webgl", {
			antialias: true,
			transparent: false,
		}) as WebGLRenderingContext;

        const ctx = canvas2d!.getContext('2d') as CanvasRenderingContext2D;

        // const scene = new Scene(glcanvas!, canvas2d!, glctx, ctx)
        sceneContext.scene = new Scene(glcanvas!, canvas2d!, glctx, ctx)
        // console.log(scene)

    })


</script>



<div class="wrapper" bind:this={wrapper}>

	<canvas style="--width: {canvasWidth}; --height: {canvasHeight}; z-index: 0" bind:this={glcanvas}></canvas>
    <canvas style="--width: {canvasWidth}; --height: {canvasHeight}; z-index: 1" bind:this={canvas2d}></canvas>

    <!-- rendering of figures -->
    <div class="grid" 
    style="--width: {canvasWidth}; --height: {canvasHeight}; --column-gap: {colgap}; --row-gap: {rowgap}; --template-rows: {templateRows}; --template-cols: {templateCols}">
        {@render children?.()}
    </div>
</div>


<style>

.wrapper {
    position: relative;
    width: 100%;
    height: 100%;
}

canvas {
    position: absolute;
    width: var(--width);
    height: var(--height);
    border: 1px solid;
    border-color: black;
}

.grid {
    position: absolute;
    display: grid;
    grid-template-columns: var(--template-cols);
    grid-template-rows: var(--template-rows);
    width: var(--width);
    height: var(--height);
    box-sizing: border-box;

    column-gap: var(--column-gap);
    row-gap: var(--row-gap);
    z-index: 2;

}

</style>