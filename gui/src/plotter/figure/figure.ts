
import { GraphicObject, IMouseEvent, IPaintEvent} from "../object";
import { Rect, NumberArray, Point, Margin } from "../types";
import { backgroundColor,  frameColor, textColor } from "../settings";
import { Dataset, determineSigFigures, drawTextWithGlow, formatNumber } from "../utils";
import { Colormap, Colormaps, ILut } from "../color";
import { HeatMap } from "./heatmap";
import { DraggableLines, Orientation } from "../draggableLines";
import { Axis, AxisType } from "./axis";
import { ContextMenu } from "../contextmenu";
import { ColorbarContextMenu, FigureContextMenu } from "./figurecontextmenu";
// import { Colorbar } from "./colorbar";


export interface ILinePlot {
    x: NumberArray,
    y: NumberArray,
    color: string,
    ld: number[],  // line dash, exmaple [4, 2], no dash: []
    lw: number,  // line width
    zValue: number
}

export enum Shape {
    Rectangle,
    Circle,
    Pentagon,
    Triangle
}

export interface IScatterPlot {
    x: NumberArray,
    y: NumberArray,
    fillColor: string | null,
    edgeColor: string | null,
    edgelw: number,
    shape: Shape,
    ld: number[],  // line dash, exmaple [4, 2], no dash: []
    lw: number | null,  // line width of the connecting line
    s: number, // size of the scatter shape
    zValue: number
}


export class Figure extends GraphicObject {

    public title: string = "";
    public showTicks: string[] =  ['left', 'right', 'bottom', 'top'];        // ['top', 'bottom', 'left', 'right']
    public showTickNumbers: string[] =  ['left', 'right', 'bottom', 'top'];  // ['top', 'bottom', 'left', 'right']
    public axisAlignment: Orientation = Orientation.Horizontal;   // could be vertical

    public xAxis: Axis;
    public yAxis: Axis;
    
    public steps: NumberArray; 
    public heatmap: HeatMap | null = null;
    public colorbar: Colorbar | null = null;
    // public contextMenu: FigureContextMenu;
    
    // public xAxisSigFigures: number = 2;
    // public yAxisSigFigures: number = 2;
    private _ticksValuesFont: string = '10 ps sans-serif';

    public requiredMargin: Margin; // last margin required by paining the figure
    
    // private fields
    
    public internalRange: Rect;  // in case of scale of data, the range will be just indexes of data it is bound to

    private lastMouseDownPos: Point;
    private mousePos: Point | null;
    private lastRange: Rect;
    public linePlots: Array<ILinePlot> = [];

    private xRangeLinks: Figure[] = [];
    private yRangeLinks: Figure[] = [];
    private xyRangeLinks: Figure[] = [];
    private yxRangeLinks: Figure[] = [];

    private marginLinks: ([Figure, Orientation])[] = [];

    public panning: boolean = false;
    public scaling: boolean = false;
    private lastCenterPoint: Point;
    private _preventPanning: boolean = false;
    private _preventScaling: boolean = false;

    // public offScreenCanvas: OffscreenCanvas;
    // protected offScreenCanvasCtx: OffscreenCanvasRenderingContext2D | null;

    private plotCanvasRect = false;
    public minimalMargin: Margin = { 
        left: 10,
        right: 10,
        top: 10,
        bottom: 10
    };
    private _painting: boolean = false;
    private _cancelPaining: boolean = false;
    
    get tickValuesFont(): string {
        return this._ticksValuesFont;
    }

    constructor(parent?: GraphicObject, canvasRect?: Rect, margin?: Margin) {
        super(parent, canvasRect, margin);

        this.margin = {
            left: 150,
            right: 100,
            top: 60,
            bottom: 60
        };
        this.requiredMargin = {left: 0, right: 0, top: 0, bottom: 0};
        this.internalRange = {x: -1, y: -1, w: 2, h: 2};
        // this.steps = NumberArray.fromArray([1, 2, 2.5, 5]);
        this.steps = NumberArray.fromArray([1, 2, 5]);
        this.lastMouseDownPos = {x: 0, y: 0};
        this.mousePos = {x: 0, y: 0};
        this.lastRange = {...this.internalRange};

        // this.figureSettings.xAxis.viewBounds = [-1e5, 1e5];
        // this.figureSettings.yAxis.viewBounds = [-1e5, 1e5];
        this.lastCenterPoint = {x: 0, y: 0};
        // this.offScreenCanvas = new OffscreenCanvas(this.canvasRect.w, this.canvasRect.h);
        // this.offScreenCanvasCtx = this.offScreenCanvas.getContext('2d');
        // if (this.offScreenCanvasCtx === null) {
        //     throw new Error('this.offScreenCanvasCtx === null');
        // }
        this.xAxis = new Axis(this, AxisType.xAxis);
        this.yAxis = new Axis(this, AxisType.yAxis);
        this.setContextMenu();
    }

    protected setContextMenu() {
        this.contextMenu = new FigureContextMenu(this);
    }

    // public resize(): void {
    //     super.resize();
    // }

    // public setCanvasRect(cr: Rect): void {
    //     super.setCanvasRect(cr);
    //     this.offScreenCanvas.width = this.canvasRect.w;
    //     this.offScreenCanvas.height = this.canvasRect.h;
    // }

    public setViewBounds(xAxisBounds?: [number, number], yAxisBounds?: [number, number]) {
        if (xAxisBounds) {
            const xIT = this.xAxis.invTransform;
            this.xAxis.viewBounds = [xIT(xAxisBounds[0]), xIT(xAxisBounds[1])];
        }

        if (yAxisBounds) {
            const yIT = this.yAxis.invTransform;
            this.yAxis.viewBounds = [yIT(yAxisBounds[0]), yIT(yAxisBounds[1])];
        }
    }

    get range() {
        const xRng = this.xAxis.range;
        const yRng = this.yAxis.range;

        return {
            x: xRng[0],
            y: yRng[0],
            w: xRng[1],
            h: yRng[1]
        }
    }

    set range(newRange: Rect) {
        const xIT = this.xAxis.invTransform;
        const yIT = this.yAxis.invTransform;

        const x = xIT(newRange.x);
        const y = yIT(newRange.y);

        this.internalRange = {
            x,
            y,
            w: xIT(newRange.x + newRange.w) - x,
            h: yIT(newRange.y + newRange.h) - y,
        }
    }

    public mapCanvas2Range(p: Point): Point{
        // const r = this.effRect;
        const r = this.getEffectiveRect();
        let xrel = (p.x - r.x) / r.w;
        let yrel = (p.y - r.y) / r.h;

        if (this.axisAlignment === Orientation.Vertical) {
            xrel = this.yAxis.inverted ? xrel : 1 - xrel;
            yrel = this.xAxis.inverted ? yrel : 1 - yrel;  // y axis is inverted in default
            return {
                x: this.internalRange.x + yrel * this.internalRange.w,
                y: this.internalRange.y + xrel * this.internalRange.h
            }
        } else {
            xrel = this.xAxis.inverted ? 1 - xrel : xrel;
            yrel = this.yAxis.inverted ? yrel : 1 - yrel;  // y axis is inverted in default
            return {
                x: this.internalRange.x + xrel * this.internalRange.w,
                y: this.internalRange.y + yrel * this.internalRange.h
            }
        }
    }

    public mapRange2Canvas(p: Point): Point{
        const r = this.getEffectiveRect();
        let xrel = (p.x - this.internalRange.x) / this.internalRange.w;
        let yrel = (p.y - this.internalRange.y) / this.internalRange.h;

        xrel = this.xAxis.inverted ? 1 - xrel : xrel;
        yrel = this.yAxis.inverted ? yrel : 1 - yrel;  // y axis is inverted in default

        if (this.axisAlignment === Orientation.Vertical) {
            return {
                x: r.x + yrel * r.w,
                y: r.y + (1 - xrel) * r.h
            }
        } else {
            return {
                x: r.x + xrel * r.w,
                y: r.y + yrel * r.h 
            }
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

    public linkMargin(figure: Figure, orientation: Orientation) {
        if (figure === this) {
            return;
        }

        figure.marginLinks.push([this, orientation]);
        this.marginLinks.push([figure, orientation]);
    }

    public preventMouseEvents(preventScaling?: boolean, preventPanning?: boolean) {
        this._preventScaling = preventScaling ?? this._preventScaling;
        this._preventPanning = preventPanning ?? this._preventPanning;
    }

    public viewAll() {
        const lastRng = {...this.internalRange};
        this.autoscale(true);
        if (this.internalRange.x !== lastRng.x || this.internalRange.y !== lastRng.y || this.internalRange.w !== lastRng.w || this.internalRange.h !== lastRng.h) {
            this.rangeChanged(this.internalRange);
            this.repaint();
        }
    }

    public doubleClick(e: IMouseEvent): void {
        if (!this.isInsideEffRect(e.x, e.y)) return;
        this.viewAll();        
    }

    public touchStart(e: TouchEvent): void {
        const dpr = window.devicePixelRatio;
        // this.calcEffectiveRect();

        // position are relative to start of the page
        if (!this.isInsideEffRect(e.touches[0].clientX * dpr, e.touches[0].clientY * dpr)) {
            return;
        }
        // console.log(e.touches[0].force);
    }

    public touchMove(e: TouchEvent): void {
        var first = e.touches[0]
        // console.log(first.clientX, first.clientY, first.radiusX);

    }


    public mouseDown(e: IMouseEvent): void {

        // if (this.colorbar) {
        //     this.colorbar.mouseDown(e);
        // }

        // // we are outside of figure frame
        // if (!this.isInsideEffRect(e.x, e.y)) return;

        if (e.e.ctrlKey) return;  // for this case, default context menu is opened
        
        if (this._preventPanning && !this._preventScaling) {
            super.mouseDown(e);
            this.scaling = e.e.button == 2;
        } else if (!this._preventPanning && this._preventScaling) {
            super.mouseDown(e);
            this.panning = e.e.button == 0 || e.e.button == 1;
        } else if (this._preventPanning && this._preventScaling) {
            super.mouseDown(e);
            return;
        } else {
            if (this.isInsideEffRect(e.x, e.y)) {
                this.scaling = e.e.button == 2;
                this.panning = e.e.button == 0 || e.e.button == 1;
            }
        }

        this.lastMouseDownPos = {x: e.x, y: e.y};
        this.lastRange = {...this.internalRange};
        
        this.lastCenterPoint = this.mapCanvas2Range(this.lastMouseDownPos);

        if (this.panning) {
            e.topCanvas.style.cursor = this.cursors.grabbing;
        } else if (this.scaling) {
            e.topCanvas.style.cursor = this.cursors.move;
        } else {
            super.mouseDown(e);
        }

        if  (this.scaling || this.panning) {
            const lastPos = {x: e.e.clientX, y: e.e.clientY};
            const va = this.axisAlignment === Orientation.Vertical;

            var mousemove = (e: MouseEvent) => {

                let dist: Point = {
                    x: window.devicePixelRatio * (e.clientX - lastPos.x),
                    y: window.devicePixelRatio * (e.clientY - lastPos.y)
                }
        
                if (va) {
                    dist = {x: dist.y, y: dist.x};
                }
        
                let rangeChanged = false;
                if (this.panning){
                    // this.canvas.style.cursor = this.cursors.grabbing;

                    const r = this.getEffectiveRect();
        
                    let w = r.w;
                    let h = r.h;
                    
                    let xSign = this.xAxis.inverted ? 1 : -1;
                    const ySign = this.yAxis.inverted ? -1 : 1;
        
                    if (va) {
                        [w, h] = [h, w];
                        xSign *= -1;
                    }
        
                    const xRatio = this.lastRange.w / w;
                    const yRatio = this.lastRange.h / h;

                    let [dx, dy] = [xSign * dist.x * xRatio, ySign * dist.y * yRatio];
                    
                    dx = this.xAxis.keepCentered ? 0 : dx;
                    dy = this.yAxis.keepCentered ? 0 : dy;
        
                    let newRect: Rect = {
                        x: this.lastRange.x + dx, 
                        y: this.lastRange.y + dy,
                        w: this.lastRange.w,
                        h: this.lastRange.h
                    };
        
                    this.internalRange = this.getBoundedRange(newRect, true);
                    rangeChanged = true;
                }
                // analogous as in pyqtgraph
                // https://github.com/pyqtgraph/pyqtgraph/blob/7ab6fa3d2fb6832b624541b58eefc52c0dfb4b08/pyqtgraph/widgets/GraphicsView.py
                if (this.scaling){
                    // this.canvas.style.cursor = this.cursors.move;
        
                    let xZoom = 1.01 ** dist.x;
                    let yZoom = 1.01 ** dist.y;
        
                    if (va) {
                        xZoom = 1 / xZoom;
                        yZoom = 1 / yZoom;
                    }
        
                    let newRect: Rect = {
                        x: this.lastCenterPoint.x - (this.lastCenterPoint.x - this.lastRange.x) / xZoom, 
                        y: this.lastCenterPoint.y - (this.lastCenterPoint.y - this.lastRange.y) * yZoom,
                        w: this.lastRange.w / xZoom,
                        h: this.lastRange.h * yZoom
                    };

                    if (this.xAxis.keepCentered) {
                        const extreme = Math.max(Math.abs(this.lastRange.x), Math.abs(this.lastRange.x + this.lastRange.w));
                        newRect.x = -extreme / xZoom;
                        newRect.w = -2*newRect.x;
                    }

                    if (this.yAxis.keepCentered) {
                        const extreme = Math.max(Math.abs(this.lastRange.y), Math.abs(this.lastRange.y + this.lastRange.h));
                        newRect.y = -extreme / yZoom;
                        newRect.h = -2*newRect.y;
                    }

                    this.internalRange = this.getBoundedRange(newRect, false);
                    rangeChanged = true;
                }

                if (rangeChanged){
                    this.rangeChanged(this.internalRange);

                }
            }

            var mouseup = (e: MouseEvent) => {
                window.removeEventListener('mousemove', mousemove);
                window.removeEventListener('mouseup', mouseup);
                if  (this.topCanvas) this.topCanvas.style.cursor = this.cursors.crosshair;
            }

            window.addEventListener('mousemove', mousemove);
            window.addEventListener('mouseup', mouseup);
        }
    }

    private getBoundedRange(rect: Rect, dontZoom: boolean): Rect {
        var x0 = Math.max(rect.x, this.xAxis.viewBounds[0]);
        var y0 = Math.max(rect.y, this.yAxis.viewBounds[0]);
        var x1 = Math.min(rect.x + rect.w, this.xAxis.viewBounds[1])
        var y1 = Math.min(rect.y + rect.h, this.yAxis.viewBounds[1])

        var retRect: Rect = {
            x: x0,
            y: y0,
            w: x1 - x0,
            h: y1 - y0
        }

        if (dontZoom){
            if (x0 === this.xAxis.viewBounds[0]) retRect.w = rect.w;
            
            if (x1 === this.xAxis.viewBounds[1]){
                retRect.w = rect.w;
                retRect.x = x1 - rect.w;
            }
            if (y0 === this.yAxis.viewBounds[0]) retRect.h = rect.h;
            
            if (y1 === this.yAxis.viewBounds[1]){
                retRect.h = rect.h;
                retRect.y = y1 - rect.h;
            }
        }

        return retRect;
    }

    public rangeChanged(range: Rect): void {
        // this.xAxis.autoscale = false;
        // this.yAxis.autoscale = false;
        for (const fig of this.xRangeLinks) {
            if (this.xAxis.scale === fig.xAxis.scale) {
                fig.internalRange.x = this.internalRange.x;
                fig.internalRange.w = this.internalRange.w;
            } else {
                const r = this.range;
                const fr = fig.range;
                fig.range = {x: r.x, y: fr.y, w: r.w, h: fr.h};
            }
            fig.repaint();
        }
        for (const fig of this.yRangeLinks) {
            if (this.yAxis.scale === fig.yAxis.scale) {
                fig.internalRange.y = this.internalRange.y;
                fig.internalRange.h = this.internalRange.h;
            } else {
                const r = this.range;
                const fr = fig.range;
                fig.range = {x: fr.x, y: r.y, w: fr.w, h: r.h};
            }
            fig.repaint();
        }
        for (const fig of this.xyRangeLinks) {
            if (this.xAxis.scale === fig.yAxis.scale) {
                fig.internalRange.y = this.internalRange.x;
                fig.internalRange.h = this.internalRange.w;
            } else {
                const r = this.range;
                const fr = fig.range;
                fig.range = {x: fr.x, y: r.x, w: fr.w, h: r.w};
            }
            fig.repaint();
        }
        for (const fig of this.yxRangeLinks) {
            if (this.yAxis.scale === fig.xAxis.scale) {
                fig.internalRange.x = this.internalRange.y;
                fig.internalRange.w = this.internalRange.h;
            } else {
                const r = this.range;
                const fr = fig.range;
                fig.range = {x: r.y, y: fr.y, w: r.h, h: fr.h};
            }
            fig.repaint();
        }
        // console.log(this.range);
        super.rangeChanged(range);
        this.repaint();
    }

    public mouseMove(e: IMouseEvent): void {
        // console.log('Mouse move from figure');

        if (this.panning || this.scaling) {
            return;
        }

        if (this._preventPanning || this._preventScaling) {
            super.mouseMove(e);
            return;
        }
        
        if (this.isInsideEffRect(e.x, e.y)) {
            e.topCanvas.style.cursor = this.cursors.crosshair;
            this.mousePos = {x: e.x, y: e.y};
        } else {
            e.topCanvas.style.cursor = this.cursors.default;
            this.mousePos = null;

            // console.log('setting up cursor');
        }

        // for handling mousemove event of items
        super.mouseMove(e);
        
        // plot mouse position
        this.repaintItems();
    }

    public mouseUp(e: IMouseEvent): void {
    //     if (this._preventPanning || this._preventScaling) {
    // }
        super.mouseUp(e);

        this.panning = false;
        this.scaling = false;

        // e.canvas.style.cursor = this.cursors.crosshair;

        if (!this.isInsideEffRect(e.x, e.y)) return;

        if (e.x === this.lastMouseDownPos.x && e.y === this.lastMouseDownPos.y && e.e.button == 2) {
            this.showContextMenu(e);
        }   
    }

    public addDraggableLines(orientation: Orientation): DraggableLines {
        const line = new DraggableLines(this, orientation)
        this.addItem(line)
        return line;
    }

    public plotLine(x: NumberArray, y: NumberArray, color = "black", ld: number[] = [], lw = 1, zValue = 10) {
        var plot: ILinePlot = {x: x.copy(), y: y.copy(), color, ld, lw, zValue}; 
        this.linePlots.push(plot);
        this.repaint();
        return plot;
    }

    public plotHeatmap(dataset: Dataset, colormap: Colormap): HeatMap {
        this.heatmap = new HeatMap(this, dataset, colormap);

        let x, y, h, w;

        // let xdiff, ydiff, xOffset, yOffset;

        // x axis

        if (!this.heatmap.isXRegular) {
            this.xAxis.scale = dataset.x;
            x = 0;
            w = dataset.x.length - 1;
            // xdiff = 1;
            // xOffset = 0;
            // this.figureSettings.xAxis.viewBounds = [x, w];
        } else {
            x = dataset.x[0];
            w = dataset.x[dataset.x.length - 1] - x;
            // xdiff = w / (dataset.x.length - 1);
            // xOffset = x;
            // this.figureSettings.xAxis.viewBounds = [-Number.MAX_VALUE, +Number.MAX_VALUE];
            this.xAxis.scale = 'lin';
        }

        // y axis

        if (!this.heatmap.isYRegular) {
            this.yAxis.scale = dataset.y;
            y = 0;
            h = dataset.y.length - 1;
            // ydiff = 1;
            // yOffset = 0;
            // this.figureSettings.yAxis.viewBounds = [y, h];
        } else {
            y = dataset.y[0];
            h = dataset.y[dataset.y.length - 1] - y;
            this.yAxis.scale = 'lin';
            // ydiff = h / (dataset.y.length - 1);
            // yOffset = y;
            // this.figureSettings.yAxis.viewBounds = [-Number.MAX_VALUE, +Number.MAX_VALUE];
        }



        // this.heatmap.zRange = [-0.02, 0.02];
        // this.heatmap.recalculateHeatMapImage();

        // set range to heatmap

        this.internalRange = {x, y, w, h};

        this.repaint();
        return this.heatmap;
    }

    // private setColorbarCR() {
    //     if (!this.colorbar) return;
    //     let s = 150;
    //     var cr: Rect = {
    //         x: this.canvasRect.x + this.canvasRect.w - s,
    //         y: this.canvasRect.y,
    //         w: s,
    //         h: this.canvasRect.h
    //     }
    //     this.colorbar.setCanvasRect(cr);
    //     // this.colorbar.canvasRect = cr;
    // }

    public addColorbar(colormap?: Colormap): Colorbar {
        if (this.colorbar) return this.colorbar;

        this.colorbar = new Colorbar(this, undefined, colormap);
        this.items.push(this.colorbar);
        // this.colorbar.setCanvasRect(this.canvasRect);
        this.linkMargin(this.colorbar, Orientation.Vertical);
        return this.colorbar;
    }   

    public removePlot(plot: ILinePlot){
        let i = this.linePlots.indexOf(plot);
        if (i > -1) {
            this.linePlots.splice(i, 0);
        }
    }

    protected paintHeatMap(e: IPaintEvent){
        if (!this.heatmap) {
            return;
        }

        e.bottomCtx.imageSmoothingEnabled = false;

        // this.heatmap.plot2mainCanvas(e);

        const x = this.heatmap.dataset.x;
        const y = this.heatmap.dataset.y;

        // if the axis is not regular, the image will spread from 0 to x.length, the same for y
        const x0 = this.heatmap.isXRegular ? x[0] : 0;
        const y0 = this.heatmap.isYRegular ? y[0] : 0;

        const x1 = this.heatmap.isXRegular ? x[x.length - 1] : x.length - 1;
        const y1 = this.heatmap.isYRegular ? y[y.length - 1] : y.length - 1;

        // for evenly spaced data
        const xdiff = (x1 - x0) / (x.length - 1);
        const ydiff = (y1 - y0) / (y.length - 1);

        // console.log(x0, y0, w, h);
        // console.log(this.heatmap.isXRegular, this.heatmap.isYRegular);

        const p0 = this.mapRange2Canvas({x: x0 - xdiff / 2, y: y0 - ydiff / 2});
        const p1 = this.mapRange2Canvas({x: x1 + xdiff / 2, y: y1 + ydiff / 2});

        e.bottomCtx.drawImage(this.heatmap.getCanvas(), 
        0, 0, this.heatmap.width(), this.heatmap.height(),
        p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);

        console.log('Heatmap paint');

    }

    public clearPlots() {
        this.linePlots = [];
        this.heatmap = null;
    }

    private autoscale(forceAutoscale?: boolean) {
        // autoscale

        const fy = 0.1;  // autoscale margins
        const fx = 0.05;  // autoscale margins

        if (this.yAxis.autoscale || forceAutoscale) {
            const yIT = this.yAxis.invTransform;
            const mins = [];
            const maxs = [];
            for (const plot of this.linePlots) {
                if (plot.y.length === 0) continue;
                const [min, max] = plot.y.minmax();
                mins.push(min);
                maxs.push(max);
            }
            if (this.heatmap) {
                mins.push(this.heatmap.dataset.y[0]);
                maxs.push(this.heatmap.dataset.y[this.heatmap.dataset.y.length - 1]);
            }
            let y0 = yIT(Math.min(...mins));
            let y1 = yIT(Math.max(...maxs));

            y0 = (Number.isNaN(y0) || y0 === undefined || !Number.isFinite(y0)) ? -1 : y0;
            y1 = (Number.isNaN(y1) || y1 === undefined || !Number.isFinite(y1)) ? 1 : y1;

            const diff = y1 - y0;

            y0 = Math.max(this.yAxis.viewBounds[0], y0 - fy * diff);
            y1 = Math.min(this.yAxis.viewBounds[1], y1 + fy * diff);

            this.internalRange.y = y0;
            this.internalRange.h = y1 - y0;
        }

        if (this.xAxis.autoscale || forceAutoscale) {
            const xIT = this.xAxis.invTransform;
            const mins = [];
            const maxs = [];
            for (const plot of this.linePlots) {
                if (plot.x.length === 0) continue;
                mins.push(plot.x[0]);
                maxs.push(plot.x[plot.x.length - 1]);
            }
            if (this.heatmap) {
                mins.push(this.heatmap.dataset.x[0]);
                maxs.push(this.heatmap.dataset.x[this.heatmap.dataset.x.length - 1]);
            }
            let x0 = xIT(Math.min(...mins));
            let x1 = xIT(Math.max(...maxs));

            x0 = (Number.isNaN(x0) || x0 === undefined || !Number.isFinite(x0)) ? -1 : x0;
            x1 = (Number.isNaN(x1) || x1 === undefined || !Number.isFinite(x1)) ? 1 : x1;

            const diff = x1 - x0;

            x0 = Math.max(this.xAxis.viewBounds[0], x0 - fx * diff);
            x1 = Math.min(this.xAxis.viewBounds[1], x1 + fx * diff);

            this.internalRange.x = x0;
            this.internalRange.w = x1 - x0;
        }
        // console.log(this._range);
    }


    private paintPlots(e: IPaintEvent) {
        if (this.linePlots.length < 1) {
            return;
        }

        if (!this.panning && !this.scaling) this.autoscale();

        const yIT = this.yAxis.invTransform;
        const xIT = this.xAxis.invTransform;

        e.bottomCtx.save();

        // the speed was almost the same as for the above case
        for (const plot of this.linePlots) {

            e.bottomCtx.strokeStyle = plot.color;
            e.bottomCtx.lineWidth = plot.lw;
            e.bottomCtx.setLineDash(plot.ld);

            e.bottomCtx.beginPath();

            let xDataScale = false; // in case the scale is determined by data
            let x0;
            if (this.xAxis.scale instanceof NumberArray && plot.x.length === this.xAxis.scale.length) {
                xDataScale = true;
                x0 = 0;
            } else {
                x0 = xIT(plot.x[0]);
            }

            const p0 = this.mapRange2Canvas({x: x0, y: yIT(plot.y[0])});
            e.bottomCtx.moveTo(p0.x, p0.y);

            for (let i = 1; i < plot.x.length; i++) {
                const x = (xDataScale) ? i : xIT(plot.x[i]);
                const p = this.mapRange2Canvas({x, y: yIT(plot.y[i])});
                e.bottomCtx.lineTo(p.x, p.y);
                if (x > this.internalRange.x + this.internalRange.w) break;
            }

            e.bottomCtx.stroke();
        }

        e.bottomCtx.restore();

        // console.timeEnd('paintPlots');
    }

    // protected storeImage() {
        // https://stackoverflow.com/questions/4532166/how-to-capture-a-section-of-a-canvas-to-a-bitmap
    //     if (!this.offScreenCanvasCtx || !this.mainCanvas) return;

    //     const w = this.canvasRect.w;
    //     const h = this.canvasRect.h;

    //     this.offScreenCanvasCtx.drawImage(this.mainCanvas, 
    //         this.canvasRect.x, this.canvasRect.y, w, h,
    //         0, 0, w, h);
    // }

    public repaintItems() {
        // console.time('repaintItems');
        if (!this.bottomCtx || !this.topCanvas || !this.bottomCanvas || !this.topCtx) return;

        const e: IPaintEvent = {bottomCanvas: this.bottomCanvas, bottomCtx: this.bottomCtx, topCanvas: this.topCanvas, topCtx: this.topCtx};

        this.paintItems(e);
        // console.timeEnd('repaintItems');
    }

    protected paintItems(e: IPaintEvent) {
        
        // paint all additional graphics objects if necessary
        // update the canvas and margins for other items

        // clear the secondary canvas

        e.topCtx.clearRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);

        // plot postion

        const xIT = this.xAxis.transform;
        const yIT = this.yAxis.transform;
        const figs = 4;
        if (this.mousePos) {
            const p = this.mapCanvas2Range(this.mousePos);
            var text = `x: ${formatNumber(xIT(p.x), figs)}, y: ${formatNumber(yIT(p.y), figs)}`;

            if (this.heatmap) {
                // add z value
                var val = this.heatmap.dataset.getNearestValue(xIT(p.x), yIT(p.y));
                text += `, z: ${formatNumber(val, figs)}`
            }
        } else {
            var text = "";
        };

        const offset = 30;

        const r = this.getEffectiveRect();

        e.topCtx.save();
        drawTextWithGlow(text, r.x + offset, r.y + r.h - offset, e.topCtx, this.tickValuesFont);
        e.topCtx.restore();

        // repaint all other items

        // set canvas rect to all items
        for (const item of this.items) {
            // item.setCanvasRect(this.canvasRect);
            item.setMargin(this.margin);
        }

        super.paint(e);

        // paint colorbar
        // if (this.colorbar) this.colorbar.paint(e);

    }

    public setMargin(m: Margin): void {
        this.margin = m;
    }

    // private async paintAsync(e: IPaintEvent) {
    // }

    paint(e: IPaintEvent): void {
        // for (const item of this.items) {
        //     item.canvasRect = {...this.canvasRect};
        //     item.margin = {...this.margin};
        // }

        // if (this.colorbar) {
        //     this.setColorbarCR();
        // }

        e.bottomCtx.save();

        // clip to canvas rectangle

        e.bottomCtx.fillStyle = backgroundColor;
        e.bottomCtx.fillRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);

        e.bottomCtx.strokeStyle = frameColor;

        if (this.plotCanvasRect){
            e.bottomCtx.setLineDash([4, 2]);
            e.bottomCtx.strokeRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
            e.bottomCtx.setLineDash([]);
        }

        // paint everything inside the plot

        //plot content
        const r = this.getEffectiveRect();
        e.bottomCtx.rect(r.x, r.y, r.w, r.h);
        e.bottomCtx.clip();

        this.paintHeatMap(e);
        this.paintPlots(e);

        e.bottomCtx.restore();

        // if (this._cancelPaining) {
        //     console.log('painting canceled');
        //     return;
        // }

        e.bottomCtx.save();

        // e.bottomCtx.rect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
        // e.bottomCtx.clip();

        const dpr = window.devicePixelRatio;
        
        // draw figure rectangle
        e.bottomCtx.lineWidth = 1 + Math.round(dpr);
        e.bottomCtx.strokeRect(r.x, r.y, r.w, r.h);

        var needRepaint = this.drawTicks(e);
        // console.log(needRepaint);

        e.bottomCtx.restore();

        // if (needRepaint) return;

        // backup the figure so that it can be reused later when repainting items
        


        // if (this._cancelPaining) {
        //     console.log('painting canceled');
        //     return;
        // }

        this.paintItems(e);

        // plot rectangle

        // console.time('paint');
        // console.log('paint');

        // if (this._cancelPaining) this._cancelPaining = false;

        // if (this._painting) {
        //     // cancel current paiting and start a new one
        //     this._cancelPaining = true;
        //     console.log('canceling painting');
        //     return;
        // }

        // this._painting = true;
        // this.paintAsync(e).then(() => {
        //     this._painting = false;
        // });

        // console.timeEnd('paint');
    }

    public drawTicks(e: IPaintEvent): boolean{  // r is Figure Rectangle, the frame
        e.bottomCtx.fillStyle = textColor;
        const dpr = window.devicePixelRatio;
        const va = this.axisAlignment === Orientation.Vertical;
        this.requiredMargin = {left: 0, right: 0, bottom: 0, top: 0};

        let [xticks, xticksVals, xMinors] = this.getTicks(this.xAxis);
        let [yticks, yticksVals, yMinors] = this.getTicks(this.yAxis);

        const _arr: [Axis, NumberArray][] = [[this.xAxis, xticksVals], [this.yAxis, yticksVals]];

        for (const [ax, vals] of _arr) {
            switch (ax.scale) {
                case 'lin': {
                    ax.displayedSignificantFigures = Math.max(2, ...vals.map(num => determineSigFigures(num)));
                    break;
                }
                case 'log': {
                    ax.displayedSignificantFigures = 1;
                    break;
                }
                case 'symlog': {
                    ax.displayedSignificantFigures = Math.max(2, ...vals.map(num => determineSigFigures(num)));
                    break;
                }
                default: {
                    if (!(ax.scale instanceof NumberArray)) {
                        throw new Error(`${ax.scale}: Not implemented`);
                    }
                    ax.displayedSignificantFigures = 4;
                }
            }
        }

        let xFigs = this.xAxis.displayedSignificantFigures;
        let yFigs = this.yAxis.displayedSignificantFigures;

        // estimate the number of significant figures to be plotted
        // let xdiff = xticksVals[1] - xticksVals[0];
        // let ydiff = yticksVals[1] - yticksVals[0];

        // let xmax = Math.max(Math.abs(xticksVals[0]), Math.abs(xticksVals[xticksVals.length - 1]));
        // let ymax = Math.max(Math.abs(yticksVals[0]), Math.abs(yticksVals[yticksVals.length - 1]));

        // let xFigs = Math.ceil(Math.log10(xmax / xdiff)) + 1;
        // let yFigs = Math.ceil(Math.log10(ymax / ydiff)) + 1;


        if (va){
            [xticks, yticks] = [yticks, xticks];  // swap the axes
            [xticksVals, yticksVals] = [yticksVals, xticksVals];  // swap the axes
            [xFigs, yFigs] = [yFigs, xFigs];
        }

        const tickSize = Math.round(5 + 4 * dpr);
        const minorTickSize = Math.round(2 + 2 * dpr);
        // const textOffset = 20;
        const fontSize = Math.round(8 + 9 * dpr);

        // draw x ticks

        const r = this.getEffectiveRect();

        let textMaxHeight = 0;
        this._ticksValuesFont = `${fontSize}px sans-serif`;

        e.bottomCtx.font = this._ticksValuesFont;
        e.bottomCtx.textAlign = 'center';  // vertical alignment
        e.bottomCtx.textBaseline = 'middle'; // horizontal alignment

        const _metrics = e.bottomCtx.measureText("M");
        let textOffset = _metrics.actualBoundingBoxAscent + _metrics.actualBoundingBoxDescent;
        // console.log(textOffset);



        e.bottomCtx.beginPath();

        for (let i = 0; i < xticks.length; i++) {
            let p = this.mapRange2Canvas((va) ? {x: 0, y: xticks[i]} : {x: xticks[i], y: 0});
    
            if (this.showTicks.includes('bottom')){
                e.bottomCtx.moveTo(p.x, r.y + r.h - tickSize);
                e.bottomCtx.lineTo(p.x, r.y + r.h);
            }
    
            if (this.showTicks.includes('top')){
                e.bottomCtx.moveTo(p.x, r.y);
                e.bottomCtx.lineTo(p.x, r.y + tickSize);
            }

            let text = `${formatNumber(xticksVals[i], xFigs)}`;
            let metrics = e.bottomCtx.measureText(text);
            let textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
            if (textMaxHeight < textHeight) {
                textMaxHeight = textHeight;
            }
    
            if (this.showTickNumbers.includes('bottom')){
                e.bottomCtx.fillText(text, p.x, r.y + r.h + textOffset);
            }
    
            if (this.showTickNumbers.includes('top')){
                e.bottomCtx.fillText(text, p.x, r.y - textOffset);
            }
        }
        e.bottomCtx.stroke();

        // draw x minor ticks
        e.bottomCtx.save();
        e.bottomCtx.lineWidth = 1;

        for (let i = 0; i < xMinors.length; i++) {
            let p = this.mapRange2Canvas((va) ? {x: 0, y: xMinors[i]} : {x: xMinors[i], y: 0});
    
            if (this.showTicks.includes('bottom')){
                e.bottomCtx.moveTo(p.x, r.y + r.h - minorTickSize);
                e.bottomCtx.lineTo(p.x, r.y + r.h);
            }
    
            if (this.showTicks.includes('top')){
                e.bottomCtx.moveTo(p.x, r.y);
                e.bottomCtx.lineTo(p.x, r.y + minorTickSize);
            }
        }
        e.bottomCtx.stroke();
        e.bottomCtx.restore();

        if (this.showTickNumbers.includes('bottom')){
            this.requiredMargin.bottom += textMaxHeight + textOffset;
        }

        if (this.showTickNumbers.includes('top')){
            this.requiredMargin.top += textMaxHeight + textOffset;
        }

        const xLabel = (va) ? this.yAxis.label : this.xAxis.label;
        const yLabel = (va) ? this.xAxis.label : this.yAxis.label;

        // draw axis labels
        if (xLabel !== "") {
            const midPointX = r.x + r.w / 2;
            e.bottomCtx.fillText(xLabel, midPointX, r.y + r.h + this.requiredMargin.bottom + textOffset);
            this.requiredMargin.bottom += textMaxHeight + textOffset;
        }

        // draw title labels
        if (this.title !== "") {
            const midPointX = r.x + r.w / 2;
            e.bottomCtx.fillText(this.title, midPointX, r.y - this.requiredMargin.top - textOffset);
            this.requiredMargin.top += textMaxHeight + textOffset;
        }
                
        // draw y ticks
        // textOffset /= 2;
        let textMaxWidth = 0;

        e.bottomCtx.beginPath();
        for (let i = 0; i < yticks.length; i++) {
            let p = this.mapRange2Canvas((va) ? {x:yticks[i], y: 0} : {x:0, y: yticks[i]});

            if (this.showTicks.includes('left')){
                e.bottomCtx.moveTo(r.x, p.y);
                e.bottomCtx.lineTo(r.x + tickSize, p.y);
            }

            if (this.showTicks.includes('right')){
                e.bottomCtx.moveTo(r.x + r.w, p.y);
                e.bottomCtx.lineTo(r.x + r.w - tickSize, p.y);
            }

            let text = `${formatNumber(yticksVals[i], yFigs)}`;
            let metrics = e.bottomCtx.measureText(text);
            let textWidth = metrics.width;
            // console.log(textWidth);
            if (textMaxWidth < textWidth) {
                textMaxWidth = textWidth;
            }

            if (this.showTickNumbers.includes('left')){
                e.bottomCtx.textAlign = 'right';
                e.bottomCtx.fillText(text, r.x - textOffset / 2, p.y);
            }

            if (this.showTickNumbers.includes('right')){
                e.bottomCtx.textAlign = 'left';
                e.bottomCtx.fillText(text, r.x + r.w + textOffset / 2, p.y);
            }
        }
        e.bottomCtx.stroke();

        // draw y minor ticks
        e.bottomCtx.save();
        e.bottomCtx.lineWidth = 1;

        for (let i = 0; i < yMinors.length; i++) {
            let p = this.mapRange2Canvas((va) ? {x:yMinors[i], y: 0} : {x:0, y: yMinors[i]});

            if (this.showTicks.includes('left')){
                e.bottomCtx.moveTo(r.x, p.y);
                e.bottomCtx.lineTo(r.x + minorTickSize, p.y);
            }

            if (this.showTicks.includes('right')){
                e.bottomCtx.moveTo(r.x + r.w, p.y);
                e.bottomCtx.lineTo(r.x + r.w - minorTickSize, p.y);
            }
        }
        e.bottomCtx.stroke();
        e.bottomCtx.restore();

        if (this.showTickNumbers.includes('left')){
            this.requiredMargin.left += textMaxWidth + textOffset / 2;
        }

        if (this.showTickNumbers.includes('right')){
            this.requiredMargin.right += textMaxWidth + textOffset / 2;
        }

        // draw axis labels
        if (yLabel !== "") {
            const midPointY = r.y + r.h / 2;
            e.bottomCtx.save();
            e.bottomCtx.textAlign = 'center';
            e.bottomCtx.translate(r.x - this.requiredMargin.left - textOffset, midPointY);
            e.bottomCtx.rotate(-Math.PI / 2);
            e.bottomCtx.fillText(yLabel, 0, 0);
            e.bottomCtx.restore();
            this.requiredMargin.left += textMaxWidth + textOffset;
        }

        if (this.colorbar) {
            this.requiredMargin.right += this.colorbar.canvasRect.w;
        }

        this.requiredMargin = {
            left: Math.max(this.requiredMargin.left, this.minimalMargin.left),
            right: Math.max(this.requiredMargin.right, this.minimalMargin.right),
            top: Math.max(this.requiredMargin.top, this.minimalMargin.top),
            bottom: Math.max(this.requiredMargin.bottom, this.minimalMargin.bottom)
        };

        let marginFromLinks: Margin = {left: 0, right: 0, top: 0, bottom: 0};
        for (const [fig, orientation] of this.marginLinks) {
            if (orientation === Orientation.Horizontal || orientation === Orientation.Both) {
                if (fig.requiredMargin.left > marginFromLinks.left) {
                    marginFromLinks.left = fig.requiredMargin.left;
                }
                if (fig.requiredMargin.right > marginFromLinks.right) {
                    marginFromLinks.right = fig.requiredMargin.right;
                }
            }

            if (orientation === Orientation.Vertical || orientation === Orientation.Both) {
                if (fig.requiredMargin.top > marginFromLinks.top) {
                    marginFromLinks.top = fig.requiredMargin.top;
                }
                if (fig.requiredMargin.bottom > marginFromLinks.bottom) {
                    marginFromLinks.bottom = fig.requiredMargin.bottom;
                }
            }
        }

        const newMargin: Margin = {
            left: Math.max(this.requiredMargin.left, marginFromLinks.left),
            right: Math.max(this.requiredMargin.right, marginFromLinks.right),
            top: Math.max(this.requiredMargin.top, marginFromLinks.top),
            bottom: Math.max(this.requiredMargin.bottom, marginFromLinks.bottom)
        }

        if (this.margin.left !== newMargin.left || 
            this.margin.right !== newMargin.right ||
            this.margin.top !== newMargin.top ||
            this.margin.bottom !== newMargin.bottom) {

            // console.log('margins are different');
            // this.setMargin(newMargin);
            this.margin = newMargin;
            this.repaint();
            return true;
        }

        return false;

    }

    // generates major and minor ticks and major ticks values on linear scale
    private genLinearTicks(coor: number, size: number, prefMajorBins: number): [NumberArray, NumberArray, NumberArray] {
        const scale = 10 ** Math.floor(Math.log10(Math.abs(size)));
        
        const extStepsScaled = NumberArray.fromArray([
            ...NumberArray.mul(this.steps, 0.01 * scale), 
            ...NumberArray.mul(this.steps, 0.1 * scale), 
            ...NumberArray.mul(this.steps, scale)]);
    
        const rawStep = size / prefMajorBins;
    
        //find the nearest value in the array
        const _idx = extStepsScaled.nearestIndex(rawStep);
        const step = extStepsScaled[_idx];
        const stepScale = 10 ** Math.floor(Math.log10(step));

        const k = (Math.round(step / stepScale) % 5 === 0) ? 2 : 1;

        const minorStep = extStepsScaled[_idx - k];

        const bestMin = Math.ceil(coor / step) * step;
        const bestMinMinor = Math.ceil(coor / minorStep) * minorStep;

        const nticks = 1 + (coor + size - bestMin) / step >> 0; // integer division
        const nticksMinors = 1 + (coor + size - bestMinMinor) / minorStep >> 0; // integer division

        const ticks = new NumberArray(nticks);
    
        // generate ticks
        for (let i = 0; i < nticks; i++) {
            ticks[i] = bestMin + step * i;
        }

        const minorTicks = new NumberArray();
        
        for (let i = 0; i < nticksMinors; i++) {
            const val = bestMinMinor + minorStep * i;
            if (ticks.includes(val)) continue;
            minorTicks.push(val);
        }

        return [ticks, ticks, minorTicks];
    }

    private genLogTicks(coor: number, size: number, prefMajorBins: number): [NumberArray, NumberArray, NumberArray] {
        const step = Math.max(1, Math.round(size / prefMajorBins));

        // make major ticks
        const bestMin = Math.ceil(coor / step) * step;
        const nticks = 1 + (coor + size - bestMin) >> 0; // integer division
        let majorTicks = new NumberArray(nticks);
        let majorTicksValues = new NumberArray(nticks);
    
        // generate ticks
        for (let i = 0; i < nticks; i++) {
            majorTicks[i] = bestMin + step * i;
            majorTicksValues[i] = 10 ** majorTicks[i];
        }

        let minorTicks = new NumberArray();
        const minorTicksPositions = [2, 3, 4, 5, 6, 7, 8, 9];

        if (step === 1) {
            // fill before first major tick
            
            let firstMajorTickValue = majorTicksValues[0];

            if (majorTicksValues.length === 0) {
                firstMajorTickValue = 10 ** Math.ceil(coor + size);
            }

            for (const v of minorTicksPositions) {
                const tick = Math.log10(0.1 * firstMajorTickValue * v);
                if (tick < coor) continue;
                minorTicks.push(tick);
            }

            for (const majorTickValue of majorTicksValues) {
                for (const v of minorTicksPositions) {
                    const tick = Math.log10(majorTickValue * v);
                    if (tick > coor + size) break;
                    minorTicks.push(tick);
                }
            }

            if (majorTicksValues.length === 0) {
                majorTicks = minorTicks.copy();
                majorTicksValues = NumberArray.fromArray(majorTicks.map(num => 10 ** num));
                minorTicks.clear();
            }
        }

        return [majorTicks, majorTicksValues, minorTicks];
    }

    // returns tuple of arrays, first is the x tick position on dummy linear axis
    // and second is actuall value of the tick
    // returns major ticks, major ticks values and minor ticks
    getTicks(axis: Axis): [NumberArray, NumberArray, NumberArray]{
        // calculate scale

        let coor: number, size: number, prefMajorBins: number, prefMinorBins: number;
        const f = 0.005;
        const fMinor = 0.05;
        const dpr = window.devicePixelRatio;
        let fx = f * 2;
        let fy = f * 3; // 2 times more preffered number of ticks on y axis then on x axis because of smaller text
        const r = this.getEffectiveRect();
        let w = r.w; 
        let h = r.h;
        const va = this.axisAlignment == Orientation.Vertical;
        if (va) {
            [w, h] = [h, w];
            [fx, fy] = [fy, fx];
        }
        if (axis.axisType === AxisType.xAxis) {
            coor = this.internalRange.x;
            size = this.internalRange.w;
            prefMajorBins = Math.max(Math.round(fx * w / dpr), 2);
            prefMinorBins = Math.round(w * fMinor);
        } else {
            coor = this.internalRange.y;
            size = this.internalRange.h;
            prefMajorBins = Math.max(Math.round(fy * h / dpr), 2);
            prefMinorBins = Math.round(h * fMinor);
        }

        switch (axis.scale) {
            case 'lin': {
                return this.genLinearTicks(coor, size, prefMajorBins);
            }
            case 'log': {
                return this.genLogTicks(coor, size, prefMajorBins);
            }
            case 'symlog': {
                const linScale = !(coor > axis.symlogLinthresh || coor + size < -axis.symlogLinthresh);
                const logScale = !(coor > -axis.symlogLinthresh && coor + size < axis.symlogLinthresh);
                const ticks = new NumberArray();
                const ticksValues = new NumberArray();
                const minorTicks = new NumberArray();

                if (linScale) {
                    const start = (coor < -axis.symlogLinthresh) ? -axis.symlogLinthresh : coor;
                    // const end = (coor + size > ax.symlogLinthresh) ? ax.symlogLinthresh : coor + size;
                    
                    // const linSize = end - start;
                    // const sizeRatio = linSize / size;
                    // const linPrefMajorBins = (axis === 'x') ? Math.max(Math.round((va ? 1.5 : 1) * w * sizeRatio * f), 2) : Math.max(Math.round((va ? 1 : 1.5) * h * sizeRatio * f), 2);
                    // console.log(linPrefMajorBins);

                    let [linTicks, linValues, linMinors] = this.genLinearTicks(start, size, prefMajorBins);
                    // remove ticks outside of the linear range
                    for (var i = 0; i < linTicks.length; i++) {
                        if (linTicks[i] > axis.symlogLinthresh) break; 
                    }
                    linTicks = linTicks.slice(0, i);
                    linValues = linValues.slice(0, i);

                    for (var i = 0; i < linMinors.length; i++) {
                        if (linMinors[i] > axis.symlogLinthresh) break; 
                    }
                    linMinors = linMinors.slice(0, i);

                    ticks.push(...linTicks);
                    ticksValues.push(...linValues);
                    minorTicks.push(...linMinors);
                }

                if (logScale) {
                    const axT = axis.transform;

                    var getTransformedTicks = (startValue: number, endValue: number): [NumberArray, NumberArray, NumberArray] => {

                        const start = Math.log10(axis.symlogLinthresh);
                        // const realStart = Math.max(ax.symlogLinthresh, coor);
                        // const start = Math.log10(axT(startValue));
                        const end = Math.log10(axT(endValue));
                        const logSize = end - start;
                        const factor = (endValue - axis.symlogLinthresh) / (endValue - startValue);

                        prefMajorBins = (axis.axisType === AxisType.xAxis) ? Math.max(Math.round(fx * w * factor), 2) : Math.max(Math.round(fy * h  * factor), 2)
                        
                        let [logTicks, logValues, logMinors] = this.genLogTicks(start, logSize, prefMajorBins);
                        let tr = (num: number) => axis.symlogLinthresh + (num - start) * axis.symlogLinthresh / axis.symlogLinscale;

                        logTicks.apply(tr);
                        logMinors.apply(tr);

                        // remove ticks before and after visible range

                        let idx = logTicks.nearestIndex(startValue);
                        idx = (logTicks[idx] > startValue) ? idx : idx + 1;
                        let idx2 = logTicks.nearestIndex(endValue);
                        idx2 = (logTicks[idx2] > endValue) ? idx2 : idx2 + 1;
                        logTicks = logTicks.slice(idx, idx2);
                        logValues = logValues.slice(idx, idx2);

                        idx = logMinors.nearestIndex(startValue);
                        idx = (logMinors[idx] > startValue) ? idx : idx + 1;
                        idx2 = logMinors.nearestIndex(endValue);
                        idx2 = (logMinors[idx2] > endValue) ? idx2 : idx2 + 1;
                        logMinors = logMinors.slice(idx, idx2);

                        return [logTicks, logValues, logMinors];

                    }

                    // for positive vals
                    if (coor + size > axis.symlogLinthresh) {
                        const [logTicks, logValues, logMinors] = getTransformedTicks(Math.max(coor, axis.symlogLinthresh), coor + size);
                        ticks.push(...logTicks);
                        ticksValues.push(...logValues);
                        minorTicks.push(...logMinors);
                    //     console.log(ticksValues);
                    }

                    // for negative vals
                    if (coor < -axis.symlogLinthresh) {
                        const [logTicks, logValues, logMinors] = getTransformedTicks(-Math.min(coor + size, -axis.symlogLinthresh), -coor);
                        ticks.push(...logTicks.mul(-1));
                        ticksValues.push(...logValues.mul(-1));
                        minorTicks.push(...logMinors.mul(-1));
                    }
                }
        
                return [ticks, ticksValues, minorTicks];

            }
            default: {  
                if (!(axis.scale instanceof NumberArray)) {
                    throw new Error("Not implemented");
                }
                // data bound

                const step = Math.max(1, Math.round(size / prefMajorBins));
                const minorStep = Math.max(1, Math.round(size / prefMinorBins));

                const bestMin = Math.ceil(coor / step) * step;
                const bestMinMinor = Math.ceil(coor / minorStep) * minorStep;

                const nticks = 1 + (coor + size - bestMin) / step >> 0; // integer division
                const nticksMinors = 1 + (coor + size - bestMinMinor) / minorStep >> 0; // integer division

                const ticks = new NumberArray(nticks);
                const ticksValues = new NumberArray(nticks);
                
                // generate ticks
                for (let i = 0; i < nticks; i++) {
                    ticks[i] = bestMin + step * i;
                    ticksValues[i] = axis.scale[ticks[i]] ?? Number.NaN;
                }
                
                const minorTicks = new NumberArray();
                
                for (let i = 0; i < nticksMinors; i++) {
                    const val = bestMinMinor + minorStep * i;
                    if (ticks.includes(val)) continue;
                    minorTicks.push(val);
                }
                // console.log(minorTicks.length, nticksMinors);

                return [ticks, ticksValues, minorTicks];
            }
        }
    }
}


export class Colorbar extends Figure {

    private _colormap: Colormap;
    private readonly _width: number = 20;  // with of the colorbar (effective rectagle) in px

    public offScreenCanvas: OffscreenCanvas;
    protected offScreenCanvasCtx: OffscreenCanvasRenderingContext2D | null;
    private parentCanvasRect: Rect;
    // private heatmapList: HeatMap[] = [];

    private cWidth = 1;
    private cHeight = 500; // 500 pixels to draw the colormap
    private lastMargin: Margin;

    constructor(figure: Figure, canvasRect?: Rect, colormap?: Colormap) {
        super(figure, {x:0, y:0, w:0, h:0});
        this._colormap = (colormap === undefined) ? new Colormap(Colormaps.symgrad) : colormap;
        this.parentCanvasRect = {...figure.canvasRect};

        this.offScreenCanvas = new OffscreenCanvas(this.cWidth, this.cHeight);
        this.offScreenCanvasCtx = this.offScreenCanvas.getContext('2d');
        if (this.offScreenCanvasCtx === null) {
            throw new Error('this.offScreenCanvasCtx === null');
        }
        
        this.yAxis.inverted = false;
        this.xAxis.inverted = false;
        this.showTicks = ['right'];
        this.showTickNumbers = ['right'];
        this.xAxis.viewBounds = [0, 1];
        this.xAxis.scale = 'lin';
        this.yAxis.viewBounds = [-Number.MAX_VALUE, +Number.MAX_VALUE];
        this.yAxis.scale = 'lin';
        this.yAxis.keepCentered = true;
        this.items = [];
        this.linePlots = [];
        this.lastMargin = this.margin;
        this.renderColorbar();
    }

    get width() {
        return this._width * window.devicePixelRatio;
    }

    get colormap() {
        return this._colormap;
    }

    // TODO include transform
    set colormap(colormap: Colormap) {
        // var inv = this._colormap.inverted;
        this._colormap = colormap;
        // this._colormap.inverted = inv;
        this.renderColorbar();
        this.renderHeatmap();
        this.repaintFigure();
    }

    // public addColorbar(colormap?: Colormap | undefined): Colorbar {
    //     // do nothing
    // }

    public setHeatmapTransform() {
        if (!this.heatmap) return;

        const yIT = this.yAxis.invTransform;
        this.heatmap.transform = (zVal: number) => {
            const _rng = this.yAxis.internalRange;

            return (yIT(zVal) - _rng[0]) / _rng[1];
        };
    }

    public linkHeatMap(heatmap: HeatMap) {
        if (this.heatmap !== heatmap) {
            this.heatmap = heatmap;
            this.heatmap.colorbar = this;
            heatmap.colormap = this.colormap; // link the colormap of the colorbar to that of heatmap
            this.setHeatmapTransform();

            // set range that corresponds to colorbar

            const m = heatmap.dataset.data;
            const extreme = Math.max(Math.abs(m.min()), Math.abs(m.max()));
            this.yAxis.range = [-extreme, 2 + extreme];
            this.rangeChanged(this.internalRange);
        }
    }

    private getTargetWidth() {
        return this.margin.left + this.width + this.margin.right;
    }

    public setCanvasRect(cr: Rect): void {
        this.parentCanvasRect = cr;

        // console.log(cr, "setCanvasRect colorbar")

        // cr is parent canvas rectangle

        const thisCR: Rect = {
            x: cr.x + cr.w - this.getTargetWidth(),
            y: cr.y,
            w: this.getTargetWidth(),
            h: cr.h
        }

        super.setCanvasRect(thisCR);
    }

    public renderColorbar() {
        if (!this.offScreenCanvasCtx) return;

        const w = this.cWidth;
        const h = this.cHeight;

        // console.log("rendering colorbar")

        var iData = new ImageData(w, h);

        // C-contiguous buffer
        for(let row = 0; row < h; row++) {
            const rowIdx = h - row - 1;
            const z = rowIdx / (h - 1);
            const rgba = this.colormap.getColor(z);

            for(let col = 0; col < w; col++) {
                const pos = (row * w + col) * 4;        // position in buffer based on x and y

                iData.data[pos] = rgba[0];              // some R value [0, 255]
                iData.data[pos+1] = rgba[1];              // some G value
                iData.data[pos+2] = rgba[2];              // some B value
                iData.data[pos+3] = rgba[3];              // set alpha channel
            }
        }

        this.offScreenCanvasCtx.putImageData(iData, 0, 0);
    }

    public setMargin(m: Margin): void {
        //
    }

    // paint the colorbar
    protected paintHeatMap(e: IPaintEvent): void {
        if (this.offScreenCanvas.width === 0 || this.offScreenCanvas.height === 0) return;

        e.bottomCtx.save();
        e.bottomCtx.imageSmoothingEnabled = true;

        // paint colorbar here
        const r = this.getEffectiveRect();
        e.bottomCtx.drawImage(this.offScreenCanvas, 
        0, 0, this.cWidth, this.cHeight,
        r.x, r.y, r.w, r.h);
        e.bottomCtx.restore();
        // console.log(this.margin, this.parent?.margin);
    }

    protected paintItems(e: IPaintEvent): void {
        // do nothing
    }

    // public mouseDown(e: IMouseEvent): void {
    //     console.log('mouse down');
    //     super.mouseDown(e);
    // }

    protected setContextMenu(): void {
        this.contextMenu = new ColorbarContextMenu(this);
    }
    
    public repaint(): void {
        (this.parent as Figure).repaintItems();
    }

    public repaintFigure() {
        (this.parent as Figure).repaint();
    }

    public renderHeatmap() {
        this.heatmap?.recalculateImage();
    }

    public viewAll(): void {
        if (!this.heatmap) return;
        const rng = this.range;
        const m = this.heatmap.dataset.data;
        const extreme = Math.max(Math.abs(m.min()), Math.abs(m.max()));
        this.range = {x: rng.x, w: rng.w, y: -extreme, h: 2 * extreme};
        this.rangeChanged(this.internalRange);
    }

    public rangeChanged(range: Rect): void {
        super.rangeChanged(range);

        var f = this.parent as Figure;
        if (f.panning || f.scaling) return;

        let repaint = false;

        if (this.margin.left !== this.lastMargin.left || 
            this.margin.right !== this.lastMargin.right ||
            this.margin.top !== this.lastMargin.top ||
            this.margin.bottom !== this.lastMargin.bottom) {

            // recalculate canvas rect according to new margin

            this.setCanvasRect(this.parentCanvasRect);
            this.lastMargin = this.margin;
            repaint = true;
        }

        if (this.heatmap){
            this.heatmap.zRange = this.yAxis.range;
            this.heatmap.recalculateImage();
            repaint = true;
        }

        if (repaint) f.repaint();

    }


}