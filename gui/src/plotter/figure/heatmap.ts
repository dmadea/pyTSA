import { Colormap, Colormaps, ILut } from "../color";
import { Figure } from "./figure";
import { NumberArray } from "../types";
import { Dataset, isclose } from "../utils";
import { IPaintEvent, Wasm } from "../object";

interface LutPtr {
    posPtr: number,
    lutPtr: number
}

export class HeatMap {

    private offScreenCanvas: OffscreenCanvas;
    private offScreenCanvasCtx: OffscreenCanvasRenderingContext2D | null;
    private imageData: ImageData;
    private figure: Figure;
    private _isXRegular: boolean;
    private _isYRegular: boolean;

    public dataset: Dataset;
    public colormap: Colormap;
    public zRange: [number | null, number | null] = [null, null];  // min, max
    public transform?: (zVal: number) => number;  // z trasform

    private dataPtr: number | null = null;
    private iDataPtr: number | null = null;
    private matrixBuf?: Float32Array;
    private lutPtr?: LutPtr; 

    get isXRegular() {
        return this._isXRegular;
    }

    get isYRegular() {
        return this._isYRegular;
    }

    constructor(figure: Figure, dataset: Dataset, colormap: Colormap) {
        let matrix = dataset.data;
        if (matrix.ncols !== dataset.x.length || matrix.nrows !== dataset.y.length) {
            throw TypeError("Dimensions are not aligned with x and y arrays.");
        }

        this.dataset = dataset;
        this.colormap = colormap;
        this.figure = figure;
        this._isXRegular = HeatMap.isRegularlySpaced(this.dataset.x);
        this._isYRegular = HeatMap.isRegularlySpaced(this.dataset.y);

        // console.log(this.isXRegular, this.isYRegular);

        // https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
        this.offScreenCanvas = new OffscreenCanvas(dataset.x.length, dataset.y.length);
        this.offScreenCanvasCtx = this.offScreenCanvas.getContext('2d');

        if(!this.offScreenCanvasCtx) {
            throw TypeError("OffScreenCanvas context is null.");
        }

        this.imageData = new ImageData(dataset.x.length, dataset.y.length);
        // this.imageBitmap = this.offScreenCanvas.transferToImageBitmap(); // just to trick compiler
        this.recalculateImage();
    }

    static isRegularlySpaced(arr: NumberArray): boolean {
        // from numpy https://github.com/numpy/numpy/blob/v1.26.0/numpy/core/numeric.py#L2249-L2371
        // check all differences of the array
        let avrgDiff = (arr[arr.length - 1] - arr[0]) / (arr.length - 1);
        let diffArr = NumberArray.diff(arr);
        for (let i = 0; i < diffArr.length; i++) {
            if (!isclose(diffArr[i], avrgDiff)) {
                return false;
            }
        }
        return true;
    }

    public width(): number {
        return this.imageData.width;
    }

    public height(): number {
        return this.imageData.height;
    }

    public getCanvas() {
        return this.offScreenCanvas;
    }

    // works also for different scales, but it is extremely slow
    public plot2mainCanvas(e: IPaintEvent, ){

        const r = this.figure.getEffectiveRect();
        const rng = this.figure.getInternalRange();

        const iData = new ImageData(r.w, r.h);

        const m = this.dataset.data;

        const zlim0 = (this.zRange[0] === null) ? m.min() : this.zRange[0];
        const zlim1 = (this.zRange[1] === null) ? m.max() : this.zRange[1];
        const limdiff = zlim1 - zlim0;

        const w = iData.width;
        const h = iData.height;

        const xT = this.figure.xAxis.getTransform();
        const yT = this.figure.yAxis.getTransform();

        // C-contiguous buffer
        for(let row = 0; row < h; row++) {
            for(let col = 0; col < w; col++) {
                const pos = (row * w + col) * 4;        // position in buffer based on x and y

                // y axis is inverted in default because of different coordinate system
                const rowIdx = this.figure.yAxis.inverted ? row : h - row - 1;
                const colIdx = this.figure.xAxis.inverted ? w - col - 1 : col;

                // map pixel position to actual coordinae
                let xrel = colIdx / (w - 1);
                let x = rng.x + xrel * rng.w;
                let yrel = rowIdx / (h - 1);
                let y = rng.y + yrel * rng.h;
                
                x = xT(x);
                y = yT(y);

                // find nearest indiced
                const xIdx = this.dataset.x.nearestIndex(x);
                const yIdx = this.dataset.y.nearestIndex(y);

                const z = m.get(yIdx, xIdx);
                // console.log('row', row, 'col', col, z, m.isCContiguous);
                const zrel = (this.transform) ? this.transform(z) : (z - zlim0) / limdiff; 

                const rgba = this.colormap.getColor(zrel);

                iData.data[pos] = rgba[0];              // some R value [0, 255]
                iData.data[pos+1] = rgba[1];              // some G value
                iData.data[pos+2] = rgba[2];              // some B value
                iData.data[pos+3] = rgba[3];                  // set alpha channel
            }
        }

        e.bottomCtx.putImageData(iData, r.x, r.y);
    }

    private recalcImageNative() {

        if (!this.offScreenCanvasCtx) {
            return;
        }

        console.time("recalcImageNative");


        const w = this.figure.wasm;

        if (!w) return;
        var view = new Uint8Array(w.memory.buffer);

        var malloc = w.exports._Z7_mallocm as CallableFunction;
        var free = w.exports._Z5_freePv as CallableFunction;
        var recalcNative = w.exports._Z16recalculateImagePhPfmmS0_S_mff as CallableFunction;
        // var getColor = w.exports._Z8getColorfPfPhmS0_ as CallableFunction;

        // float recalculateImage(const float * matrix, size_t rows, size_t cols, float * pos, unsigned char * lut, size_t nlut) {

        // copy data to wasm memory
        if (!this.dataPtr) {

            // console.time("copy data");

            const n = this.dataset.data.length;

            this.dataPtr = malloc(n * 4);
            this.matrixBuf = new Float32Array(w.memory.buffer, this.dataPtr as number, n)
            for (let i = 0; i < n; i++) {
                this.matrixBuf[i] = this.dataset.data[i];
            }

            this.iDataPtr = malloc(n * 4); // create an image data buffer
            this.imageData = new ImageData(new Uint8ClampedArray(w.memory.buffer, this.iDataPtr as number, n * 4),
             this.dataset.data.ncols,
              this.dataset.data.nrows)

            console.log(this.dataPtr, "data copied");
            // console.timeEnd("copy data");

        }

        if (this.lutPtr) {
            free(this.lutPtr.lutPtr);
            free(this.lutPtr.posPtr);
        }

        // copy lut to wasm memory
        const lutN = this.colormap.lut.length;
        this.lutPtr = {
            posPtr: malloc(lutN * 4),
            lutPtr: malloc(lutN * 4)
        }

        const [pos, data] = this.colormap.getLut2Wasm(w.memory.buffer, this.lutPtr.posPtr, this.lutPtr.lutPtr);

        // float recalculateImage(unsigned char * iData, float * matrix, size_t rows, size_t cols, float * pos, unsigned char * lut, size_t nlut) {

        recalcNative(this.iDataPtr, this.dataPtr, this.dataset.data.nrows, this.dataset.data.ncols, this.lutPtr.posPtr, this.lutPtr.lutPtr, lutN,
            this.zRange[0], this.zRange[1])

        this.offScreenCanvasCtx.putImageData(this.imageData, 0, 0);

        // console.log(pos, data, this.lutPtr,  "data copied");

        // var view = new Uint8Array(w.memory.buffer, this.lutPtr.posPtr);
        // console.log(view);
        // float recalculateImage(const float * matrix, size_t rows, size_t cols, float * pos, unsigned char * lut, size_t nlut) {
        // var val = recalcNative(this.dataPtr, this.dataset.data.nrows, this.dataset.data.ncols, this.lutPtr.posPtr, this.lutPtr.lutPtr, lutN);
        // console.log(val, "value from wasm", this.dataset.data.length);

        // void getColor(float position, float * pos, unsigned char * lut, size_t nlut, unsigned char * result) {
        // console.log(pos);
        // var ptr = malloc(4);
        // getColor(0.93, this.lutPtr.posPtr, this.lutPtr.lutPtr, lutN, ptr);
        // var arr = new Uint8Array(w.memory.buffer, ptr, 4);
        // console.log(arr);
        // free(ptr);

        console.timeEnd("recalcImageNative");
    }

    public recalculateImage(){
        if (!this.offScreenCanvasCtx) {
            return;
        }

        if (this.figure.wasm) {
            this.recalcImageNative();
            return;
        }

        console.time("recalculateImage");

        const m = this.dataset.data;

        const zlim0 = (this.zRange[0] === null) ? m.min() : this.zRange[0];
        const zlim1 = (this.zRange[1] === null) ? m.max() : this.zRange[1];
        const limdiff = zlim1 - zlim0;

        // if (!this.transform) {

        // }

        // const extreme = Math.max(Math.abs(m.min()), Math.abs(m.max()));

        const w = this.imageData.width;
        const h = this.imageData.height;

        // C-contiguous buffer
        for(let row = 0; row < h; row++) {
            for(let col = 0; col < w; col++) {
                const pos = (row * w + col) * 4;        // position in buffer based on x and y
                
                // y axis is inverted in default because of different coordinate system
                const rowIdx = this.figure.yAxis.inverted ? row : h - row - 1;
                const colIdx = this.figure.xAxis.inverted ? w - col - 1 : col;

                const z = m.get(rowIdx, colIdx);
                // console.log('row', row, 'col', col, z, m.isCContiguous);
                let zrel = (this.transform) ? this.transform(z) : (z - zlim0) / limdiff; 

                // interpolate the rgba values
                // console.log(zScaled);

                const rgba = this.colormap.getColor(zrel);

                this.imageData.data[pos] = rgba[0];              // some R value [0, 255]
                this.imageData.data[pos+1] = rgba[1];              // some G value
                this.imageData.data[pos+2] = rgba[2];              // some B value
                this.imageData.data[pos+3] = rgba[3];                  // set alpha channel
            }
        }

        console.timeEnd("recalculateImage");
        // console.time("putImageData");

        this.offScreenCanvasCtx.putImageData(this.imageData, 0, 0);
        // console.timeEnd("putImageData");

    }
}