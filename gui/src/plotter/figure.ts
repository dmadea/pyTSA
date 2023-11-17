
import { DraggableLines, GraphicObject, IPaintEvent, Orientation } from "./object";
import { Rect, NumberArray, Point, Margin, Matrix } from "./types";
import { backgroundColor, fontSizeLabels, fontSizeNumbers, frameColor, textColor } from "./settings";
import { Dataset, formatNumber } from "./utils";
import { Colormap, IColorMap } from "./colormap";
import { HeatMap } from "./heatmap";

interface IFigureSettings {
    xAxis: {
        label: string,
        scale: string,  // lin, log, symlog, noscale - scale is determined from the data
        viewBounds: number[],   // bounds of view or [x0, x1]
        autoscale: boolean,
        inverted: boolean
    },
    yAxis: {
        label: string,
        scale: string,  // lin, log, symlog, noscale
        viewBounds: number[],   // bounds of view or [x0, x1]
        autoscale: boolean,
        inverted: boolean
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
    ld: number[],  // line dash, exmaple [4, 2], no dash: []
    lw: number,  // line width
    zValue: number
}

export class Figure extends GraphicObject {

    public figureSettings: IFigureSettings = {
        xAxis: {
            label: '',
            scale: 'lin', 
            viewBounds: [-Number.MAX_VALUE, Number.MAX_VALUE],
            autoscale: false,
            inverted: false 
        },
        yAxis: {
            label: '',
            scale: 'lin',
            viewBounds: [-Number.MAX_VALUE, Number.MAX_VALUE],
            autoscale: true,
            inverted: false
        },
        title: '',
        showTicks: ['left', 'right', 'bottom', 'top'],        // ['top', 'bottom', 'left', 'right']
        showTickNumbers: ['left', 'right', 'bottom', 'top'],  // ['top', 'bottom', 'left', 'right']
        axisAlignment: 'horizontal',   // could be vertical
    }
    
    public range: Rect;
    public steps: NumberArray; 
    public prefferedNBins = 5;
    public heatmap: HeatMap | null = null;
    
    public xRangeLinks: Figure[] = [];
    public yRangeLinks: Figure[] = [];
    public xyRangeLinks: Figure[] = [];
    public yxRangeLinks: Figure[] = [];
    public figureRect: Rect;

    // private fields
    
    private lastMouseDownPos: Point;
    private lastRange: Rect;
    private linePlots: Array<ILinePlot> = [];

    private panning: boolean = false;
    private scaling: boolean = false;
    private lastCenterPoint: Point;
    private _preventPanning: boolean = false;
    private _preventScaling: boolean = false;

    private plotCanvasRect = false;
    
    // public draggableLines: DraggableLines | null = null;

    constructor(parent: GraphicObject, canvasRect?: Rect, margin?: Margin) {
        super(parent, canvasRect, margin) ;

        this.margin = {
            left: 100,
            right: 100,
            top: 60,
            bottom: 60
        };
        this.range = {x: -1, y: -1, w: 2, h: 2};
        this.steps = NumberArray.fromArray([1, 2, 2.5, 5]);
        this.lastMouseDownPos = {x: 0, y: 0};
        this.lastRange = {...this.range};
        this.figureRect = this.getFigureRect();

        // this.figureSettings.xAxis.viewBounds = [-1e5, 1e5];
        // this.figureSettings.yAxis.viewBounds = [-1e5, 1e5];
        this.lastCenterPoint = {x: 0, y: 0};
    }

    public mapCanvas2Range(p: Point): Point{
        let r = this.figureRect;
        let xScaled = (p.x - r.x) / r.w;
        let yScaled = (p.y - r.y) / r.h;

        xScaled = this.figureSettings.xAxis.inverted ? 1 - xScaled : xScaled;
        yScaled = this.figureSettings.yAxis.inverted ? yScaled : 1 - yScaled;  // y axis is inverted in default

        return {
            x: this.range.x + xScaled * this.range.w,
            y: this.range.y + yScaled * this.range.h // inverted y axis
        }
    }

    public mapRange2Canvas(p: Point): Point{
        // rewrite for vertical-aligned axis
        let r = this.figureRect;
        let xScaled = (p.x - this.range.x) / this.range.w;
        let yScaled = (p.y - this.range.y) / this.range.h;

        xScaled = this.figureSettings.xAxis.inverted ? 1 - xScaled : xScaled;
        yScaled = this.figureSettings.yAxis.inverted ? yScaled : 1 - yScaled;  // y axis is inverted in default

        return {
            x: r.x + xScaled * r.w,
            y: r.y + yScaled * r.h  // inverted y axis
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

    public linkXYRange(figure: Figure) {
        if (figure === this) {
            return;
        }

        figure.yxRangeLinks.push(this);
        this.xyRangeLinks.push(figure);
    }

    public linkYXRange(figure: Figure) {
        if (figure === this) {
            return;
        }

        figure.xyRangeLinks.push(this);
        this.yxRangeLinks.push(figure);
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

    public preventMouseEvents(preventScaling?: boolean, preventPanning?: boolean) {
        if (preventScaling !== undefined) {
            this._preventScaling = preventScaling;

        }
        if (preventPanning !== undefined) {
            this._preventPanning = preventPanning;
        }
    }

    public mouseDown(e: MouseEvent): void {
        if (!this.canvas)
            return;

        let [x, y] = [e.offsetX * window.devicePixelRatio, e.offsetY * window.devicePixelRatio];
        this.figureRect = this.getFigureRect();

        // we are outside of figure frame
        if (!this.isInsideFigureRect(x, y))
            return;

        if (this._preventPanning && !this._preventScaling) {
            super.mouseDown(e);
            this.scaling = e.button == 2;
        } else if (!this._preventPanning && this._preventScaling) {
            super.mouseDown(e);
            this.panning = e.button == 0 || e.button == 1;
        } else if (this._preventPanning && this._preventScaling) {
            super.mouseDown(e);
            return;
        } else {
            this.scaling = e.button == 2;
            this.panning = e.button == 0 || e.button == 1;
        }

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

    public rangeChanged(range: Rect): void {
        this.figureSettings.xAxis.autoscale = false;
        this.figureSettings.yAxis.autoscale = false;
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
        for (const fig of this.xyRangeLinks) {
            fig.range.y = this.range.x;
            fig.range.h = this.range.w;
            fig.repaint();
        }
        for (const fig of this.yxRangeLinks) {
            fig.range.x = this.range.y;
            fig.range.w = this.range.h;
            fig.repaint();
        }
        super.rangeChanged(range);
        this.repaint();
    }

    public mouseMove(e: MouseEvent): void {
        if (!this.canvas)
            return

        let [x, y] = [e.offsetX * window.devicePixelRatio, e.offsetY * window.devicePixelRatio];

        if (this._preventPanning || this._preventScaling) {
            super.mouseMove(e);
        }

        if (this._preventPanning && this._preventScaling) {
            return;
        }

        let isInside = this.isInsideFigureRect(e.offsetX, e.offsetY);

        if (isInside)
            this.canvas.style.cursor = this.cursors.crosshair;

        let dist: Point = {
            x: x - this.lastMouseDownPos.x,
            y: y - this.lastMouseDownPos.y
        }

        let rangeChanged = false;

        // if (isInside)
        //     console.log(this.panning, this.scaling);

        if (this.panning){
            this.canvas.style.cursor = this.cursors.move;

            let xRatio = this.lastRange.w / this.figureRect.w;
            let yRatio = this.lastRange.h / this.figureRect.h;

            let xSign = this.figureSettings.xAxis.inverted ? 1 : -1;
            let ySign = this.figureSettings.yAxis.inverted ? -1 : 1;

            let newRect: Rect = {
                x: this.lastRange.x + xSign * dist.x * xRatio, 
                y: this.lastRange.y + ySign * dist.y * yRatio,
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
            this.rangeChanged(this.range);
        }

        // for handling hovering
        if (!this.panning && !this.scaling) {
            super.mouseMove(e);
        }
    }

    mouseUp(e: MouseEvent): void {
        if (this._preventPanning || this._preventScaling) {
            super.mouseUp(e);
        }

        this.panning = false;
        this.scaling = false;

        if (this.canvas)
            this.canvas.style.cursor = this.cursors.crosshair;
    }

    public addDraggableLines(orientation: Orientation): DraggableLines {
        let line = new DraggableLines(this, orientation)
        this.items.push(line);
        return line;
    }

    public plotLine(x: NumberArray, y: NumberArray, color = "black", ld: number[] = [], lw = 1, zValue = 10) {
        var plot: ILinePlot = {x: x.copy(), y: y.copy(), color, ld, lw, zValue}; 
        this.linePlots.push(plot);
        this.repaint();
        return plot;
    }

    public plotHeatmap(dataset: Dataset, colormap: IColorMap = Colormap.seismic ): HeatMap {
        this.heatmap = new HeatMap(this, dataset, colormap);
        // this.heatmap.zRange = [-0.02, 0.02];
        // this.heatmap.recalculateHeatMapImage();

        // set range to heatmap

        this.range = {
            x: dataset.x[0],
            y: dataset.y[0],
            w: dataset.x[dataset.x.length - 1] - dataset.x[0],
            h: dataset.y[dataset.y.length - 1] - dataset.y[0]
        }

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
        0, 0, this.heatmap.width(), this.heatmap.height(),
        p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
        
        // console.log('Heatmap paint');

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

        if (this.linePlots.length < 1) {
            return;
        }

        // autoscale

        let fy = 0.1;  // autoscale margins
        let fx = 0.05;  // autoscale margins


        if (this.figureSettings.yAxis.autoscale) {
            let mins = [];
            let maxs = [];
            for (const plot of this.linePlots) {
                let [min, max] = plot.y.minmax();
                mins.push(min);
                maxs.push(max);
            }
            let y0 = Math.min(...mins);
            let y1 = Math.max(...maxs);

            let diff = y1 - y0;

            if (!this.heatmap) {
                this.range.y = y0 - fy * diff;
                this.range.h = diff * (1 + 2 * fy);
            }
        }

        if (this.figureSettings.xAxis.autoscale) {
            let x0 = Math.min(...this.linePlots.map(p => p.x[0]));
            let x1 = Math.min(...this.linePlots.map(p => p.x[p.x.length - 1]));

            let diff = x1 - x0;

            if (!this.heatmap) {
                this.range.x = x0 - fx * diff;
                this.range.w = diff * (1 + 2 * fx);
            }
        }

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
            e.ctx.setLineDash(plot.ld);
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
        e.ctx.lineWidth = 3;
        e.ctx.strokeRect(this.figureRect.x, this.figureRect.y, this.figureRect.w, this.figureRect.h);
        this.drawTicks(e);

        // this.ctx.restore();

        // this.ctx.save();


    }

    public drawTicks(e: IPaintEvent){  // r is Figure Rectangle, the frame
        e.ctx.fillStyle = textColor;

        let pr = window.devicePixelRatio;

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

        let tickSize = 20;
        let ytextOffset = 16;
        // let ytextOffset = 10;

        // draw x ticks

        let r = this.figureRect;

        e.ctx.font = "25px sans-serif";
        e.ctx.textAlign = 'center';  // vertical alignment
        e.ctx.textBaseline = 'middle'; // horizontal alignment
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
                e.ctx.fillText(`${formatNumber(xtick, xFigures)}`, p.x, r.y + r.h + tickSize + ytextOffset);
            }

            if (this.figureSettings.showTickNumbers.includes('top')){
                e.ctx.fillText(`${formatNumber(xtick, xFigures)}`, p.x, r.y - tickSize - ytextOffset);
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
                e.ctx.fillText(`${formatNumber(ytick, yFigures)}`, r.x - tickSize - ytextOffset, p.y);
            }

            if (this.figureSettings.showTickNumbers.includes('right')){
                e.ctx.textAlign = 'left';
                e.ctx.fillText(`${formatNumber(ytick, yFigures)}`, r.x + r.w + tickSize + ytextOffset, p.y);
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