import { F32Array } from "./array"
import { Color, Colormap, WEBGLColormaps } from "./color"
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
        u_scale: WebGLUniformLocation,
        u_linscale: WebGLUniformLocation,
        u_linthresh: WebGLUniformLocation,
        u_vlim: WebGLUniformLocation,
        u_colormap: WebGLUniformLocation,

        // u_image: WebGLUniformLocation,
        // u_xvals: WebGLUniformLocation,
        // u_yvals: WebGLUniformLocation,
    }
}


interface ColorbarProgram extends Program {
    attribLocations: {
        a_vertCoord: GLint
    },
    uniformLocations: {
        u_colormap: WebGLUniformLocation,
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

export class GLRenderer {

    public glctx: WebGLRenderingContext
    public thinLineProgram: ThinLineProgram | null = null
    public heatMapProgram: HeatMapProgram | null = null
    public colorbarProgram: ColorbarProgram | null = null
    private colorbarBuffer: WebGLBuffer | null = null
    

    constructor(glctx: WebGLRenderingContext) {
        this.glctx = glctx
        this.initWebGL()
    }


    private initWebGL () {

        this.initThinLineProgram();
        this.initHeatmapProgram();
        this.initColorbarProgram();
        this.createColorBar();
    
        // this.glctx.enable(this.glctx.BLEND);
        // this.glctx.blendFunc(this.glctx.SRC_ALPHA, this.glctx.ONE_MINUS_SRC_ALPHA);
    }

    private createColorBar() {
        const xy = new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            1, 1
        ])

        this.colorbarBuffer = this.glctx.createBuffer() as WebGLBuffer;
        this.glctx.bindBuffer(this.glctx.ARRAY_BUFFER, this.colorbarBuffer);
		this.glctx.bufferData(this.glctx.ARRAY_BUFFER, xy as ArrayBuffer, this.glctx.STATIC_DRAW);
    }

    public drawColorBar(colormap: Colormap) {
        if (!this.colorbarProgram)
            throw Error("Colorbar program is not instantiated.")
 
        this.glctx.useProgram(this.colorbarProgram.program);
 
        this.glctx.bindBuffer(this.glctx.ARRAY_BUFFER, this.colorbarBuffer);
        this.glctx.vertexAttribPointer(this.colorbarProgram.attribLocations.a_vertCoord, 2, this.glctx.FLOAT, false, 0, 0);
        this.glctx.enableVertexAttribArray(this.colorbarProgram.attribLocations.a_vertCoord);
 
        // assign uniforms
 
        this.glctx.uniform1i(this.colorbarProgram.uniformLocations.u_colormap, colormap.index);
 
        // draw arrays
 
        this.glctx.disable(this.glctx.CULL_FACE); // front and back sides will be visible
        this.glctx.drawArrays(this.glctx.TRIANGLE_STRIP, 0, 4);
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
                // const z = (dataset.data.get(i, j) - zmin) / (zmax - zmin)
                const z = dataset.data.get(i, j)

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

    public drawHeatMap(heatmap: IHeatmapPlot, umatrix: number[] | Float32Array, scale: [Scale, Scale, Scale],
        linthresh: [number, number, number], linscale: [number, number, number], vlim: [number, number], colormap: Colormap) {

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

       scale.map(s => GLRenderer.getIntScale(s))

       this.glctx.uniform3iv(this.heatMapProgram.uniformLocations.u_scale, scale.map(s => GLRenderer.getIntScale(s)));
       this.glctx.uniform3fv(this.heatMapProgram.uniformLocations.u_linscale, linscale);
       this.glctx.uniform3fv(this.heatMapProgram.uniformLocations.u_linthresh, linthresh);
       this.glctx.uniform2fv(this.heatMapProgram.uniformLocations.u_vlim, vlim);
       this.glctx.uniform1i(this.heatMapProgram.uniformLocations.u_colormap, colormap.index);


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

    private static getIntScale(scale: Scale): number
    {
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

        this.glctx.uniform2iv(this.thinLineProgram.uniformLocations.u_scale, [GLRenderer.getIntScale(xscale), GLRenderer.getIntScale(yscale)]);
        this.glctx.uniform2fv(this.thinLineProgram.uniformLocations.u_linscale, [xlinscale, ylinscale]);
        this.glctx.uniform2fv(this.thinLineProgram.uniformLocations.u_linthresh, [xlinthresh, ylinthresh]);

        // draw arrays

        this.glctx.drawArrays(this.glctx.LINE_STRIP, 0, line.x.length);

        // console.log("draw arrays called")

    }

    private initColorbarProgram() {
        const vertCode = `
        attribute vec2 a_vertCoord;
        varying vec2 v_vertCoord;
        
        void main(void) {
            v_vertCoord = a_vertCoord;
            gl_Position = vec4(a_vertCoord, 1.0, 1.0);
        }`;
    
        const fragCode = `
        precision mediump float;
        varying vec2 v_vertCoord;
        uniform int u_colormap;  // index of colormap to use

        ${WEBGLColormaps}

        void main(void) {
            float x = (v_vertCoord.y + 1.0) / 2.0;
            gl_FragColor = colormap(x, u_colormap);
        }`;

        const program = this.initProgram(vertCode, fragCode)

        if (!program)
            return

        this.colorbarProgram = {
            program: program,
            attribLocations: {
                a_vertCoord: this.glctx.getAttribLocation(program, "a_vertCoord")
            },
            uniformLocations: {
                u_colormap: this.glctx.getUniformLocation(program, "u_colormap")!,
            }
        }
    }

    private initHeatmapProgram() {
        const vertCode = `
        attribute vec3 a_vertCoord;
        
        uniform mat3 u_matrix;
        uniform ivec3 u_scale; // [xscale, yscale, zscale]
        uniform vec3 u_linscale;  // [x, y, z]
        uniform vec3 u_linthresh;  // [x, y, z]

        varying vec3 v_vertCoord;

        ${tranformFunction} // tr
        
        void main(void) {
            v_vertCoord = a_vertCoord;

            vec3 coor = vec3(tr(u_scale.x, a_vertCoord.x, u_linscale.x, u_linthresh.x), tr(u_scale.y, a_vertCoord.y, u_linscale.y, u_linthresh.y), 1.0);

            // gl_Position = vec4(u_matrix * vec3(a_vertCoord.xy, 1.0), 1.0);
            gl_Position = vec4(u_matrix * coor, 1.0);

        }`;
    
        const fragCode = `
        precision mediump float;
        // uniform sampler2D u_image;
        varying vec3 v_vertCoord;

        uniform vec2 u_vlim;  // [min, max]
        uniform int u_colormap;  // index of colormap to use

        uniform highp ivec3 u_scale; // [xscale, yscale, zscale]
        uniform highp vec3 u_linscale;  // [x, y, z]
        uniform highp vec3 u_linthresh;  // [x, y, z]

        ${WEBGLColormaps}
        ${tranformFunction} // tr

        float range(float vmin, float vmax, float value) {
            return (value - vmin) / (vmax - vmin);
        }

        // vec2 range(vec2 xrange, vec2 yrange, vec2 value) {
        //     vec2 vmin = vec2(xrange[0], yrange[0]);
        //     vec2 vmax = vec2(xrange[1], yrange[1]);

        //     return (value - vmin) / (vmax - vmin);
        // }

        void main(void) {
            // float x = texture2D(u_image, range(u_xrange, u_yrange, v_texCoord)).x;

            float trz = tr(u_scale.z, v_vertCoord.z, u_linscale.z, u_linthresh.z);

            float x = clamp(range(u_vlim[0], u_vlim[1], trz), 0.0, 1.0);

            gl_FragColor = colormap(x, u_colormap);

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
                u_scale: this.glctx.getUniformLocation(program, "u_scale")!,
                u_linscale: this.glctx.getUniformLocation(program, "u_linscale")!,
                u_linthresh: this.glctx.getUniformLocation(program, "u_linthresh")!,
                u_vlim: this.glctx.getUniformLocation(program, "u_vlim")!,
                u_colormap: this.glctx.getUniformLocation(program, "u_colormap")!,


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

