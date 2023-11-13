
import { DraggableLines, GraphicObject, IPaintEvent, Orientation } from "./object";
import { Rect, NumberArray, Point, Margin, Matrix } from "./types";
import { backgroundColor, fontSizeLabels, fontSizeNumbers, frameColor, textColor } from "./settings";
import { Dataset, formatNumber } from "./utils";
import { Colormap, IColorMap } from "./colormap";

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
    dataset: Dataset,
    colormap: IColorMap,
    iData: ImageData,
    imageBitmap: ImageBitmap | null
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

    public xRangeLinks: Figure[] = [];
    public yRangeLinks: Figure[] = [];

    private lastMouseDownPos: Point;
    private lastRange: Rect;

    private panning: boolean = false;
    private scaling: boolean = false;
    private lastCenterPoint: Point;
    public figureRect: Rect;
    private _preventMouseEvents: boolean = false;

    private plotCanvasRect = false;

    private offScreenCanvas: OffscreenCanvas;
    private offScreenCanvasCtx: OffscreenCanvasRenderingContext2D | null = null;

    public draggableLines: DraggableLines | null = null;

    constructor(parent: GraphicObject, canvasRect?: Rect, margin?: Margin) {
        super(parent, canvasRect, margin) ;

        this.margin = {
            left: 60,
            right: 60,
            top: 30,
            bottom: 30
        };
        this.range = {x: -1, y: -1, w: 2, h: 2};
        this.steps = NumberArray.fromArray([1, 2, 2.5, 5]);
        this.lastMouseDownPos = {x: 0, y: 0};
        this.lastRange = {...this.range};
        this.figureRect = this.getFigureRect();

        this.figureSettings.xAxis.viewBounds = [-1e5, 1e5];
        this.figureSettings.yAxis.viewBounds = [-1e5, 1e5];
        this.lastCenterPoint = {x: 0, y: 0};
        this.offScreenCanvas = new OffscreenCanvas(10, 10);
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

    public linkXRange(figure: Figure) {
        if (figure === this) {
            return;
        }

        figure.xRangeLinks.push(this);
        this.xRangeLinks.push(figure);
    }

    public linkYRange(figure: Figure) {
        if (figure === this) {
            return;
        }

        figure.yRangeLinks.push(this);
        this.yRangeLinks.push(figure);
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

    public preventMouseEvents(prevent: boolean) {
        this._preventMouseEvents = prevent;
    }

    public mouseDown(e: MouseEvent): void {
        if (!this.canvas)
            return;

        let [x, y] = [e.offsetX, e.offsetY];
        this.figureRect = this.getFigureRect();

        // we are outside of figure frame
        if (!this.isInsideFigureRect(x, y))
            return;

        if (this._preventMouseEvents) {
            super.mouseDown(e);
            return;
        }

        this.scaling = e.button == 2;
        this.panning = e.button == 0 || e.button == 1;

        this.lastMouseDownPos = {x: x, y: y};
        this.lastRange = {...this.range};
        
        this.lastCenterPoint = this.mapCanvas2Range(this.lastMouseDownPos);

        if (this.panning || this.scaling) {
            this.canvas.style.cursor = this.cursors.move;
        } else {
            super.mouseDown(e);
        }
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

    public mouseMove(e: MouseEvent): void {
        if (!this.canvas)
            return

        if (this._preventMouseEvents) {
            super.mouseMove(e);
            return;
        }

        if (this.isInsideFigureRect(e.offsetX, e.offsetY))
            this.canvas.style.cursor = this.cursors.crosshair;

        let dist: Point = {
            x: e.offsetX - this.lastMouseDownPos.x,
            y: e.offsetY - this.lastMouseDownPos.y
        }

        let rangeChanged = false;

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
            rangeChanged = true;
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
            rangeChanged = true;
        }

        if (rangeChanged){
            for (const fig of this.xRangeLinks) {
                fig.range.x = this.range.x;
                fig.range.w = this.range.w;
                fig.repaint();
            }
            for (const fig of this.yRangeLinks) {
                fig.range.y = this.range.y;
                fig.range.h = this.range.h;
                fig.repaint();
            }

            if (this.draggableLines) {
                if (this.draggableLines.position.x < this.range.x)
                    this.draggableLines.position.x = this.range.x;

                if (this.draggableLines.position.y < this.range.y)
                    this.draggableLines.position.y = this.range.y;

                if (this.draggableLines.position.x > this.range.x + this.range.w)
                    this.draggableLines.position.x = this.range.x + this.range.w;

                if (this.draggableLines.position.y > this.range.y + this.range.h)
                    this.draggableLines.position.y = this.range.y + this.range.h;

            }

            this.repaint();
        }

        // for handling hovering
        if (!this.panning && !this.scaling) {
            super.mouseMove(e);
        }

    }

    mouseUp(e: MouseEvent): void {
        if (this._preventMouseEvents) {
            super.mouseUp(e);
            return;
        }

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
    }

    public addDraggableLines(orientation: Orientation) {
        this.draggableLines = new DraggableLines(this, orientation)
        this.items.push(this.draggableLines);
    }

    public plotLine(x: NumberArray, y: NumberArray, color = "black", ls = "-", lw = 1, zValue = 10) {
        var plot: ILinePlot = {x: x.copy(), y: y.copy(), color, ls, lw, zValue}; 
        this.linePlots.push(plot);
        this.repaint();
        return plot;
    }

    private recalculateHeatMapImage(){
        if (!this.heatmap || !this.offScreenCanvas || !this.offScreenCanvasCtx) {
            return;
        }

        let iData = this.heatmap.iData;
        let m = this.heatmap.dataset.data;

        let extreme = Math.max(Math.abs(m.min()), Math.abs(m.max()));

        let zmin = - extreme;
        let zmax = + extreme;
        let diff = zmax - zmin; 

        // C-contiguous buffer
        for(let row = 0; row < iData.height; row++) {
            for(let col = 0; col < iData.width; col++) {
                let pos = (row * iData.width + col) * 4;        // position in buffer based on x and y
                
                let z = m.get(iData.height - row - 1, col);  // inverted y axis
                // console.log('row', row, 'col', col, z, m.isCContiguous);

                let zScaled = (z - zmin) / diff; 
                // interpolate the rgba values
                // console.log(zScaled);

                let rgba = Colormap.getColor(zScaled, this.heatmap.colormap);

                iData.data[pos] = rgba[0];              // some R value [0, 255]
                iData.data[pos+1] = rgba[1];              // some G value
                iData.data[pos+2] = rgba[2];              // some B value
                iData.data[pos+3] = rgba[3];                  // set alpha channel
            }
        }

        this.offScreenCanvasCtx.putImageData(iData, 0, 0);
        this.heatmap.imageBitmap = this.offScreenCanvas.transferToImageBitmap();
        // console.log('off screen canvas redrawn');
    }

    public plotHeatmap(dataset: Dataset, colormap: IColorMap = Colormap.symgrad ): IHeatMap | null {
        let data = dataset.data;

        if (data.ncols !== dataset.x.length || data.nrows !== dataset.y.length) {
            throw TypeError("Dimensions are not aligned with x and y arrays.");
        }
        
        // https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
        this.offScreenCanvas = new OffscreenCanvas(dataset.x.length, dataset.y.length);
        this.offScreenCanvasCtx = this.offScreenCanvas.getContext('2d');
        
        if(!this.offScreenCanvasCtx) {
            return null;
        }
        
        const iData = new ImageData(dataset.x.length, dataset.y.length);
        this.heatmap = {dataset, colormap, iData, imageBitmap: null};

        this.recalculateHeatMapImage();

        this.repaint();
        return this.heatmap;
    }

    public removePlot(plot: ILinePlot){
        let i = this.linePlots.indexOf(plot);
        if (i > -1) {
            this.linePlots.splice(i, 0);
        }
    }

    private paintHeatMap(e: IPaintEvent){
        if (!this.heatmap || !this.heatmap.imageBitmap) {
            return;
        }

        e.ctx.imageSmoothingEnabled = false;

        let x = this.heatmap.dataset.x;
        let y = this.heatmap.dataset.y;

        // for evenly spaced data
        let xdiff = x[1] - x[0];
        let ydiff = y[1] - y[0];

        let p0 = this.mapRange2Canvas({x: x[0] - xdiff / 2, y: y[0] - ydiff / 2});
        let p1 = this.mapRange2Canvas({x: x[x.length - 1] + xdiff / 2, y: y[y.length - 1] + ydiff / 2});


        e.ctx.drawImage(this.heatmap.imageBitmap, 
        0, 0, this.heatmap.iData.width, this.heatmap.iData.height,
        p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
        
        console.log('Heatmap paint');

    }

    private paintPlots(e: IPaintEvent) {
        // console.time('paintPlots');

        // for (const plot of this.linePlots) {

        //     // transform the data to canvas coordinates
        //     let [x, y] = this.mapRange2CanvasArr(plot.x, plot.y);

        //     e.ctx.beginPath();
        //     e.ctx.moveTo(x[0], y[0]);

        //     for (let i = 1; i < plot.x.length; i++) {
        //         e.ctx.lineTo(x[i], y[i]);
        //     }
        //     // this.ctx.closePath();  // will do another line from the end point to starting point
        //     e.ctx.strokeStyle = plot.color;
        //     e.ctx.lineWidth = plot.lw;
        //     e.ctx.stroke();
        // }

        e.ctx.save();

        // the speed was almost the same as for the above case
        for (const plot of this.linePlots) {

            e.ctx.beginPath();
            let p0 = this.mapRange2Canvas({x: plot.x[0], y: plot.y[0]})
            e.ctx.moveTo(p0.x, p0.y);

            for (let i = 1; i < plot.x.length; i++) {
                let p = this.mapRange2Canvas({x: plot.x[i], y: plot.y[i]})
                e.ctx.lineTo(p.x, p.y);
            }
            e.ctx.strokeStyle = plot.color;
            e.ctx.lineWidth = plot.lw;
            e.ctx.stroke();
        }

        e.ctx.restore();

        // console.timeEnd('paintPlots');


    }

    paint(e: IPaintEvent): void {
        // plot rectangle

        e.ctx.save();

        // clip to canvas rectangle

        e.ctx.fillStyle = backgroundColor;
        e.ctx.fillRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);

        e.ctx.strokeStyle = frameColor;

        if (this.plotCanvasRect){
            e.ctx.setLineDash([4, 2]);
            e.ctx.strokeRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
            e.ctx.setLineDash([]);
        }

        // this.ctx.restore();

        // this.ctx.save();

        // this.ctx.rect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
        // this.ctx.clip();


        // paint everything inside the plot
        this.figureRect = this.getFigureRect();

        //plot content
        e.ctx.rect(this.figureRect.x, this.figureRect.y, this.figureRect.w, this.figureRect.h);
        e.ctx.clip();

        this.paintHeatMap(e);
        this.paintPlots(e);

        // paint all additional graphics objects if necessary
        super.paint(e);
        // if (this.dragableLines){
        //     this.dragableLines.paint(e);
        // }
        
        e.ctx.restore();
        
        // draw figure rectangle
        e.ctx.strokeRect(this.figureRect.x, this.figureRect.y, this.figureRect.w, this.figureRect.h);
        this.drawTicks(e);

        // this.ctx.restore();

        // this.ctx.save();


    }

    public drawTicks(e: IPaintEvent){  // r is Figure Rectangle, the frame
        e.ctx.fillStyle = textColor;

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

        e.ctx.textAlign = 'center';
        e.ctx.beginPath();
        for (const xtick of xticks) {
            let p = this.mapRange2Canvas({x:xtick, y: 0});

            if (this.figureSettings.showTicks.includes('bottom')){
                e.ctx.moveTo(p.x, r.y + r.h);
                e.ctx.lineTo(p.x, r.y + r.h + tickSize);
            }

            if (this.figureSettings.showTicks.includes('top')){
                e.ctx.moveTo(p.x, r.y);
                e.ctx.lineTo(p.x, r.y - tickSize);
            }

            if (this.figureSettings.showTickNumbers.includes('bottom')){
                e.ctx.fillText(`${formatNumber(xtick, xFigures)}`, p.x, r.y + r.h + tickSize + xtextOffsetBottom);
            }

            if (this.figureSettings.showTickNumbers.includes('top')){
                e.ctx.fillText(`${formatNumber(xtick, xFigures)}`, p.x, r.y - tickSize - xtextOffsetTop);
            }
        }
        e.ctx.stroke();
    
        // draw y ticks

        e.ctx.beginPath();
        for (const ytick of yticks) {
            let p = this.mapRange2Canvas({x:0, y: ytick});

            if (this.figureSettings.showTicks.includes('left')){
                e.ctx.moveTo(r.x, p.y);
                e.ctx.lineTo(r.x - tickSize, p.y);
            }

            if (this.figureSettings.showTicks.includes('right')){
                e.ctx.moveTo(r.x + r.w, p.y);
                e.ctx.lineTo(r.x + r.w + tickSize, p.y);
            }

            if (this.figureSettings.showTickNumbers.includes('left')){
                e.ctx.textAlign = 'right';
                e.ctx.fillText(`${formatNumber(ytick, yFigures)}`, r.x - tickSize - ytextOffset, p.y + 3);
            }

            if (this.figureSettings.showTickNumbers.includes('right')){
                e.ctx.textAlign = 'left';
                e.ctx.fillText(`${formatNumber(ytick, yFigures)}`, r.x + r.w + tickSize + ytextOffset, p.y + 3);
            }
        }
        e.ctx.stroke();
    
    }

    genMajorTicks(coor: number, size: number){
        // calculate scale
        var scale = 10 ** Math.trunc(Math.log10(Math.abs(size)));
    
        var extStepsScaled = NumberArray.fromArray([
            ...NumberArray.mul(this.steps, 0.01 * scale), 
            ...NumberArray.mul(this.steps, 0.1 * scale), 
            ...NumberArray.mul(this.steps, scale)]);
    
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