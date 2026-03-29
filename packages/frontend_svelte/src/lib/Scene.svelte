<script module>

    export interface SceneContext {
        canvasBoundingRect: Rect,  // changes on resize
        canvasRect: Rect,  // changes on resize
        templateRows: string, // changes on individual cell resize
        templateCols: string,  // changes on individual cell resize
        glcanvas: HTMLCanvasElement | null,
        glctx: WebGLRenderingContext | null,
        glrenderer: GLRenderer | null
        // scene: Scene | null
    }

    export interface SceneProps {
        children?: Snippet,
        templateRows?: string,
        templateCols?: string,
        colgap?: string,
        rowgap?: string,
        // onSceneInit?: (scene: Scene) => void
    }

    export interface Rect {
        x: number,
        y: number,
        w: number, // width
        h: number  // height
    }

    export interface Margin {
        left: number,
        right: number,
        top: number,
        bottom: number
    }


</script>

<script lang="ts">
    import { onMount, setContext, type Snippet } from "svelte";
    import { GLRenderer } from "./renderer";
    let { children, templateRows = "1fr 1fr", templateCols = "1fr 1fr", colgap = "5px", rowgap = "5px" }: SceneProps = $props()

        
    let wrapperClientWidth = $state<number>(0)
    let wrapperClientHeight = $state<number>(0)

    let sceneContext = $state<SceneContext>(        {
        canvasBoundingRect: { x: 0, y: 0, w: 0, h: 0 },
        canvasRect: { x: 0, y: 0, w: 0, h: 0 },
        templateRows,
        templateCols,
        glcanvas: null,
        glctx: null,
        glrenderer: null
    })

    setContext('SceneContext', sceneContext)

    $effect(() => {
        sceneContext.templateCols = templateCols
        sceneContext.templateRows = templateRows
        redrawScene()
    })

    function sceneInitRedraw() {

        // if (!sceneContext.glctx || !sceneContext.glcanvas) return;

        // sceneContext.glctx.enable(sceneContext.glctx.SCISSOR_TEST);
        // sceneContext.glctx.enable(sceneContext.glctx.CULL_FACE);

        // sceneContext.glctx.viewport(0, 0, sceneContext.glcanvas.width, sceneContext.glcanvas.height);

        // sceneContext.glctx.clearColor(1, 1, 1, 1);
        // sceneContext.glctx.clear(sceneContext.glctx.COLOR_BUFFER_BIT);

        // console.log("intial paint from scene")
    }

    function redrawScene(timeout: number = 0) {

        setTimeout(() => {
            sceneInitRedraw()

                // if (sceneContext.scene) {
                //     sceneContext.scene.replot()
                // }
                // console.log("resized, redraw")
        }, timeout)
    }

    $effect(() => {
        // on resize, update canvas dimensions
        if (!sceneContext.glcanvas) return;

        const dpr = window.devicePixelRatio;
        const w = wrapperClientWidth * dpr;
        const h = wrapperClientHeight * dpr;

        sceneContext.glcanvas.width = w;
        sceneContext.glcanvas.height = h;
        
        // Update canvas bounding rect
        let rect = sceneContext.glcanvas.getBoundingClientRect();
        sceneContext.canvasBoundingRect = {
            x: rect.x,
            y: rect.y,
            w: wrapperClientWidth,
            h: wrapperClientHeight
        };

        sceneContext.canvasRect = {
            x: 0, 
            y: 0,
            w, 
            h 
        };

        console.log($state.snapshot(wrapperClientWidth), $state.snapshot(wrapperClientHeight))
        
        // Trigger redraw
        redrawScene();
        
        // Dispatch scene-resize event for figures to update
        // const event = new CustomEvent('scene-resize');
        // window.dispatchEvent(event);

    })

    // Function to update canvas dimensions and trigger resize events
    // function updateCanvasDimensions() {
    //     if (!sceneContext.glcanvas || !wrapper) return;
        
    //     // Update canvas dimensions
    //     canvasWidth = `${wrapper.clientWidth}px`;
    //     canvasHeight = `${wrapper.clientHeight}px`;
        
    //     const dpr = window.devicePixelRatio;
    //     const w = wrapper.clientWidth * dpr;
    //     const h = wrapper.clientHeight * dpr;

    //     sceneContext.glcanvas.width = w;
    //     sceneContext.glcanvas.height = h;
        
    //     // Update canvas bounding rect
    //     let rect = sceneContext.glcanvas.getBoundingClientRect();
    //     sceneContext.canvasBoundingRect = {
    //         x: rect.x,
    //         y: rect.y,
    //         w: wrapper.clientWidth,
    //         h: wrapper.clientHeight
    //     };

    //     sceneContext.canvasRect = {
    //         x: 0, 
    //         y: 0,
    //         w: w * dpr, 
    //         h: h * dpr
    //     };
        
    //     // Trigger redraw
    //     redrawScene();
        
    //     // Dispatch scene-resize event for figures to update
    //     const event = new CustomEvent('scene-resize');
    //     window.dispatchEvent(event);
    // }

    // function runResizeObserver() {
    //     if (!wrapper) return;
        
    //     const resizeObserver = new ResizeObserver(() => {
    //         window.requestAnimationFrame(updateCanvasDimensions);
    //     });
        
    //     resizeObserver.observe(wrapper);
        
    //     return () => {
    //         resizeObserver.disconnect();
    //     };
    // }

    onMount(() => {
        // Set up resize observer
        // const cleanup = runResizeObserver();
        
        // Initialize WebGL context
        sceneContext.glctx = sceneContext.glcanvas!.getContext("webgl", {
			antialias: true,
			transparent: false,
		}) as WebGLRenderingContext;

        sceneContext.glrenderer = new GLRenderer(sceneContext.glctx)

        // const ctx = canvas2d!.getContext('2d') as CanvasRenderingContext2D;

        // const p = glctx.getParameter(glctx.ALIASED_LINE_WIDTH_RANGE)
        // console.log("parameter", p)

        // const scene = new Scene(glcanvas!, canvas2d!, glctx, ctx)
        // sceneContext.scene = new Scene(glcanvas!, canvas2d!, glctx, ctx)
        // onSceneInit?.(sceneContext.scene)
        
        // return () => {
        //     if (cleanup) cleanup();
        // };
    })


</script>



<div class="wrapper" bind:clientWidth={wrapperClientWidth} bind:clientHeight={wrapperClientHeight}>

	<canvas style="--width: {wrapperClientWidth}px; --height: {wrapperClientHeight}px; z-index: 0" bind:this={sceneContext.glcanvas}></canvas>
    <!-- <canvas style="--width: {canvasWidth}; --height: {canvasHeight}; z-index: -2" bind:this={canvas2d}></canvas> -->

    <!-- rendering of figures -->
    <div class="grid" 
    style="--width: {wrapperClientWidth}px; --height: {wrapperClientHeight}px; --column-gap: {colgap}; --row-gap: {rowgap}; --template-rows: {templateRows}; --template-cols: {templateCols}">
        {@render children?.()}
    </div>
</div>


<style>

.wrapper {
    position: relative;
    width: 95%;
    height: 100%;
    margin: 10px 50px;
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