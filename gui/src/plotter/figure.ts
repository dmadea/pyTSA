
import { GraphicObject } from "./object";
import { Rect, NumberArray, Point, Margin, Matrix } from "./types";
import { backgroundColor, fontSizeLabels, fontSizeNumbers, frameColor, textColor } from "./settings";
import { formatNumber } from "./utils";

interface IFigureSettings {
    xAxis: {
        label: string,
        scale: string,  // lin, log, symlog, noscale - scale is determined from the data
        viewBounds: number[]   // bounds of view or [x0, x1]
    },
    yAxis: {
        label: string,
        scale: string,  // lin, log, symlog, noscale
        viewBounds: number[]   // bounds of view or [x0, x1]
    },
    title: string,
    showTicks: string[],        // ['top', 'bottom', 'left', 'right']
    showTickNumbers: string[],  // ['top', 'bottom', 'left', 'right']
    axisAlignment: string,   // // could be vertical

}

interface ILinePlot {
    x: NumberArray,
    y: NumberArray,
    color: string,
    ls: string,  // line style
    lw: number,  // line width
    zValue: number
}

interface IHeatMap {
    x: NumberArray,
    y: NumberArray,
    data: Matrix,
    colormap: string,
    iData: ImageData
}

export class Figure extends GraphicObject {

    public range: Rect;
    public steps: NumberArray; 
    public prefferedNBins = 5;
    // public display

    public figureSettings: IFigureSettings = {
        xAxis: {
            label: '',
            scale: 'lin', 
            viewBounds: [-Number.MAX_VALUE, Number.MAX_VALUE]
        },
        yAxis: {
            label: '',
            scale: 'lin',
            viewBounds: [-Number.MAX_VALUE, Number.MAX_VALUE]
        },
        title: '',
        showTicks: ['left', 'right', 'bottom', 'top'],        // ['top', 'bottom', 'left', 'right']
        showTickNumbers: ['left', 'right', 'bottom', 'top'],  // ['top', 'bottom', 'left', 'right']
        axisAlignment: 'horizontal',   // could be vertical
    }

    private linePlots: Array<ILinePlot> = [];
    private heatmap: IHeatMap | null = null;

    private lastMouseDownPos: Point;
    private lastRange: Rect;

    private panning: boolean = false;
    private scaling: boolean = false;
    private lastCenterPoint: Point;
    private figureRect: Rect;

    private plotCanvasRect = false;

    private offScreenCanvas: OffscreenCanvas;
    private offScreenCanvasCtx: OffscreenCanvasRenderingContext2D | null = null;

    constructor(parent: GraphicObject, canvasRect?: Rect, margin?: Margin) {
        super(parent, canvasRect, margin) ;

        this.margin = {
            left: 60,
            right: 60,
            top: 30,
            bottom: 30
        };
        this.range = {x: -1, y: -1, w: 2, h: 2};
        this.steps = new NumberArray(1, 2, 2.5, 5);
        this.lastMouseDownPos = {x: 0, y: 0};
        this.lastRange = {...this.range};
        this.figureRect = this.getFigureRect();

        this.figureSettings.xAxis.viewBounds = [-1e5, 1e5];
        this.figureSettings.yAxis.viewBounds = [-1e5, 1e5];
        this.lastCenterPoint = {x: 0, y: 0};
        this.offScreenCanvas = new OffscreenCanvas(10, 10);
        // this.offScreenCanvasCtx = this.offScreenCanvas.getContext('2d');
    }

    public mapCanvas2Range(p: Point): Point{
        let r = this.figureRect;
        let xScaled = (p.x - r.x) / r.w;
        let yScaled = (p.y - r.y) / r.h;

        return {
            x: this.range.x + xScaled * this.range.w,
            y: this.range.y + (1 - yScaled) * this.range.h // inverted y axis
        }
    }

    public mapRange2Canvas(p: Point): Point{
        // rewrite for vertical-aligned axis
        let r = this.figureRect;
        let xScaled = (p.x - this.range.x) / this.range.w;
        let yScaled = (p.y - this.range.y) / this.range.h;

        return {
            x: r.x + xScaled * r.w,
            y: r.y + (1 - yScaled) * r.h  // inverted y axis
        }
    }

    public mapRange2CanvasArr(xvals: NumberArray, yvals: NumberArray): [NumberArray, NumberArray]{
        if (xvals.length !== yvals.length){
            throw TypeError("Different length of input arrays");
        }
        var newX = new NumberArray(xvals.length)
        var newY = new NumberArray(xvals.length);
        let r = this.figureRect;

        for (let i = 0; i < xvals.length; i++) {
            let xScaled = (xvals[i] - this.range.x) / this.range.w;
            let yScaled = (yvals[i] - this.range.y) / this.range.h;

            newX[i] = r.x + xScaled * r.w;
            newY[i] = r.y + (1 - yScaled) * r.h;
        }
        return [newX, newY];
    }

    // gets the canvas Rect of the figure frame
    private getFigureRect(): Rect{
        let x = this.canvasRect.x + this.margin.left;
        let y = this.canvasRect.y + this.margin.top;
        return {
            x: x,
            y: y,
            w: this.canvasRect.w - this.margin.right - this.margin.left,
            h: this.canvasRect.h - this.margin.bottom - this.margin.top
        }
    }

    private isInsideFigureRect(x: number, y: number): boolean
    {
        // we are outside of figure frame
        if (x < this.figureRect.x || x > this.figureRect.x + this.figureRect.w || 
            y < this.figureRect.y || y > this.figureRect.y + this.figureRect.h) {
            return false;
        }
        return true;
    }
    mouseDown(e: MouseEvent): void {
        if (!this.canvas)
            return;

        let [x, y] = [e.offsetX, e.offsetY];
        this.figureRect = this.getFigureRect();

        // we are outside of figure frame
        if (!this.isInsideFigureRect(x, y))
            return

        this.scaling = e.button == 2;
        this.panning = e.button == 0 || e.button == 1;

        if (this.panning || this.scaling)
            this.canvas.style.cursor = this.cursors.move;
        
        this.lastMouseDownPos = {x: x, y: y};
        this.lastRange = {...this.range};

        this.lastCenterPoint = this.mapCanvas2Range(this.lastMouseDownPos);
    }

    private getBoundedRange(rect: Rect, dontZoom: boolean): Rect {
        var x0 = Math.max(rect.x, this.figureSettings.xAxis.viewBounds[0]);
        var y0 = Math.max(rect.y, this.figureSettings.yAxis.viewBounds[0]);
        var x1 = Math.min(rect.x + rect.w, this.figureSettings.xAxis.viewBounds[1])
        var y1 = Math.min(rect.y + rect.h, this.figureSettings.yAxis.viewBounds[1])

        var retRect: Rect = {
            x: x0,
            y: y0,
            w: x1 - x0,
            h: y1 - y0
        }

        if (dontZoom){
            if (x0 === this.figureSettings.xAxis.viewBounds[0]){
                retRect.w = rect.w;
            }
            if (x1 === this.figureSettings.xAxis.viewBounds[1]){
                retRect.w = rect.w;
                retRect.x = x1 - rect.w;
            }
            if (y0 === this.figureSettings.yAxis.viewBounds[0]){
                retRect.h = rect.h;
            }
            if (y1 === this.figureSettings.yAxis.viewBounds[1]){
                retRect.h = rect.h;
                retRect.y = y1 - rect.h;
            }
        }

        return retRect;
    }

    mouseMove(e: MouseEvent): void {
        if (!this.canvas)
            return

        if (this.isInsideFigureRect(e.offsetX, e.offsetY))
            this.canvas.style.cursor = this.cursors.crosshair;

        let dist: Point = {
            x: e.offsetX - this.lastMouseDownPos.x,
            y: e.offsetY - this.lastMouseDownPos.y
        }
        
        if (this.panning){
            this.canvas.style.cursor = this.cursors.move;

            let xRatio = this.lastRange.w / this.figureRect.w;
            let yRatio = this.lastRange.h / this.figureRect.h;

            let newRect: Rect = {
                x: this.lastRange.x - dist.x * xRatio, 
                y: this.lastRange.y + dist.y * yRatio,
                w: this.lastRange.w,
                h: this.lastRange.h
            };

            this.range = this.getBoundedRange(newRect, true);
            this.paint();
        }
        // analogous as in pyqtgraph
        // https://github.com/pyqtgraph/pyqtgraph/blob/7ab6fa3d2fb6832b624541b58eefc52c0dfb4b08/pyqtgraph/widgets/GraphicsView.py
        if (this.scaling){
            this.canvas.style.cursor = this.cursors.move;

            let xZoom = 1.01 ** dist.x;
            let yZoom = 1.01 ** dist.y;

            let newRect: Rect = {
                x: this.lastCenterPoint.x - (this.lastCenterPoint.x - this.lastRange.x) / xZoom, 
                y: this.lastCenterPoint.y - (this.lastCenterPoint.y - this.lastRange.y) * yZoom,
                w: this.lastRange.w / xZoom,
                h: this.lastRange.h * yZoom
            };

            this.range = this.getBoundedRange(newRect, false);
            this.paint();
        }

    }

    mouseUp(e: MouseEvent): void {
        switch(e.button) {
            case 0: 
                this.panning = false;
            
            case 1: 
                this.panning = false;

            case 2: 
                this.scaling = false
        }

        if (this.canvas)
            this.canvas.style.cursor = this.cursors.crosshair;

        // console.log(this.scaling, this.panning); 
    }

    public plotLine(x: NumberArray, y: NumberArray, color = "black", ls = "-", lw = 1, zValue = 10) {
        var plot: ILinePlot = {x: x.copy(), y: y.copy(), color, ls, lw, zValue}; 
        this.linePlots.push(plot);
        this.paint();
        return plot;
    }

    public plotHeatmap(data: Matrix, x: NumberArray, y: NumberArray, colormap: string = "Femto"): IHeatMap | null {
        if (data.nrows !== x.length || data.ncols !== y.length) {
            throw TypeError("Dimensions are not aligned with x and y arrays.");
        }
        
        // https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
        this.offScreenCanvas = new OffscreenCanvas(x.length, y.length);
        this.offScreenCanvasCtx = this.offScreenCanvas.getContext('2d');
        
        if(!this.offScreenCanvasCtx) {
            return null;
        }
        
        const iData = new ImageData(x.length, y.length);

        console.log(iData.data);
        
        // fill the image buffer
        for(let i = 0; i < x.length; i++) {
            for(let j = 0; j < y.length; j++) {
                let pos = (i * x.length + j) * 4;        // position in buffer based on x and y
                iData.data[pos] = data.get(i, j);              // some R value [0, 255]
                iData.data[pos+1] = data.get(i, j);              // some G value
                iData.data[pos+2] = data.get(i, j);              // some B value
                iData.data[pos+3] = 50;                  // set alpha channel
            }
        }

        console.log(iData);

        // plot the buffer to offScreenCanvas
        this.offScreenCanvasCtx.clearRect(0, 0, iData.width, iData.height);
        this.offScreenCanvasCtx.fillStyle = 'black';
        this.offScreenCanvasCtx.fillRect(0, 0, iData.width, iData.height);
        // this.offScreenCanvasCtx.putImageData(iData, 0, 0);
        
        this.heatmap = {x, y, data, colormap, iData};
        this.paint();
        return this.heatmap;
    }

    public removePlot(plot: ILinePlot){
        let i = this.linePlots.indexOf(plot);
        if (i > -1) {
            this.linePlots.splice(i, 0);
        }
    }

    private paintHeatMap(){
        if (!this.ctx || !this.heatmap || !this.offScreenCanvasCtx){
            return;
        }

        this.ctx.imageSmoothingEnabled = false;

        // let b = this.offScreenCanvas.transferToImageBitmap();
        // console.log(b);

        let idata = this.heatmap.iData;

        // this.offScreenCanvasCtx.clearRect(0, 0, idata.width, idata.height);
        // this.offScreenCanvasCtx.fillStyle = 'red';
        // this.offScreenCanvasCtx.fillRect(0, 0, idata.width, idata.height);
        
        for(let i = 0; i < this.heatmap.x.length; i++) {
            for(let j = 0; j < this.heatmap.y.length; j++) {
                let pos = (i * this.heatmap.x.length + j) * 4;        // position in buffer based on x and y
                this.heatmap.iData.data[pos] = this.heatmap.data.get(i, j);              // some R value [0, 255]
                this.heatmap.iData.data[pos+1] = this.heatmap.data.get(i, j);              // some G value
                this.heatmap.iData.data[pos+2] = this.heatmap.data.get(i, j);              // some B value
                this.heatmap.iData.data[pos+3] = 255;                  // set alpha channel
            }
        }

        this.offScreenCanvasCtx.putImageData(this.heatmap.iData, 0, 0);

        
        let b = this.offScreenCanvas.transferToImageBitmap();
        // this.ctx.drawImage(b, 50, 50);

        // this.ctx.putImageData(this.heatmap.iData, this.figureRect.x, this.figureRect.y);

        // this.ctx.drawImage(b, 50, 50);


        this.ctx.drawImage(b, 
        0, 0, this.heatmap.iData.width, this.heatmap.iData.height,
        this.figureRect.x, this.figureRect.y, this.figureRect.w, this.figureRect.h);
        
        console.log('Heatmap paint');

    }

    private paintPlots() {
        if (!this.ctx){
            return;
        }
        
        // console.time('paintPlots');

        for (const plot of this.linePlots) {

            // transform the data to canvas coordinates
            let [x, y] = this.mapRange2CanvasArr(plot.x, plot.y);

            this.ctx.beginPath();
            this.ctx.moveTo(x[0], y[0]);

            for (let i = 1; i < plot.x.length; i++) {
                this.ctx.lineTo(x[i], y[i]);
            }
            // this.ctx.closePath();  // will do another line from the end point to starting point
            this.ctx.strokeStyle = plot.color;
            this.ctx.lineWidth = plot.lw;
            this.ctx.stroke();
        }

        // the speed was almost the same as for the above case
        // for (const plot of this.linePlots) {

        //     this.ctx.beginPath();
        //     let p0 = this.mapRange2Canvas({x: plot.x[0], y: plot.y[0]})
        //     this.ctx.moveTo(p0.x, p0.y);

        //     for (let i = 1; i < plot.x.length; i++) {
        //         let p = this.mapRange2Canvas({x: plot.x[i], y: plot.y[i]})
        //         this.ctx.lineTo(p.x, p.y);
        //     }
        //     this.ctx.strokeStyle = plot.color;
        //     this.ctx.lineWidth = plot.lw;
        //     this.ctx.stroke();
        // }

        this.ctx.restore();

        // console.timeEnd('paintPlots');


    }

    paint(): void {
        // plot rectangle
        if (!this.ctx){
            return;
        }

        this.ctx.save();

        // clip to canvas rectangle

        this.ctx.fillStyle = backgroundColor;
        this.ctx.fillRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);

        this.ctx.strokeStyle = frameColor;

        if (this.plotCanvasRect){
            this.ctx.setLineDash([4, 2]);
            this.ctx.strokeRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
            this.ctx.setLineDash([]);
        }

        // this.ctx.restore();

        // this.ctx.save();

        // this.ctx.rect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
        // this.ctx.clip();
        this.figureRect = this.getFigureRect();
        
        // draw figure rectangle
        this.ctx.strokeRect(this.figureRect.x, this.figureRect.y, this.figureRect.w, this.figureRect.h);
        this.drawTicks();

        // this.ctx.restore();

        // this.ctx.save();
        //plot content

        this.ctx.rect(this.figureRect.x, this.figureRect.y, this.figureRect.w, this.figureRect.h);
        this.ctx.clip();

        this.paintHeatMap();
        this.paintPlots();
        
        this.ctx.restore();

    }

    public drawTicks(){  // r is Figure Rectangle, the frame
        if (!this.ctx){
            return;
        }

        this.ctx.fillStyle = textColor;

        let xticks = this.genMajorTicks(this.range.x, this.range.w);
        let yticks = this.genMajorTicks(this.range.y, this.range.h);

        // estimate the number of significant figures to be plotted
        let xdiff = xticks[1] - xticks[0];
        let ydiff = yticks[1] - yticks[0];

        let xmax = Math.max(Math.abs(xticks[0]), Math.abs(xticks[xticks.length - 1]));
        let ymax = Math.max(Math.abs(yticks[0]), Math.abs(yticks[yticks.length - 1]));

        let xFigures = Math.ceil(Math.log10(xmax / xdiff)) + 1;
        let yFigures = Math.ceil(Math.log10(ymax / ydiff)) + 1;

        if (this.figureSettings.axisAlignment === 'vertical'){
            [xticks, yticks] = [yticks, xticks];  // swap the axes
        }
    
        let tickSize = 8;
        let xtextOffsetBottom = 10;
        let xtextOffsetTop = 5;
        let ytextOffset = 10;

        // draw x ticks

        let r = this.figureRect;

        this.ctx.textAlign = 'center';
        this.ctx.beginPath();
        for (const xtick of xticks) {
            let p = this.mapRange2Canvas({x:xtick, y: 0});

            if (this.figureSettings.showTicks.includes('bottom')){
                this.ctx.moveTo(p.x, r.y + r.h);
                this.ctx.lineTo(p.x, r.y + r.h + tickSize);
            }

            if (this.figureSettings.showTicks.includes('top')){
                this.ctx.moveTo(p.x, r.y);
                this.ctx.lineTo(p.x, r.y - tickSize);
            }

            if (this.figureSettings.showTickNumbers.includes('bottom')){
                this.ctx.fillText(`${formatNumber(xtick, xFigures)}`, p.x, r.y + r.h + tickSize + xtextOffsetBottom);
            }

            if (this.figureSettings.showTickNumbers.includes('top')){
                this.ctx.fillText(`${formatNumber(xtick, xFigures)}`, p.x, r.y - tickSize - xtextOffsetTop);
            }
        }
        this.ctx.stroke();
    
        // draw y ticks

        this.ctx.beginPath();
        for (const ytick of yticks) {
            let p = this.mapRange2Canvas({x:0, y: ytick});

            if (this.figureSettings.showTicks.includes('left')){
                this.ctx.moveTo(r.x, p.y);
                this.ctx.lineTo(r.x - tickSize, p.y);
            }

            if (this.figureSettings.showTicks.includes('right')){
                this.ctx.moveTo(r.x + r.w, p.y);
                this.ctx.lineTo(r.x + r.w + tickSize, p.y);
            }

            if (this.figureSettings.showTickNumbers.includes('left')){
                this.ctx.textAlign = 'right';
                this.ctx.fillText(`${formatNumber(ytick, yFigures)}`, r.x - tickSize - ytextOffset, p.y + 3);
            }

            if (this.figureSettings.showTickNumbers.includes('right')){
                this.ctx.textAlign = 'left';
                this.ctx.fillText(`${formatNumber(ytick, yFigures)}`, r.x + r.w + tickSize + ytextOffset, p.y + 3);
            }
        }
        this.ctx.stroke();
    
    }

    genMajorTicks(coor: number, size: number){
        // calculate scale
        var scale = 10 ** Math.trunc(Math.log10(Math.abs(size)));
    
        var extStepsScaled = new NumberArray(
            ...this.steps.mul(0.01 * scale, true), 
            ...this.steps.mul(0.1 * scale, true), 
            ...this.steps.mul(scale, true));
    
        let rawStep = size / this.prefferedNBins;
    
        //find the nearest value in the array
        let step = extStepsScaled.nearestValue(rawStep);
        let bestMin = Math.ceil(coor / step) * step;
    
        let nticks = 1 + (coor + size - bestMin) / step >> 0; // integer division
        var ticks = new NumberArray(nticks);
    
        // generate ticks
        for (let i = 0; i < nticks; i++) {
            ticks[i] = bestMin + step * i;
        }

        return ticks;
    }


}