
import { GraphicObject } from "./object";
import { Rect, NumberArray, Point } from "./types";

export class Figure extends GraphicObject {

    public range: Rect;
    public steps: NumberArray; 
    public prefferedNBins = 5;
    // public display
    private lastMouseDownPos: Point;
    private lastRange: Rect;

    private panning: boolean = false;
    private scaling: boolean = false;
    private figureRect: Rect;

    constructor(parent: GraphicObject, canvasRect: Rect) {
        super(parent);

        this.margin = {
            left: 50,
            right: 50,
            top: 50,
            bottom: 50
        };
        this.canvasRect = canvasRect;
        this.range = {x: -1, y: -1, w: 2, h: 2};
        this.steps = new NumberArray(1, 2, 2.5, 5);
        this.lastMouseDownPos = {x: 0, y: 0};
        this.lastRange = {...this.range};
        this.figureRect = this.getFigureRect();
    }

    public mapCanvas2Range(p: Point): Point{
        let r = this.getFigureRect();
        let xScaled = (p.x - r.x) / r.w;
        let yScaled = (p.y - r.y) / r.h;

        return {
            x: this.range.x + xScaled * this.range.w,
            y: this.range.y + (1 - yScaled) * this.range.h // inverted y axis
        }
    }

    public mapRange2Canvas(p: Point): Point{
        let r = this.getFigureRect();
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
            w: this.canvasRect.w - this.margin.right - x,
            h: this.canvasRect.h - this.margin.bottom - y
        }
    }

    mouseDown(e: MouseEvent): void {
        this.scaling = e.button == 2;
        this.panning = e.button == 0 || e.button == 1;
    
        this.lastMouseDownPos = {x: e.offsetX, y: e.offsetY};
        this.lastRange = {...this.range};
        this.figureRect = this.getFigureRect();
    }

    mouseMove(e: MouseEvent): void {
        let dist: Point = {
            x: e.offsetX - this.lastMouseDownPos.x,
            y: e.offsetY - this.lastMouseDownPos.y
        }
        
        if (this.panning){
            let xRatio = this.lastRange.w / this.figureRect.w;
            let yRatio = this.lastRange.h / this.figureRect.h;

            this.range.x = this.lastRange.x - dist.x * xRatio;
            this.range.y = this.lastRange.y + dist.y * yRatio;
            this.parent?.paint();
        }
        // analogous as in pyqtgraph
        // https://github.com/pyqtgraph/pyqtgraph/blob/7ab6fa3d2fb6832b624541b58eefc52c0dfb4b08/pyqtgraph/widgets/GraphicsView.py
        if (this.scaling){
            let xZoom = 1.01 ** dist.x;
            let yZoom = 1.01 ** dist.y;

            let centerPoint = this.mapCanvas2Range(this.lastMouseDownPos);

            // console.log(xZoom, yZoom);

            console.log((centerPoint.x - this.lastRange.x) / xZoom)

            this.range.x = centerPoint.x - (centerPoint.x - this.lastRange.x) / xZoom;
            this.range.y = centerPoint.y - (centerPoint.y - this.lastRange.y) * yZoom;
            this.range.w = this.lastRange.w / xZoom;
            this.range.h = this.lastRange.h * yZoom;

            // console.log(this.range);

            this.parent?.paint();
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
        // console.log(this.scaling, this.panning); 
    }

    paint(): void {
        // plot rectangle
        if (!this.ctx){
            return;
        }

        let r = this.getFigureRect();

        this.ctx.strokeRect(r.x, r.y, r.w, r.h);
        this.drawTicks(r);
    }

    public drawTicks(r: Rect){  // r is Figure Rectangle, the frame
        if (!this.ctx){
            return;
        }

        let xticks = this.genMajorTicks(this.range.x, this.range.w);
        let yticks = this.genMajorTicks(this.range.y, this.range.h);
    
        let tickSize = 8;
        let xtextOffset = 10;
        let ytextOffset = 10;

        // draw x ticks
        this.ctx.textAlign = 'center';
        this.ctx.beginPath();
        // let r = this.getFigureRect();
        for (const xtick of xticks) {
            let p = this.mapRange2Canvas({x:xtick, y: 0});
            let y = r.y + r.h;
    
            this.ctx.moveTo(p.x, y);
            this.ctx.lineTo(p.x, y + tickSize);
            
            this.ctx.fillText(`${xtick}`, p.x, y + tickSize + xtextOffset);
        }
        this.ctx.stroke();
    
        // draw y ticks
        this.ctx.textAlign = 'right';
    
        this.ctx.beginPath();

        for (const ytick of yticks) {
            let p = this.mapRange2Canvas({x:0, y: ytick});
            let x = r.x;
    
            this.ctx.moveTo(x, p.y);
            this.ctx.lineTo(x - tickSize, p.y);
            this.ctx.fillText(`${ytick}`, x - tickSize - ytextOffset, p.y + 3);
            
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