
import { GraphicObject, IMouseEvent, IPaintEvent} from "./object";
import { Rect, NumberArray, Point, Margin, Matrix } from "./types";
import { backgroundColor, fontSizeLabels, fontSizeNumbers, frameColor, textColor } from "./settings";
import { Dataset, determineSigFigures, formatNumber } from "./utils";
import { Colormap, IColorMap } from "./colormap";
import { HeatMap } from "./heatmap";
import { DraggableLines, Orientation } from "./draggableLines";

// interface IFigureSettings {
//     xAxis: {
//         label: string,
//         scale: string | NumberArray,  // lin, log, symlog, numberarray - scale is determined from the data
//         viewBounds: number[],   // bounds of view or [x0, x1]
//         autoscale: boolean,
//         inverted: boolean,
//         symlogLinthresh: number, // Defines the range (-x, x), within which the plot is linear.
//         symlogLinscale: number  // number of decades to use for each half of the linear range
//     },
//     yAxis: {
//         label: string,
//         scale: string | NumberArray,  // lin, log, symlog, data
//         viewBounds: number[],   // bounds of view or [x0, x1]
//         autoscale: boolean,
//         inverted: boolean,
//         symlogLinthresh: number, // Defines the range (-x, x), within which the plot is linear.
//         symlogLinscale: number  // number of decades to use for each half of the linear range
//     },
//     title: string,
//     showTicks: string[],        // ['top', 'bottom', 'left', 'right']
//     showTickNumbers: string[],  // ['top', 'bottom', 'left', 'right']
//     axisAlignment: string,   // // could be vertical

// }

interface ILinePlot {
    x: NumberArray,
    y: NumberArray,
    color: string,
    ld: number[],  // line dash, exmaple [4, 2], no dash: []
    lw: number,  // line width
    zValue: number
}

export class Axis {

    public label: string;
    public scale: string | NumberArray;  // lin, log, symlog, data provided as NumberArray
    public viewBounds: [number, number];   // bounds of view or [x0, x1]
    public autoscale: boolean;
    public inverted: boolean;
    public symlogLinthresh: number; // Defines the range (-x, x), within which the plot is linear.
    public symlogLinscale: number;  // number of decades to use for each half of the linear range
    public displayedSignificantFigures: number = 2;

    constructor (label?: string, scale?: string | NumberArray, viewBounds?: [number, number],
        autoscale?: boolean, inverted?: boolean, symlogLinthresh?: number, symlogLinscale?: number) {
            this.label = label ?? '';
            this.scale = scale ?? 'lin';
            this.viewBounds = viewBounds ?? [-Number.MAX_VALUE, Number.MAX_VALUE];
            this.autoscale = autoscale ?? true;
            this.inverted = inverted ?? false;
            this.symlogLinscale = symlogLinscale ?? 1;
            this.symlogLinthresh = symlogLinthresh ?? 1;
    }

    // transforms from dummy axis value to real value
    public getTransform(): (num: number) => number {
        switch (this.scale) {
            case 'lin': {
                return (num: number) => num;
            }
            case 'log': {
                return (num: number) => 10 ** num;
            }                
            case 'symlog': {
                const linthresh = this.symlogLinthresh;
                const linscale = this.symlogLinscale;

                return (num: number) => {
                    // linear scale
                    if (Math.abs(num) <= linthresh) {
                        return num;
                    } else { // log scale
                        const sign = num >= 0 ? 1 : -1;
                        return sign * linthresh * 10 ** (linscale * (Math.abs(num) / linthresh - 1));
                    }
                };
            }
            default: // for data bound scale
                const scale = this.scale;
                if (!(scale instanceof NumberArray)) {
                    throw new Error("Not implemented");
                }

                return (num: number) =>  {
                    return scale[Math.min(this.scale.length - 1, Math.max(0, Math.round(num)))];
                };
        }
    }

    // transforms from real data to dummy axis value
    public getInverseTransform(): (num: number) => number {
        switch (this.scale) {
            case 'lin': {
                return (num: number) => num;
            }
            case 'log': {
                return (num: number) => Math.log10(num);
            }                
            case 'symlog': {
                const linthresh = this.symlogLinthresh;
                const linscale = this.symlogLinscale;

                return (num: number) => {
                    // linear scale
                    if (Math.abs(num) <= linthresh) {
                        return num;
                    } else {
                        const sign = num >= 0 ? 1 : -1;
                        return sign * linthresh * (1 + Math.log10(Math.abs(num) / linthresh) / linscale);
                    }
                };
            }
            default: // for data bound scale
                const scale = this.scale;
                if (!(scale instanceof NumberArray)) {
                    throw new Error("Not implemented");
                }

                return (num: number) =>  {
                    return scale.nearestIndex(num);
                };    
        }
    }
}

export class Figure extends GraphicObject {

    // public figureSettings: IFigureSettings = {
    //     xAxis: {
    //         label: '',
    //         scale: 'lin', 
    //         viewBounds: [-Number.MAX_VALUE, Number.MAX_VALUE],
    //         autoscale: false,
    //         inverted: false,
    //         symlogLinthresh: 1,
    //         symlogLinscale: 1
    //     },
    //     yAxis: {
    //         label: '',
    //         scale: 'lin',
    //         viewBounds: [-Number.MAX_VALUE, Number.MAX_VALUE],
    //         autoscale: true,
    //         inverted: false,
    //         symlogLinthresh: 1,
    //         symlogLinscale: 1
    //     },
    //     title: '',
    //     showTicks: ['left', 'right', 'bottom', 'top'],        // ['top', 'bottom', 'left', 'right']
    //     showTickNumbers: ['left', 'right', 'bottom', 'top'],  // ['top', 'bottom', 'left', 'right']
    //     axisAlignment: 'horizontal',   // could be vertical
    // }

    public title: string = '';
    public showTicks: string[] =  ['left', 'right', 'bottom', 'top'];        // ['top', 'bottom', 'left', 'right']
    public showTickNumbers: string[] =  ['left', 'right', 'bottom', 'top'];  // ['top', 'bottom', 'left', 'right']
    public axisAlignment: Orientation = Orientation.Horizontal;   // could be vertical

    public xAxis: Axis;
    public yAxis: Axis;
    
    public steps: NumberArray; 
    public heatmap: HeatMap | null = null;
    
    // public xAxisSigFigures: number = 2;
    // public yAxisSigFigures: number = 2;
    private _ticksValuesFont: string = '10 ps sans-serif';

    public requiredMargin: Margin; // last margin required by paining the figure
    
    // private fields
    
    private _range: Rect;  // in case of scale of data, the range will be just indexes of data it is bound to

    private lastMouseDownPos: Point;
    private lastRange: Rect;
    private linePlots: Array<ILinePlot> = [];

    private xRangeLinks: Figure[] = [];
    private yRangeLinks: Figure[] = [];
    private xyRangeLinks: Figure[] = [];
    private yxRangeLinks: Figure[] = [];

    private marginLinks: ([Figure, Orientation])[] = [];

    private panning: boolean = false;
    private scaling: boolean = false;
    private lastCenterPoint: Point;
    private _preventPanning: boolean = false;
    private _preventScaling: boolean = false;

    private offScreenCanvas: OffscreenCanvas;
    private offScreenCanvasCtx: OffscreenCanvasRenderingContext2D | null;

    private plotCanvasRect = false;
    public minimalMargin: Margin = { 
        left: 10,
        right: 10,
        top: 10,
        bottom: 10
    };
    
    // public draggableLines: DraggableLines | null = null;

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
        this._range = {x: -1, y: -1, w: 2, h: 2};
        this.steps = NumberArray.fromArray([1, 2, 2.5, 5]);
        // this.steps = NumberArray.fromArray([1, 2, 5]);
        this.lastMouseDownPos = {x: 0, y: 0};
        this.lastRange = {...this._range};

        // this.figureSettings.xAxis.viewBounds = [-1e5, 1e5];
        // this.figureSettings.yAxis.viewBounds = [-1e5, 1e5];
        this.lastCenterPoint = {x: 0, y: 0};
        this.offScreenCanvas = new OffscreenCanvas(this.canvasRect.w, this.canvasRect.h);
        this.offScreenCanvasCtx = this.offScreenCanvas.getContext('2d');
        if (this.offScreenCanvasCtx === null) {
            throw new Error('this.offScreenCanvasCtx === null');
        }
        this.xAxis = new Axis();
        this.yAxis = new Axis();
    }

    // public resize(): void {
    //     super.resize();

    // }

    public setCanvasRect(cr: Rect): void {
        super.setCanvasRect(cr);
        this.offScreenCanvas.width = this.canvasRect.w;
        this.offScreenCanvas.height = this.canvasRect.h;
        for (const item of this.items) {
            item.canvasRect = {...this.canvasRect};
            // item.margin = {...this.margin};
        }
    }



    public setViewBounds(xAxisBounds?: [number, number], yAxisBounds?: [number, number]) {
        if (xAxisBounds) {
            const xIT = this.xAxis.getInverseTransform();
            this.xAxis.viewBounds = [xIT(xAxisBounds[0]), xIT(xAxisBounds[1])];
        }

        if (yAxisBounds) {
            const yIT = this.yAxis.getInverseTransform();
            this.yAxis.viewBounds = [yIT(yAxisBounds[0]), yIT(yAxisBounds[1])];
        }
    }

    get range() {
        const xT = this.xAxis.getTransform();
        const yT = this.yAxis.getTransform();

        const x = xT(this._range.x);
        const y = yT(this._range.y);

        return {
            x,
            y,
            w: xT(this._range.x + this._range.w) - x,
            h: yT(this._range.y + this._range.h) - y,
        }
    }

    set range(newRange: Rect) {
        const xIT = this.xAxis.getInverseTransform();
        const yIT = this.yAxis.getInverseTransform();

        const x = xIT(newRange.x);
        const y = yIT(newRange.y);

        this._range = {
            x,
            y,
            w: xIT(newRange.x + newRange.w) - x,
            h: yIT(newRange.y + newRange.h) - y,
        }
    }

    public getInternalRange() {
        return this._range;
    }


    public mapCanvas2Range(p: Point): Point{
        let r = this.effRect;
        let xrel = (p.x - r.x) / r.w;
        let yrel = (p.y - r.y) / r.h;

        if (this.axisAlignment === Orientation.Vertical) {
            xrel = this.yAxis.inverted ? xrel : 1 - xrel;
            yrel = this.xAxis.inverted ? yrel : 1 - yrel;  // y axis is inverted in default
            return {
                x: this._range.x + yrel * this._range.w,
                y: this._range.y + xrel * this._range.h
            }
        } else {
            xrel = this.xAxis.inverted ? 1 - xrel : xrel;
            yrel = this.yAxis.inverted ? yrel : 1 - yrel;  // y axis is inverted in default
            return {
                x: this._range.x + xrel * this._range.w,
                y: this._range.y + yrel * this._range.h
            }
        }
    }

    public mapRange2Canvas(p: Point): Point{
        // rewrite for vertical-aligned axis
        let r = this.effRect;
        let xrel = (p.x - this._range.x) / this._range.w;
        let yrel = (p.y - this._range.y) / this._range.h;

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

    // public mapRange2CanvasArr(xvals: NumberArray, yvals: NumberArray): [NumberArray, NumberArray]{
    //     if (xvals.length !== yvals.length){
    //         throw TypeError("Different length of input arrays");
    //     }
    //     var newX = new NumberArray(xvals.length)
    //     var newY = new NumberArray(xvals.length);
    //     let r = this.figureRect;

    //     for (let i = 0; i < xvals.length; i++) {
    //         let xScaled = (xvals[i] - this._range.x) / this._range.w;
    //         let yScaled = (yvals[i] - this._range.y) / this._range.h;

    //         newX[i] = r.x + xScaled * r.w;
    //         newY[i] = r.y + (1 - yScaled) * r.h;
    //     }
    //     return [newX, newY];
    // }

    // gets the canvas Rect of the figure frame


    public preventMouseEvents(preventScaling?: boolean, preventPanning?: boolean) {
        if (preventScaling !== undefined) {
            this._preventScaling = preventScaling;

        }
        if (preventPanning !== undefined) {
            this._preventPanning = preventPanning;
        }
    }

    public mouseDown(e: IMouseEvent): void {
        if (!this.canvas)
            return;

        this.calcEffectiveRect();

        // // we are outside of figure frame
        // if (!this.isInsideEffRect(x, y))
        //     return;

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
            this.scaling = e.e.button == 2;
            this.panning = e.e.button == 0 || e.e.button == 1;
        }

        this.lastMouseDownPos = {x: e.x, y: e.y};
        this.lastRange = {...this._range};
        
        this.lastCenterPoint = this.mapCanvas2Range(this.lastMouseDownPos);

        if (this.panning) {
            this.canvas.style.cursor = this.cursors.grabbing;
        } else if (this.scaling) {
            this.canvas.style.cursor = this.cursors.move;
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
        
                    let w = this.effRect.w;
                    let h = this.effRect.h;
                    
                    let xSign = this.xAxis.inverted ? 1 : -1;
                    let ySign = this.yAxis.inverted ? -1 : 1;
        
                    if (va) {
                        [w, h] = [h, w];
                        xSign *= -1;
                    }
        
                    let xRatio = this.lastRange.w / w;
                    let yRatio = this.lastRange.h / h;
        
                    let newRect: Rect = {
                        x: this.lastRange.x + xSign * dist.x * xRatio, 
                        y: this.lastRange.y + ySign * dist.y * yRatio,
                        w: this.lastRange.w,
                        h: this.lastRange.h
                    };
        
                    this._range = this.getBoundedRange(newRect, true);
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
        
                    this._range = this.getBoundedRange(newRect, false);
                    rangeChanged = true;
                }

                if (rangeChanged){
                    this.rangeChanged(this._range);

                }
            }

            var mouseup = (e: MouseEvent) => {
                window.removeEventListener('mousemove', mousemove);
                window.removeEventListener('mouseup', mouseup);
                if  (this.canvas) {
                    this.canvas.style.cursor = this.cursors.crosshair;
                }

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
            if (x0 === this.xAxis.viewBounds[0]){
                retRect.w = rect.w;
            }
            if (x1 === this.xAxis.viewBounds[1]){
                retRect.w = rect.w;
                retRect.x = x1 - rect.w;
            }
            if (y0 === this.yAxis.viewBounds[0]){
                retRect.h = rect.h;
            }
            if (y1 === this.yAxis.viewBounds[1]){
                retRect.h = rect.h;
                retRect.y = y1 - rect.h;
            }
        }

        return retRect;
    }

    public rangeChanged(range: Rect): void {
        this.xAxis.autoscale = false;
        this.yAxis.autoscale = false;
        for (const fig of this.xRangeLinks) {
            if (this.xAxis.scale === fig.xAxis.scale) {
                fig._range.x = this._range.x;
                fig._range.w = this._range.w;
            } else {
                const r = this.range;
                const fr = fig.range;
                fig.range = {x: r.x, y: fr.y, w: r.w, h: fr.h};
            }
            fig.repaint();
        }
        for (const fig of this.yRangeLinks) {
            if (this.yAxis.scale === fig.yAxis.scale) {
                fig._range.y = this._range.y;
                fig._range.h = this._range.h;
            } else {
                const r = this.range;
                const fr = fig.range;
                fig.range = {x: fr.x, y: r.y, w: fr.w, h: r.h};
            }
            fig.repaint();
        }
        for (const fig of this.xyRangeLinks) {
            if (this.xAxis.scale === fig.yAxis.scale) {
                fig._range.y = this._range.x;
                fig._range.h = this._range.w;
            } else {
                const r = this.range;
                const fr = fig.range;
                fig.range = {x: fr.x, y: r.x, w: fr.w, h: r.w};
            }
            fig.repaint();
        }
        for (const fig of this.yxRangeLinks) {
            if (this.yAxis.scale === fig.xAxis.scale) {
                fig._range.x = this._range.y;
                fig._range.w = this._range.h;
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
        if (!this.canvas)
            return

        // console.log('Mouse move from figure');
        

        // let [x, y] = [e.offsetX * window.devicePixelRatio, e.offsetY * window.devicePixelRatio];

        if (this.panning || this.scaling) {
            return;
        }
        
        if (this._preventPanning || this._preventScaling) {
            super.mouseMove(e);
        }
        
        if (this._preventPanning && this._preventScaling) {
            return;
        }
        


        // let isInside = this.isInsideFigureRect(e.offsetX, e.offsetY);

        // if (isInside)
        //     this.canvas.style.cursor = this.cursors.default;

        

        // if (isInside)
        //     console.log(this.panning, this.scaling);

        // for handling hovering
        super.mouseMove(e);
        // if (!this.panning && !this.scaling) {
        // }
    }

    mouseUp(e: IMouseEvent): void {
        if (this._preventPanning || this._preventScaling) {
            super.mouseUp(e);
        }

        this.panning = false;
        this.scaling = false;

        if (this.canvas)
            this.canvas.style.cursor = this.cursors.crosshair;
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

    public plotHeatmap(dataset: Dataset, colormap: IColorMap = Colormap.symgrad ): HeatMap {
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

        this._range = {x, y, w, h};

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

        // if the axis is not regular, the image will spread from 0 to x.length, the same for y
        let x0 = this.heatmap.isXRegular ? x[0] : 0;
        let y0 = this.heatmap.isYRegular ? y[0] : 0;

        let x1 = this.heatmap.isXRegular ? x[x.length - 1] : x.length - 1;
        let y1 = this.heatmap.isYRegular ? y[y.length - 1] : y.length - 1;

        // for evenly spaced data
        let xdiff = (x1 - x0) / (x.length - 1);
        let ydiff = (y1 - y0) / (y.length - 1);

        // console.log(x0, y0, w, h);
        // console.log(this.heatmap.isXRegular, this.heatmap.isYRegular);

        let p0 = this.mapRange2Canvas({x: x0 - xdiff / 2, y: y0 - ydiff / 2});
        let p1 = this.mapRange2Canvas({x: x1 + xdiff / 2, y: y1 + ydiff / 2});

        e.ctx.drawImage(this.heatmap.imageBitmap, 
        0, 0, this.heatmap.width(), this.heatmap.height(),
        p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);

        // console.log('Heatmap paint');

    }

    private autoscale() {
        // autoscale

        let fy = 0.1;  // autoscale margins
        let fx = 0.05;  // autoscale margins

        // TODO include heatmap ranges
        if (this.yAxis.autoscale) {
            const yIT = this.yAxis.getInverseTransform();
            let mins = [];
            let maxs = [];
            for (const plot of this.linePlots) {
                let [min, max] = plot.y.minmax();
                mins.push(min);
                maxs.push(max);
            }
            let y0 = yIT(Math.min(...mins));
            let y1 = yIT(Math.max(...maxs));

            let diff = y1 - y0;

            if (!this.heatmap) {
                this._range.y = y0 - fy * diff;
                this._range.h = diff * (1 + 2 * fy);
            }
        }

        if (this.xAxis.autoscale) {
            const xIT = this.xAxis.getInverseTransform();
            let x0 = xIT(Math.min(...this.linePlots.map(p => p.x[0])));
            let x1 = xIT(Math.min(...this.linePlots.map(p => p.x[p.x.length - 1])));

            let diff = x1 - x0;

            if (!this.heatmap) {
                this._range.x = x0 - fx * diff;
                this._range.w = diff * (1 + 2 * fx);
            }
        }
    }


    private paintPlots(e: IPaintEvent) {
        if (this.linePlots.length < 1) {
            return;
        }

        this.autoscale();

        e.ctx.save();

        const yIT = this.yAxis.getInverseTransform();
        const xIT = this.xAxis.getInverseTransform();

        // the speed was almost the same as for the above case
        for (const plot of this.linePlots) {

            e.ctx.beginPath();

            let xDataScale = false; // in case the scale is determined by data
            let x0;
            if (this.xAxis.scale instanceof NumberArray && plot.x.length === this.xAxis.scale.length) {
                xDataScale = true;
                x0 = 0;
            } else {
                x0 = xIT(plot.x[0]);
            }

            let p0 = this.mapRange2Canvas({x: x0, y: yIT(plot.y[0])});
            e.ctx.moveTo(p0.x, p0.y);

            for (let i = 1; i < plot.x.length; i++) {
                let p = this.mapRange2Canvas({x: (xDataScale) ? i : xIT(plot.x[i]), y: yIT(plot.y[i])});
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

    private draw2OffScreenCanvas() {
        if (!this.offScreenCanvasCtx || !this.canvas) return;

        const w = this.canvasRect.w;
        const h = this.canvasRect.h;

        this.offScreenCanvasCtx.drawImage(this.canvas, 
            this.canvasRect.x, this.canvasRect.y, w, h,
            0, 0, w, h);
    }

    public repaintItems() {
        // https://stackoverflow.com/questions/4532166/how-to-capture-a-section-of-a-canvas-to-a-bitmap

        // console.time('repaintItems');
        if (!this.offScreenCanvasCtx || !this.ctx || !this.offScreenCanvas || !this.canvas) return;

        const w = this.canvasRect.w;
        const h = this.canvasRect.h;

        const e: IPaintEvent = {canvas: this.canvas, ctx: this.ctx};

        e.ctx.drawImage(this.offScreenCanvas, 
            0, 0, w, h,
            this.canvasRect.x, this.canvasRect.y, w, h);
        
        this.paintItems(e);
        // console.timeEnd('repaintItems');
    }

    private paintItems(e: IPaintEvent) {
        // paint all additional graphics objects if necessary
        // update the canvas and margins for other items

        super.paint(e);
    }

    paint(e: IPaintEvent): void {
        // plot rectangle

        // console.time('paint');

        for (const item of this.items) {
            item.canvasRect = {...this.canvasRect};
            item.margin = {...this.margin};
        }

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

        // paint everything inside the plot

        //plot content
        e.ctx.rect(this.effRect.x, this.effRect.y, this.effRect.w, this.effRect.h);
        e.ctx.clip();

        this.paintHeatMap(e);
        this.paintPlots(e);

        

        e.ctx.restore();
        
        
        e.ctx.save();

        // e.ctx.rect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
        // e.ctx.clip();

        const dpr = window.devicePixelRatio;
        
        // draw figure rectangle
        e.ctx.lineWidth = 1 + Math.round(dpr);
        e.ctx.strokeRect(this.effRect.x, this.effRect.y, this.effRect.w, this.effRect.h);

        this.drawTicks(e);

        // backup the figure so that it can be reused later when repainting items
        
        e.ctx.restore();

        this.draw2OffScreenCanvas();

        this.paintItems(e);
        


        // console.timeEnd('paint');
    }

    public drawTicks(e: IPaintEvent){  // r is Figure Rectangle, the frame
        e.ctx.fillStyle = textColor;
        const dpr = window.devicePixelRatio;
        const va = this.axisAlignment === Orientation.Vertical;
        this.requiredMargin = {left: 0, right: 0, bottom: 0, top: 0};

        // let pr = window.devicePixelRatio;

        let [xticks, xticksVals, xMinors] = this.getTicks('x');
        let [yticks, yticksVals, yMinors] = this.getTicks('y');

        if (this.xAxis.scale instanceof NumberArray) {
            this.xAxis.displayedSignificantFigures = 4;
        } else {
            this.xAxis.displayedSignificantFigures = Math.max(2, ...xticksVals.map(num => determineSigFigures(num)));
        }

        if (this.yAxis.scale instanceof NumberArray) {
            this.yAxis.displayedSignificantFigures = 4;
        } else {
            this.yAxis.displayedSignificantFigures = Math.max(2, ...yticksVals.map(num => determineSigFigures(num)));
        }

        if (this.xAxis.scale === 'log') {
            this.xAxis.displayedSignificantFigures = 1;
        }

        if (this.yAxis.scale === 'log') {
            this.yAxis.displayedSignificantFigures = 1;
        }

        if (this.xAxis.scale === 'symlog') {
            this.xAxis.displayedSignificantFigures = 3;
        }

        if (this.yAxis.scale === 'symlog') {
            this.yAxis.displayedSignificantFigures = 3;
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

        const r = this.effRect;

        let textMaxHeight = 0;
        this._ticksValuesFont = `${fontSize}px sans-serif`;

        e.ctx.font = this._ticksValuesFont;
        e.ctx.textAlign = 'center';  // vertical alignment
        e.ctx.textBaseline = 'middle'; // horizontal alignment

        const _metrics = e.ctx.measureText("M");
        let textOffset = _metrics.actualBoundingBoxAscent + _metrics.actualBoundingBoxDescent;
        // console.log(textOffset);

        e.ctx.beginPath();

        for (let i = 0; i < xticks.length; i++) {
            let p = this.mapRange2Canvas((va) ? {x: 0, y: xticks[i]} : {x: xticks[i], y: 0});
    
            if (this.showTicks.includes('bottom')){
                e.ctx.moveTo(p.x, r.y + r.h - tickSize);
                e.ctx.lineTo(p.x, r.y + r.h);
            }
    
            if (this.showTicks.includes('top')){
                e.ctx.moveTo(p.x, r.y);
                e.ctx.lineTo(p.x, r.y + tickSize);
            }

            let text = `${formatNumber(xticksVals[i], xFigs)}`;
            let metrics = e.ctx.measureText(text);
            let textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
            if (textMaxHeight < textHeight) {
                textMaxHeight = textHeight;
            }
    
            if (this.showTickNumbers.includes('bottom')){
                e.ctx.fillText(text, p.x, r.y + r.h + textOffset);
            }
    
            if (this.showTickNumbers.includes('top')){
                e.ctx.fillText(text, p.x, r.y - textOffset);
            }
        }
        e.ctx.stroke();

        // draw x minor ticks
        e.ctx.save();
        e.ctx.lineWidth = 1;

        for (let i = 0; i < xMinors.length; i++) {
            let p = this.mapRange2Canvas((va) ? {x: 0, y: xMinors[i]} : {x: xMinors[i], y: 0});
    
            if (this.showTicks.includes('bottom')){
                e.ctx.moveTo(p.x, r.y + r.h - minorTickSize);
                e.ctx.lineTo(p.x, r.y + r.h);
            }
    
            if (this.showTicks.includes('top')){
                e.ctx.moveTo(p.x, r.y);
                e.ctx.lineTo(p.x, r.y + minorTickSize);
            }
        }
        e.ctx.stroke();
        e.ctx.restore();

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
            e.ctx.fillText(xLabel, midPointX, r.y + r.h + this.requiredMargin.bottom + textOffset);
            this.requiredMargin.bottom += textMaxHeight + textOffset;
        }
                
        // draw y ticks
        // textOffset /= 2;
        let textMaxWidth = 0;

        e.ctx.beginPath();
        for (let i = 0; i < yticks.length; i++) {
            let p = this.mapRange2Canvas((va) ? {x:yticks[i], y: 0} : {x:0, y: yticks[i]});

            if (this.showTicks.includes('left')){
                e.ctx.moveTo(r.x, p.y);
                e.ctx.lineTo(r.x + tickSize, p.y);
            }

            if (this.showTicks.includes('right')){
                e.ctx.moveTo(r.x + r.w, p.y);
                e.ctx.lineTo(r.x + r.w - tickSize, p.y);
            }

            let text = `${formatNumber(yticksVals[i], yFigs)}`;
            let metrics = e.ctx.measureText(text);
            let textWidth = metrics.width;
            // console.log(textWidth);
            if (textMaxWidth < textWidth) {
                textMaxWidth = textWidth;
            }

            if (this.showTickNumbers.includes('left')){
                e.ctx.textAlign = 'right';
                e.ctx.fillText(text, r.x - textOffset / 2, p.y);
            }

            if (this.showTickNumbers.includes('right')){
                e.ctx.textAlign = 'left';
                e.ctx.fillText(text, r.x + r.w + textOffset / 2, p.y);
            }
        }
        e.ctx.stroke();

        // draw y minor ticks
        e.ctx.save();
        e.ctx.lineWidth = 1;

        for (let i = 0; i < yMinors.length; i++) {
            let p = this.mapRange2Canvas((va) ? {x:yMinors[i], y: 0} : {x:0, y: yMinors[i]});

            if (this.showTicks.includes('left')){
                e.ctx.moveTo(r.x, p.y);
                e.ctx.lineTo(r.x + minorTickSize, p.y);
            }

            if (this.showTicks.includes('right')){
                e.ctx.moveTo(r.x + r.w, p.y);
                e.ctx.lineTo(r.x + r.w - minorTickSize, p.y);
            }
        }
        e.ctx.stroke();
        e.ctx.restore();

        if (this.showTickNumbers.includes('left')){
            this.requiredMargin.left += textMaxWidth + textOffset / 2;
        }

        if (this.showTickNumbers.includes('right')){
            this.requiredMargin.right += textMaxWidth + textOffset / 2;
        }

        // draw axis labels
        if (yLabel !== "") {
            const midPointY = r.y + r.h / 2;
            e.ctx.save();
            e.ctx.textAlign = 'center';
            e.ctx.translate(r.x - this.requiredMargin.left - textOffset, midPointY);
            e.ctx.rotate(-Math.PI / 2);
            e.ctx.fillText(yLabel, 0, 0);
            e.ctx.restore();
            this.requiredMargin.left += textMaxWidth + textOffset;
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
            this.margin = newMargin;
            this.calcEffectiveRect();
            // this.repaint();
        }

    }

    // returns tuple of arrays, first is the x tick position on dummy linear axis
    // and second is actuall value of the tick
    // returns major ticks, major ticks values and minor ticks
    getTicks(axis: string): [NumberArray, NumberArray, NumberArray]{
        // calculate scale

        let coor, size, scaleType, prefMajorBins, prefMinorBins, ax;
        const f = 0.005;
        const fMinor = 0.05;
        let w = this.effRect.w;
        let h = this.effRect.h;
        const va = this.axisAlignment == Orientation.Vertical;
        if (va) {
            [w, h] = [h, w];
        }
        if (axis === 'x') {
            ax = this.xAxis;
            coor = this._range.x;
            size = this._range.w;
            prefMajorBins = Math.max(Math.round((va ? 1.5 : 1) * w * f), 2);
            prefMinorBins = Math.round(w * fMinor);
        } else {
            ax = this.yAxis;
            coor = this._range.y;
            size = this._range.h;
            prefMajorBins = Math.max(Math.round((va ? 1 : 1.5) * h * f), 2);
            prefMinorBins = Math.round(h * fMinor);
        }
        scaleType = ax.scale;

        switch (scaleType) {
            case 'lin': {
                const scale = 10 ** Math.trunc(Math.log10(Math.abs(size)));
        
                const extStepsScaled = NumberArray.fromArray([
                    ...NumberArray.mul(this.steps, 0.01 * scale), 
                    ...NumberArray.mul(this.steps, 0.1 * scale), 
                    ...NumberArray.mul(this.steps, scale)]);
            
                const rawStep = size / prefMajorBins;
            
                //find the nearest value in the array
                const step = extStepsScaled.nearestValue(rawStep);
                const bestMin = Math.ceil(coor / step) * step;
            
                const nticks = 1 + (coor + size - bestMin) / step >> 0; // integer division
                const ticks = new NumberArray(nticks);
            
                // generate ticks
                for (let i = 0; i < nticks; i++) {
                    ticks[i] = bestMin + step * i;
                }

                const minorTicks = NumberArray.linspace(-1, 1, 20);
        
                return [ticks, ticks, minorTicks];
            }
            case 'log': {
                let fillMinors = size * 11 <= prefMajorBins * 2;

                const step = Math.max(1, Math.round(size / prefMajorBins));

                // make major ticks
                const bestMin = Math.ceil(coor / step) * step;
                const nticks = 1 + (coor + size - bestMin) >> 0; // integer division
                const majorTicks = new NumberArray(nticks);
                const majorTicksValues = new NumberArray(nticks);
            
                // generate ticks
                for (let i = 0; i < nticks; i++) {
                    majorTicks[i] = bestMin + step * i;
                    majorTicksValues[i] = 10 ** majorTicks[i];
                }
                // console.log(fillMinors, ticks, ticksValues);

                const minorTicks = new NumberArray();
                
                return [majorTicks, majorTicksValues, minorTicks];
            }
            case 'symlog': {
                const scale = 10 ** Math.trunc(Math.log10(Math.abs(size)));
        
                const extStepsScaled = NumberArray.fromArray([
                    ...NumberArray.mul(this.steps, 0.01 * scale), 
                    ...NumberArray.mul(this.steps, 0.1 * scale), 
                    ...NumberArray.mul(this.steps, scale)]);
            
                const rawStep = size / prefMajorBins;
            
                //find the nearest value in the array
                const step = extStepsScaled.nearestValue(rawStep);
                const bestMin = Math.ceil(coor / step) * step;
            
                const nticks = 1 + (coor + size - bestMin) / step >> 0; // integer division
                const ticks = new NumberArray(nticks);
                const ticksValues = new NumberArray(nticks);

                var T = ax.getTransform()
            
                // generate ticks
                for (let i = 0; i < nticks; i++) {
                    ticks[i] = bestMin + step * i;
                    ticksValues[i] = T(ticks[i])
                }

                const minorTicks = new NumberArray();
        
                return [ticks, ticksValues, minorTicks];

            }
            default: {  
                if (!(scaleType instanceof NumberArray)) {
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
                    ticksValues[i] = scaleType[ticks[i]] ?? Number.NaN;
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