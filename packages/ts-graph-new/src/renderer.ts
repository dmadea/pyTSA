import { F32Array } from "./array"
import { Color, Colormap } from "./color"
import { glMatrix, mat3 } from "gl-matrix"
import { Scale } from "./figure/axis"
import { Dataset } from "./utils"

interface Program {
    program: WebGLProgram,
    attribLocations: {},
    uniformLocations: {}
}


interface ThinLineProgram extends Program {
    attribLocations: {
        a_coordinates: GLint
    },
    uniformLocations: {
        u_matrix: WebGLUniformLocation,
        u_color: WebGLUniformLocation,
        u_scale: WebGLUniformLocation,
        u_linscale: WebGLUniformLocation,
        u_linthresh: WebGLUniformLocation,
    }
}

interface HeatMapProgram extends Program {
    attribLocations: {
        a_vertCoord: GLint
    },
    uniformLocations: {
        u_matrix: WebGLUniformLocation,
        // u_image: WebGLUniformLocation,
        // u_xvals: WebGLUniformLocation,
        // u_yvals: WebGLUniformLocation,
    }
}

export interface IThinLinePlot {
    buffer: WebGLBuffer,
    x: F32Array,
    y: F32Array,
    color: Color,
    label: string | null,
}

export interface IHeatmapPlot {
    vertBuffer: WebGLBuffer, // rectangle of the plotted image
    // texture: WebGLTexture,
    vertices: Float32Array
    dataset: Dataset,
}

const tranformFunction: string = `
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
`

const jetColorMap = `
vec4 jet(float x) {
    vec3 a, b;
    float c;
    if (x < 0.34) {
        a = vec3(0, 0, 0.5);
        b = vec3(0, 0.8, 0.95);
        c = (x - 0.0) / (0.34 - 0.0);
    } else if (x < 0.64) {
        a = vec3(0, 0.8, 0.95);
        b = vec3(0.85, 1, 0.04);
        c = (x - 0.34) / (0.64 - 0.34);
    } else if (x < 0.89) {
        a = vec3(0.85, 1, 0.04);
        b = vec3(0.96, 0.7, 0);
        c = (x - 0.64) / (0.89 - 0.64);
    } else {
        a = vec3(0.96, 0.7, 0);
        b = vec3(0.5, 0, 0);
        c = (x - 0.89) / (1.0 - 0.89);
    }
    return vec4(mix(a, b, c), 1.0);
}
`


export class GLRenderer {

    public glctx: WebGLRenderingContext
    public thinLineProgram: ThinLineProgram | null = null
    public heatMapProgram: HeatMapProgram | null = null

    constructor(glctx: WebGLRenderingContext) {
        this.glctx = glctx
        this.initWebGL()
    }


    private initWebGL () {

        this.initThinLineProgram();
        this.initHeatmapProgram();
    
        // this.glctx.enable(this.glctx.BLEND);
        // this.glctx.blendFunc(this.glctx.SRC_ALPHA, this.glctx.ONE_MINUS_SRC_ALPHA);
    }

    public createHeatMap(dataset: Dataset): IHeatmapPlot {

        // const x0 = dataset.x[0]
        // const x1 = dataset.x[dataset.x.length - 1]
        // const y0 = dataset.y[0]
        // const y1 = dataset.y[dataset.y.length - 1]

        // const xy = new Float32Array([
        //     x0, y0,
        //     x1, y0,
        //     x0, y1,
        //     x1, y1
        // ])


        const vertices = new Float32Array(dataset.x.length * dataset.y.length * 3 * 6)

        const zmin = dataset.data.min()
        const zmax = dataset.data.max()


        for (let i = 0; i < dataset.data.nrows; i++) {
            for (let j = 0; j < dataset.data.ncols; j++) {
                const idx = 18 * (dataset.data.ncols * i + j)

                const x0diff = (j === 0) ? dataset.x[j + 1] - dataset.x[j] : dataset.x[j] - dataset.x[j - 1]
                const x1diff = (j + 1 === dataset.data.ncols) ? dataset.x[j] - dataset.x[j - 1] : dataset.x[j + 1] - dataset.x[j]

                const y0diff = (i === 0) ? dataset.y[i + 1] - dataset.y[i] : dataset.y[i] - dataset.y[i - 1]
                const y1diff = (i + 1 === dataset.data.nrows) ? dataset.y[i] - dataset.y[i - 1] : dataset.y[i + 1] - dataset.y[i]

                const x0 = dataset.x[j] - x0diff / 2
                const x1 = dataset.x[j] + x1diff / 2
                const y0 = dataset.y[i] - y0diff / 2
                const y1 = dataset.y[i] + y1diff / 2
                const z = (dataset.data.get(i, j) - zmin) / (zmax - zmin)

                // first triangle

                vertices[idx] = x0
                vertices[idx + 1] = y0
                vertices[idx + 2] = z

                vertices[idx + 3] = x1
                vertices[idx + 4] = y0
                vertices[idx + 5] = z

                vertices[idx + 6] = x0
                vertices[idx + 7] = y1
                vertices[idx + 8] = z

                // second triangle

                vertices[idx + 9] = x1
                vertices[idx + 10] = y0
                vertices[idx + 11] = z

                vertices[idx + 12] = x0
                vertices[idx + 13] = y1
                vertices[idx + 14] = z

                vertices[idx + 15] = x1
                vertices[idx + 16] = y1
                vertices[idx + 17] = z
            }
        }

        var vertBuffer = this.glctx.createBuffer() as WebGLBuffer;
        this.glctx.bindBuffer(this.glctx.ARRAY_BUFFER, vertBuffer);
		this.glctx.bufferData(this.glctx.ARRAY_BUFFER, vertices as ArrayBuffer, this.glctx.STATIC_DRAW);

        // var texture = this.glctx.createTexture() as WebGLTexture
        // this.glctx.bindTexture(this.glctx.TEXTURE_2D, texture);

        // this.glctx.texParameteri(this.glctx.TEXTURE_2D, this.glctx.TEXTURE_WRAP_S, this.glctx.CLAMP_TO_EDGE);
        // this.glctx.texParameteri(this.glctx.TEXTURE_2D, this.glctx.TEXTURE_WRAP_T, this.glctx.CLAMP_TO_EDGE);
        // this.glctx.texParameteri(this.glctx.TEXTURE_2D, this.glctx.TEXTURE_MIN_FILTER, this.glctx.NEAREST);
        // this.glctx.texParameteri(this.glctx.TEXTURE_2D, this.glctx.TEXTURE_MAG_FILTER, this.glctx.NEAREST);

        // this.glctx.getExtension('OES_texture_float')

        // // this.glctx.pixelStorei(this.glctx.UNPACK_ALIGNMENT, 4);

        // this.glctx.texImage2D(this.glctx.TEXTURE_2D, 0, this.glctx.LUMINANCE, dataset.x.length, dataset.y.length, 
        //     0, this.glctx.LUMINANCE, this.glctx.FLOAT, dataset.data)

        console.log(vertices)
        

        return {
            vertBuffer,
            vertices,
            dataset
        }
    }

    public drawHeatMap(heatmap: IHeatmapPlot, umatrix: number[] | Float32Array) {

       if (!this.heatMapProgram)
           throw Error("HeatMap program is not instantiated.")

       this.glctx.useProgram(this.heatMapProgram.program);

       const numComponents = 3; // pull out 2 values per iteration
       const type = this.glctx.FLOAT; // the data in the buffer is 32bit floats
       const normalize = false; // don't normalize
       const stride = 0; // how many bytes to get from one set of values to the next
       // 0 = use type and numComponents above
       const offset = 0; // how many bytes inside the buffer to start from

       // link buffer to plot the data from it

       this.glctx.bindBuffer(this.glctx.ARRAY_BUFFER, heatmap.vertBuffer);
       this.glctx.vertexAttribPointer(this.heatMapProgram.attribLocations.a_vertCoord, numComponents, type, normalize, stride, offset);
       this.glctx.enableVertexAttribArray(this.heatMapProgram.attribLocations.a_vertCoord);

       // assign uniforms

       this.glctx.uniformMatrix3fv(this.heatMapProgram.uniformLocations.u_matrix, false, umatrix);


    //    this.glctx.uniform2f(this.heatMapProgram.uniformLocations.u_xrange, heatmap.dataset.x[0], heatmap.dataset.x[heatmap.dataset.x.length - 1]); // width, height
    //    this.glctx.uniform2f(this.heatMapProgram.uniformLocations.u_yrange, heatmap.dataset.y[0], heatmap.dataset.y[heatmap.dataset.y.length - 1]); // width, height

    //    this.glctx.bindTexture(this.glctx.TEXTURE_2D, heatmap.texture);

       // draw arrays

       this.glctx.disable(this.glctx.CULL_FACE); // front and back sides will be visible
       this.glctx.drawArrays(this.glctx.TRIANGLES, 0, heatmap.vertices.length / 3);
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
        this.glctx.vertexAttribPointer(this.thinLineProgram.attribLocations.a_coordinates, numComponents, type, normalize, stride, offset);
		this.glctx.enableVertexAttribArray(this.thinLineProgram.attribLocations.a_coordinates);

        // assign uniforms

        this.glctx.uniformMatrix3fv(this.thinLineProgram.uniformLocations.u_matrix, false, umatrix);

        this.glctx.uniform4fv(
            this.thinLineProgram.uniformLocations.u_color, 
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

        this.glctx.uniform2iv(this.thinLineProgram.uniformLocations.u_scale, [getIntScale(xscale), getIntScale(yscale)]);
        this.glctx.uniform2fv(this.thinLineProgram.uniformLocations.u_linscale, [xlinscale, ylinscale]);
        this.glctx.uniform2fv(this.thinLineProgram.uniformLocations.u_linthresh, [xlinthresh, ylinthresh]);

        // draw arrays

        this.glctx.drawArrays(this.glctx.LINE_STRIP, 0, line.x.length);

        // console.log("draw arrays called")

    }

    private initHeatmapProgram() {
        const vertCode = `
        attribute vec3 a_vertCoord;
        uniform mat3 u_matrix;
        varying vec3 v_vertCoord;
        
        void main(void) {
            v_vertCoord = a_vertCoord;
            gl_Position = vec4(u_matrix * vec3(a_vertCoord.xy, 1.0), 1.0);
        }`;
    
        const fragCode = `
        precision mediump float;
        // uniform sampler2D u_image;
        varying vec3 v_vertCoord;

        ${jetColorMap}

        // float range(float vmin, float vmax, float value) {
        //     return (value - vmin) / (vmax - vmin);
        // }

        // vec2 range(vec2 xrange, vec2 yrange, vec2 value) {
        //     vec2 vmin = vec2(xrange[0], yrange[0]);
        //     vec2 vmax = vec2(xrange[1], yrange[1]);

        //     return (value - vmin) / (vmax - vmin);
        // }

        void main(void) {
            // float x = texture2D(u_image, range(u_xrange, u_yrange, v_texCoord)).x;

            gl_FragColor = jet(v_vertCoord.z);

            // gl_FragColor = vec4(0.3, 0.3, 0.3, 1.0);


        }`;

        const program = this.initProgram(vertCode, fragCode)

        if (!program)
            return

        this.heatMapProgram = {
            program: program,
            attribLocations: {
                a_vertCoord: this.glctx.getAttribLocation(program, "a_vertCoord")
            },
            uniformLocations: {
                u_matrix: this.glctx.getUniformLocation(program, "u_matrix")!,
                // u_image: this.glctx.getUniformLocation(program, "u_image")!,
                // u_xvals: this.glctx.getUniformLocation(program, "u_xvals")!,
                // u_yvals: this.glctx.getUniformLocation(program, "u_yvals")!,
            }
        }
    }

    private initThinLineProgram() {
        const vertCode = `
        attribute vec2 a_coordinates;
        uniform mat3 u_matrix;
        uniform ivec2 u_scale; // [xscale, yscale]
        uniform vec2 u_linscale;  // [x, y]
        uniform vec2 u_linthresh;  // [x, y]

        ${tranformFunction} // tr
        
        void main(void) {
            vec3 coor = vec3(tr(u_scale.x, a_coordinates.x, u_linscale.x, u_linthresh.x), tr(u_scale.y, a_coordinates.y, u_linscale.y, u_linthresh.y), 1.0);

            gl_Position = vec4(u_matrix * coor, 1.0);
        }`;
    
        const fragCode = `
        precision mediump float;
        uniform highp vec4 u_color;
        void main(void) {
            gl_FragColor =  u_color;
        }`;

        const program = this.initProgram(vertCode, fragCode)

        if (!program)
            return

        this.thinLineProgram = {
            program: program,
            attribLocations: {
                a_coordinates: this.glctx.getAttribLocation(program, "a_coordinates")
            },
            uniformLocations: {
                u_matrix: this.glctx.getUniformLocation(program, "u_matrix")!,
                u_color: this.glctx.getUniformLocation(program, "u_color")!,
                u_scale: this.glctx.getUniformLocation(program, "u_scale")!,
                u_linscale: this.glctx.getUniformLocation(program, "u_linscale")!,
                u_linthresh: this.glctx.getUniformLocation(program, "u_linthresh")!,
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

