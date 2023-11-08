
import { GraphicObject } from "./object";
import { Rect, NumberArray, Point, Margin } from "./types";
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

    private lastMouseDownPos: Point;
    private lastRange: Rect;

    private panning: boolean = false;
    private scaling: boolean = false;
    private lastCenterPoint: Point;
    private figureRect: Rect;

    private plotCanvasRect = false;

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

    public plot(x: NumberArray, y: NumberArray, color = "black", ls = "-", lw = 1, zValue = 10) {
        this.linePlots.push({x: x.copy(), y: y.copy(), color, ls, lw, zValue});
        this.paint();
    }

    private evalYPointOnLine(p1: Point, p2: Point, y: number): Point {
        // gets the point on the line determined by points p1 and p2 at y
        // returns {x: [calculated], y: y}

        let slope = (p2.y - p1.y) / (p2.x - p1.x)
        return {x: p1.x + (y - p1.y) / slope, y}  // y = slope * (x - p1.x) + p1.y
    }

    private evalXPointOnLine(p1: Point, p2: Point, x: number): Point {
        // gets the point on the line determined by points p1 and p2 at y
        // returns {x:x, y: [calculated]}

        let slope = (p2.y - p1.y) / (p2.x - p1.x)
        return {x, y: slope * (x - p1.x) + p1.y}  // y = slope * (x - p1.x) + p1.y
    }

    private paintPlots(){
        if (!this.ctx){
            return;
        }

        this.ctx.save()
        for (const plot of this.linePlots) {
            this.ctx.strokeStyle = plot.color;

            var pathStarted = false;

            var getYInterpolate = (i: number, iCheckRange: number) => {
                let p: Point;
                if (plot.y[iCheckRange] < this.range.y) {
                    // make linear interpolation
                    p = this.evalYPointOnLine({x: plot.x[i-1], y: plot.y[i-1]}, {x: plot.x[i], y: plot.y[i]}, this.range.y);
                    pathStarted = false;
                } else if (plot.y[iCheckRange] > this.range.y + this.range.h) {
                    p = this.evalYPointOnLine({x: plot.x[i-1], y: plot.y[i-1]}, {x: plot.x[i], y: plot.y[i]}, this.range.y + this.range.h);
                    pathStarted = false;
                } else {
                    p = {x: plot.x[i], y: plot.y[i]};
                }
    
                return p;
            }

            this.ctx.beginPath()
        
            for (let i = 0; i < plot.x.length; i++) {
                if (plot.x[i] < this.range.x)
                    continue;

                // if (i === 0)
                //     continue;

                console.log(i, pathStarted);
            
                if (!pathStarted) {
                    // if (plot.y[i] < this.range.y || plot.y[i] > this.range.y + this.range.h){
                    //     continue;
                    // }
                    console.log('path started');


                    let p0: Point = {x: 0, y: 0};
                    let checkY = true;
                    
                    // if the previous x point was outside of range
                    if (i > 0 && plot.x[i - 1] < this.range.x) {
                        console.log('previous x outside of range');
                        checkY = false;
                        p0 = this.evalXPointOnLine({x: plot.x[i-1], y: plot.y[i-1]}, {x: plot.x[i], y: plot.y[i]}, this.range.x);

                        // if p0.y is outside of y range, check y
                        if (p0.y < this.range.y || p0.y > this.range.y + this.range.h)
                            checkY = true;
                    }
                    // console.log(checkY);

                    if (checkY){
                        p0 = getYInterpolate(i, i);
                        console.log(p0);
                    }

                    p0 = this.mapRange2Canvas(p0);
                    this.ctx.moveTo(p0.x, p0.y);
                    pathStarted = true;
                }

                // if it is the last line
                if (plot.x[i] > this.range.x + this.range.w){
                    console.log('last x outside of range');
                    let checkY = false;
                    let p = this.evalXPointOnLine({x: plot.x[i-1], y: plot.y[i-1]}, {x: plot.x[i], y: plot.y[i]}, this.range.x + this.range.w);
                    // if p0.y is outside of range, check y
                    if (p.y < this.range.y || p.y > this.range.y + this.range.h)
                        checkY = true;

                    if (checkY){
                        p = getYInterpolate(i, i+1);
                    }

                    p = this.mapRange2Canvas(p);
                    this.ctx.lineTo(p.x, p.y);
                    break;

                } else {
                    let p = getYInterpolate(i, i+1);
                    p = this.mapRange2Canvas(p);
                    this.ctx.lineTo(p.x, p.y);
                }
                
            }
            this.ctx.lineWidth = plot.lw;
            this.ctx.stroke();
        }
        this.ctx.restore();
        
    }

    paint(): void {
        // plot rectangle
        if (!this.ctx){
            return;
        }

        this.ctx.fillStyle = backgroundColor;
        this.ctx.fillRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);

        this.ctx.strokeStyle = frameColor;

        if (this.plotCanvasRect){
            this.ctx.setLineDash([4, 2]);
            this.ctx.strokeRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
            this.ctx.setLineDash([]);
        }

        this.figureRect = this.getFigureRect();
        
        // draw figure rectangle
        this.ctx.strokeRect(this.figureRect.x, this.figureRect.y, this.figureRect.w, this.figureRect.h);
        this.drawTicks();

        //plot content
        this.paintPlots();

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