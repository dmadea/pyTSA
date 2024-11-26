import { F32Array } from "./array"
import { Color } from "./color"
import { glMatrix, mat3 } from "gl-matrix"
import { Scale } from "./figure/axis"

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
        umatrix: WebGLUniformLocation,
        ucolor: WebGLUniformLocation,
        scale: WebGLUniformLocation,
        linscale: WebGLUniformLocation,
        linthresh: WebGLUniformLocation,
    }
}

export interface IThinLinePlot {
    buffer: WebGLBuffer,
    x: F32Array,
    y: F32Array,
    color: Color,
    label: string | null,
}


export class GLRenderer {

    public glctx: WebGLRenderingContext
    public thinLineProgram: ThinLineProgram | null = null

    constructor(glctx: WebGLRenderingContext) {
        this.glctx = glctx
        this.initWebGL()
    }


    private initWebGL () {

        this.initThinLineProgram();
    
        // this.glctx.enable(this.glctx.BLEND);
        // this.glctx.blendFunc(this.glctx.SRC_ALPHA, this.glctx.ONE_MINUS_SRC_ALPHA);
    }

    public createThinLine(x: F32Array | number[],  y: F32Array | number[], color: Color, label: string | null = null): IThinLinePlot {
        // x.length === y.length

        const xyData = new F32Array(x.length * 2)
        for (let i = 0; i < x.length; i++) {
            xyData[2 * i] = x[i]
            xyData[2 * i + 1] = y[i]
        }

        var buffer = this.glctx.createBuffer() as WebGLBuffer;
        this.glctx.bindBuffer(this.glctx.ARRAY_BUFFER, buffer);
		this.glctx.bufferData(this.glctx.ARRAY_BUFFER, xyData as ArrayBuffer, this.glctx.STREAM_DRAW);

        return {
            buffer, x, y, color, label
        }
    }

    public drawThinLine(line: IThinLinePlot, umatrix: number[] | Float32Array, xscale: Scale, yscale: Scale,
         xlinthresh: number = 1, ylinthresh: number = 1, xlinscale: number = 1, ylinscale: number = 1) {

        if (!this.thinLineProgram)
            throw Error("Thin line program is not instantiated.")

		this.glctx.useProgram(this.thinLineProgram.program);

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

        this.glctx.uniformMatrix3fv(this.thinLineProgram.uniformLocations.umatrix, false, umatrix);

        this.glctx.uniform4fv(
            this.thinLineProgram.uniformLocations.ucolor, 
            [line.color.r, line.color.g, line.color.b, line.color.alpha])

        const getIntScale = (scale: Scale): number => {
            switch (scale) {
                case 'lin': {
                    return 0
                }
                case 'log': {
                    return 1
                }
                case 'symlog': {
                    return 2
                }
                default: {
                    if (!(scale instanceof F32Array)) {
                        throw new Error(`${scale}: Not implemented`);
                    }
                    return 3
                }
            }
        }

        this.glctx.uniform2iv(this.thinLineProgram.uniformLocations.scale, [getIntScale(xscale), getIntScale(yscale)]);
        this.glctx.uniform2fv(this.thinLineProgram.uniformLocations.linscale, [xlinscale, ylinscale]);
        this.glctx.uniform2fv(this.thinLineProgram.uniformLocations.linthresh, [xlinthresh, ylinthresh]);

        // draw arrays

        this.glctx.drawArrays(this.glctx.LINE_STRIP, 0, line.x.length);

        // console.log("draw arrays called")

    }

    private initThinLineProgram() {
        const vertCode = `
        attribute vec2 coordinates;
        uniform mat3 umatrix;
        uniform ivec2 u_scale; // [xscale, yscale]
        uniform vec2 u_linscale;  // [x, y]
        uniform vec2 u_linthresh;  // [x, y]

        const float log10 = 2.302585;

        // transformation function
        float tr(int scale, float value, float linscale, float linthresh) {
            if (scale == 0) {    // linear
                return value;
            } else if (scale == 1) {  // log
                return (value <= 0.0) ? -5.0 : log(value) / log10;
            } else if (scale == 2) {  // symlog

                // float linthresh = 1.0;
                // float linscale = 1.0;

                if (abs(value) <= linthresh) {
                    return value;
                } else {
                    float sign = (value >= 0.0) ? 1.0 : -1.0;
                    return sign * linthresh * (1.0 + log(abs(value) / linthresh) / (linscale * log10));
                }
            } else {    // data bound
                return 0.0; // TOOD
            }
        }
        
        void main(void) {
            vec3 coor = vec3(tr(u_scale.x, coordinates.x, u_linscale.x, u_linthresh.x), tr(u_scale.y, coordinates.y, u_linscale.y, u_linthresh.y), 1.0);

            gl_Position = vec4(umatrix * coor, 1.0);
        }`;
    
        const fragCode = `
        precision mediump float;
        uniform highp vec4 ucolor;
        void main(void) {
            gl_FragColor =  ucolor;
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
                umatrix: this.glctx.getUniformLocation(program, "umatrix")!,
                ucolor: this.glctx.getUniformLocation(program, "ucolor")!,
                scale: this.glctx.getUniformLocation(program, "u_scale")!,
                linscale: this.glctx.getUniformLocation(program, "u_linscale")!,
                linthresh: this.glctx.getUniformLocation(program, "u_linthresh")!,
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

