<script lang="ts">

	import { onMount } from "svelte";

	function linspace(start: number, end: number, n: number, endpoint: boolean = false): Array<number> {
        if (n < 2) {
            throw TypeError("At least 2 points are required.");
        }
        let nn = (endpoint) ? n - 1 : n;
        let diff = (end - start) / nn;
        let arr = new Array<number>(n);
        for (let i = 0; i < n; i++) {
            arr[i] = start + i * diff;
        }
        return arr;
    }

	let canvas: HTMLCanvasElement;
	let ctx: WebGLRenderingContext;     // corresponding context
	let progLine: WebGLProgram;

	const x = linspace(-1, 1, 1000);

	const xyData = new Float32Array(x.length * 2);

	function populateArray() {
		for (let i = 0; i < x.length; i++) {
			xyData[2*i] = x[i];
			xyData[2*i + 1] = Math.random() * 4 -2;
		}
	}

	populateArray();


	onMount(() => {
		ctx = canvas.getContext("webgl", {
			antialias: true,
			transparent: false,
		}) as WebGLRenderingContext;

		initWebGl()

		handleClick()

	});

	function initWebGl () {

		// ctx.clearColor(1, 0, 0, 1);
		ctx.clear(ctx.COLOR_BUFFER_BIT);

		const dpr = window.devicePixelRatio || 1;

		canvas.width = canvas.clientWidth * dpr;
		canvas.height = canvas.clientHeight * dpr;

		// Set the view port
		let crop = 100;
		// ctx.viewport(0, 0, canvas.width, canvas.height);
		ctx.viewport(crop, crop, canvas.width - 2 * crop, canvas.height  - 2 * crop);


		initThinLineProgram();

		ctx.enable(ctx.BLEND);
		ctx.blendFunc(ctx.SRC_ALPHA, ctx.ONE_MINUS_SRC_ALPHA);
	}

	function initThinLineProgram() {

		const vertCode = `
		attribute vec2 coordinates;
		uniform mat2 uscale;
		uniform vec2 uoffset;

		void main(void) {
			gl_Position = vec4(uscale*coordinates + uoffset, 0.0, 1.0);
		}`;

		// Create a vertex shader object
		const vertShader = ctx.createShader(ctx.VERTEX_SHADER);

		// Attach vertex shader source code
		ctx.shaderSource(vertShader as WebGLShader, vertCode);

		// Compile the vertex shader
		ctx.compileShader(vertShader as WebGLShader);

		// Fragment shader source code
		const fragCode = `
			precision mediump float;
			uniform highp vec4 uColor;
			void main(void) {
				gl_FragColor =  uColor;
			}`;

		const fragShader = ctx.createShader(ctx.FRAGMENT_SHADER);
		ctx.shaderSource(fragShader as WebGLShader, fragCode);
		ctx.compileShader(fragShader as WebGLShader);
		progLine = ctx.createProgram() as WebGLProgram;
		ctx.attachShader(progLine, vertShader as WebGLShader);
		ctx.attachShader(progLine, fragShader as WebGLShader);
		ctx.linkProgram(progLine);
	}

	function handleClick() {

		var buffer = ctx.createBuffer() as WebGLBuffer;

    	ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer);
		ctx.bufferData(ctx.ARRAY_BUFFER, xyData as ArrayBuffer, ctx.STREAM_DRAW);

		var attrCoorLoc: GLint = ctx.getAttribLocation(progLine, "coordinates");
		ctx.vertexAttribPointer(attrCoorLoc, 2, ctx.FLOAT, false, 0, 0);
		ctx.enableVertexAttribArray(attrCoorLoc);

		drawLine();
	}

	function drawLine() {
		ctx.useProgram(progLine);

        const uscale = ctx.getUniformLocation(progLine, "uscale");
        ctx.uniformMatrix2fv(uscale, false, [1, 0, 0, 1]);

        const uoffset = ctx.getUniformLocation(progLine, "uoffset");
        ctx.uniform2fv(uoffset, [0, 0]);

        const uColor = ctx.getUniformLocation(progLine, "uColor");
        ctx.uniform4fv(uColor, [1, 0, 0, 1]);

        // ctx.bufferData(ctx.ARRAY_BUFFER, line.xy as ArrayBuffer, webgl.STREAM_DRAW);

        ctx.drawArrays(ctx.LINE_STRIP, 0, xyData.length / 2);
	}

</script>


<div class="ddd">

	<button on:click={handleClick}>
		Draw line !
	</button>

	<button on:click={() => {
		populateArray();
		drawLine();
		}}>
		Change data!
	</button>
	
	<canvas class="canvas" bind:this={canvas} >
	</canvas>
	
</div>
<style>

	.canvas {
		width: 100%;
		height: 300px;
		outline: black 1px solid;
	}

	.ddd {
		display: grid;
	}

	
</style>
