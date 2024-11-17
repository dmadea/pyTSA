import { F32Array } from "./array"
import { Color } from "./color"

interface Program {
    program: WebGLProgram,
    attribLocations: {},
    uniformLocations: {}
}


interface ThinLineProgram extends Program {
    attribLocations: {
        coordinates: GLint
    },
    uniformLocations: {
        uscale: WebGLUniformLocation,
        uoffset: WebGLUniformLocation,
        ucolor: WebGLUniformLocation
    }
}

interface IThinLinePlot {
    buffer: WebGLBuffer,
    xyData: F32Array,
    color: Color,
    label: string | null,
}


class GLRenderer {

    public glctx: WebGLRenderingContext
    public thinLineProgram: ThinLineProgram | null = null

    constructor(glctx: WebGLRenderingContext) {
        this.glctx = glctx
        this.initWebGL()
    }


    private initWebGL () {

        this.glctx.clearColor(1, 1, 1, 1);
        this.glctx.clear(this.glctx.COLOR_BUFFER_BIT);
    
        // Set the view port
        // ctx.viewport(crop, crop, canvas.width - 2 * crop, canvas.height  - 2 * crop);
    
        this.initThinLineProgram();
    
        this.glctx.enable(this.glctx.BLEND);
        this.glctx.blendFunc(this.glctx.SRC_ALPHA, this.glctx.ONE_MINUS_SRC_ALPHA);
    }

    public drawThinLine(line: IThinLinePlot, uscale: [number, number, number, number], uoffset: [number, number, number, number]) {

        if (!this.thinLineProgram)
            throw Error("Thin line program does is not instantiated.")

        const numComponents = 2; // pull out 2 values per iteration
        const type = this.glctx.FLOAT; // the data in the buffer is 32bit floats
        const normalize = false; // don't normalize
        const stride = 0; // how many bytes to get from one set of values to the next
        // 0 = use type and numComponents above
        const offset = 0; // how many bytes inside the buffer to start from

        // link buffer to plot the data from it

        this.glctx.bindBuffer(this.glctx.ARRAY_BUFFER, line.buffer);
        this.glctx.vertexAttribPointer(this.thinLineProgram.attribLocations.coordinates, numComponents, type, normalize, stride, offset);
		this.glctx.enableVertexAttribArray(this.thinLineProgram.attribLocations.coordinates);

        // assign uniforms

        this.glctx.uniformMatrix2fv(this.thinLineProgram.uniformLocations.uscale, false, uscale);
        this.glctx.uniformMatrix2fv(this.thinLineProgram.uniformLocations.uoffset, false, uoffset);

        this.glctx.uniformMatrix2fv(
            this.thinLineProgram.uniformLocations.uscale, 
            false,
            [line.color.r, line.color.g, line.color.b, line.color.alpha]);

        // draw arrays

        this.glctx.drawArrays(this.glctx.LINE_STRIP, 0, line.xyData.length / 2);

    }

    private initThinLineProgram() {
        const vertCode = `
        attribute vec2 coordinates;
        uniform mat2 uscale;
        uniform vec2 uoffset;
    
        void main(void) {
            gl_Position = vec4(uscale*coordinates + uoffset, 0.0, 1.0);
        }`;
    
        const fragCode = `
        precision mediump float;
        uniform highp vec4 uColor;
        void main(void) {
            gl_FragColor =  uColor;
        }`;

        const program = this.initProgram(vertCode, fragCode)

        if (!program)
            return

        this.thinLineProgram = {
            program: program,
            attribLocations: {
                coordinates: this.glctx.getAttribLocation(program, "coordinates")
            },
            uniformLocations: {
                uscale: this.glctx.getUniformLocation(program, "uscale")!,
                uoffset: this.glctx.getUniformLocation(program, "uoffset")!,
                ucolor: this.glctx.getUniformLocation(program, "ucolor")!
            }
        }
    }


    private initProgram(vs: string, fs: string): WebGLProgram | null {
        const vertexShader = this.loadShader(this.glctx.VERTEX_SHADER, vs);
        const fragmentShader = this.loadShader(this.glctx.FRAGMENT_SHADER, fs);

        if (!vertexShader || !fragmentShader)
            return null
      
        // Create the shader program
      
        const shaderProgram = this.glctx.createProgram()!;
        this.glctx.attachShader(shaderProgram, vertexShader);
        this.glctx.attachShader(shaderProgram, fragmentShader);
        this.glctx.linkProgram(shaderProgram);
      
        // If creating the shader program failed, alert
      
        if (!this.glctx.getProgramParameter(shaderProgram, this.glctx.LINK_STATUS)) {
            console.log(`Unable to initialize the shader program: ${this.glctx.getProgramInfoLog(shaderProgram)}`);
          return null;
        }
      
        return shaderProgram;

    }

    private loadShader(type: number, source: string): WebGLShader | null {
        const shader = this.glctx.createShader(type)!;

        // Send the source to the shader object

        this.glctx.shaderSource(shader, source);

        // Compile the shader program

        this.glctx.compileShader(shader);

        // See if it compiled successfully

        if (!this.glctx.getShaderParameter(shader, this.glctx.COMPILE_STATUS)) {
            console.log(`An error occurred compiling the shaders: ${this.glctx.getShaderInfoLog(shader)}`);
            this.glctx.deleteShader(shader);
            return null;
        }

        return shader;
    }
}

