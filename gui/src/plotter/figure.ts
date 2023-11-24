
import { DraggableLines, GraphicObject, IMouseEvent, IPaintEvent, Orientation } from "./object";
import { Rect, NumberArray, Point, Margin, Matrix } from "./types";
import { backgroundColor, fontSizeLabels, fontSizeNumbers, frameColor, textColor } from "./settings";
import { Dataset, determineSigFigures, formatNumber } from "./utils";
import { Colormap, IColorMap } from "./colormap";
import { HeatMap } from "./heatmap";

interface IFigureSettings {
    xAxis: {
        label: string,
        scale: string | NumberArray,  // lin, log, symlog, numberarray - scale is determined from the data
        viewBounds: number[],   // bounds of view or [x0, x1]
        autoscale: boolean,
        inverted: boolean
    },
    yAxis: {
        label: string,
        scale: string | NumberArray,  // lin, log, symlog, data
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
    
    public steps: NumberArray; 
    public heatmap: HeatMap | null = null;
    
    private xRangeLinks: Figure[] = [];
    private yRangeLinks: Figure[] = [];
    private xyRangeLinks: Figure[] = [];
    private yxRangeLinks: Figure[] = [];

    private marginLinks: ([Figure, Orientation])[] = [];
    public xAxisSigFigures: number = 2;
    public yAxisSigFigures: number = 2;

    public requiredMargin: Margin;
    
    // private fields
    
    private _range: Rect;  // in case of scale of data, the range will be just indexes of data it is bound to

    private lastMouseDownPos: Point;
    private lastRange: Rect;
    private linePlots: Array<ILinePlot> = [];

    private panning: boolean = false;
    private scaling: boolean = false;
    private lastCenterPoint: Point;
    private _preventPanning: boolean = false;
    private _preventScaling: boolean = false;

    private plotCanvasRect = false;
    public minimalMargin: Margin = { 
        left: 10,
        right: 10,
        top: 10,
        bottom: 10
    };
    
    // public draggableLines: DraggableLines | null = null;

    constructor(parent: GraphicObject, canvasRect?: Rect, margin?: Margin) {
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
    }

    public setViewBounds(xAxisBounds?: [number, number], yAxisBounds?: [number, number]) {
        if (xAxisBounds) {
            this.figureSettings.xAxis.viewBounds = [this.invTransform(xAxisBounds[0], 'x'), this.invTransform(xAxisBounds[1], 'x')];
        }

        if (yAxisBounds) {
            this.figureSettings.yAxis.viewBounds = [this.invTransform(yAxisBounds[0], 'y'), this.invTransform(yAxisBounds[1], 'y')];
        }
    }

    get range() {
        let x, y, w, h;

        if (this.figureSettings.xAxis.scale instanceof NumberArray) {
            let x0Idx = (this._range.x < 0) ? 0 : Math.floor(this._range.x);
            x = this.figureSettings.xAxis.scale[x0Idx];
            let x1Idx = (x0Idx + this._range.w > this.figureSettings.xAxis.scale.length - 1) ? this.figureSettings.xAxis.scale.length - 1 : Math.floor(x0Idx + this._range.w);
            w = this.figureSettings.xAxis.scale[x1Idx] - x;
        } else {
            x = this._range.x;
            w = this._range.w;
        }

        if (this.figureSettings.yAxis.scale instanceof NumberArray) {
            let y0Idx = (this._range.y < 0) ? 0 : Math.floor(this._range.y);
            y = this.figureSettings.yAxis.scale[y0Idx];    
            let y1Idx = (y0Idx + this._range.h > this.figureSettings.yAxis.scale.length - 1) ? this.figureSettings.yAxis.scale.length - 1 : Math.floor(y0Idx + this._range.h);
            h = this.figureSettings.yAxis.scale[y1Idx] - y;
        } else {
            y = this._range.y;
            h = this._range.h;
        }

        let rng: Rect = {x, y, w, h};
        return rng;
    }

    public getInternalRange() {
        return this._range;
    }

    set range(newRange: Rect) {
        // TODO change
        this._range = newRange;
    }

    public mapCanvas2Range(p: Point): Point{
        let r = this.effRect;
        let xrel = (p.x - r.x) / r.w;
        let yrel = (p.y - r.y) / r.h;

        if (this.figureSettings.axisAlignment === 'vertical') {
            xrel = this.figureSettings.yAxis.inverted ? xrel : 1 - xrel;
            yrel = this.figureSettings.xAxis.inverted ? yrel : 1 - yrel;  // y axis is inverted in default
            return {
                x: this._range.x + yrel * this._range.w,
                y: this._range.y + xrel * this._range.h
            }
        } else {
            xrel = this.figureSettings.xAxis.inverted ? 1 - xrel : xrel;
            yrel = this.figureSettings.yAxis.inverted ? yrel : 1 - yrel;  // y axis is inverted in default
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

        xrel = this.figureSettings.xAxis.inverted ? 1 - xrel : xrel;
        yrel = this.figureSettings.yAxis.inverted ? yrel : 1 - yrel;  // y axis is inverted in default

        if (this.figureSettings.axisAlignment === 'vertical') {
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
            let lastPos = {x: e.e.clientX, y: e.e.clientY};
            let va = this.figureSettings.axisAlignment === 'vertical';

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
                    
                    let xSign = this.figureSettings.xAxis.inverted ? 1 : -1;
                    let ySign = this.figureSettings.yAxis.inverted ? -1 : 1;
        
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
            fig._range.x = this._range.x;
            fig._range.w = this._range.w;
            fig.repaint();
        }
        for (const fig of this.yRangeLinks) {
            fig._range.y = this._range.y;
            fig._range.h = this._range.h;
            fig.repaint();
        }
        for (const fig of this.xyRangeLinks) {
            fig._range.y = this._range.x;
            fig._range.h = this._range.w;
            fig.repaint();
        }
        for (const fig of this.yxRangeLinks) {
            fig._range.x = this._range.y;
            fig._range.w = this._range.h;
            fig.repaint();
        }
        // console.log(this.range);
        super.rangeChanged(range);
        this.repaint();
    }

    // public resize(): void {
    //     for (const item of this.items) {
    //         item.canvasRect =
    //     }
    // }

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

    public plotHeatmap(dataset: Dataset, colormap: IColorMap = Colormap.symgrad ): HeatMap {
        this.heatmap = new HeatMap(this, dataset, colormap);

        let x, y, h, w;

        // let xdiff, ydiff, xOffset, yOffset;

        // x axis

        if (!this.heatmap.isXRegular) {
            this.figureSettings.xAxis.scale = dataset.x;
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
            this.figureSettings.xAxis.scale = 'lin';

        }

        // y axis

        if (!this.heatmap.isYRegular) {
            this.figureSettings.yAxis.scale = dataset.y;
            y = 0;
            h = dataset.y.length - 1;
            // ydiff = 1;
            // yOffset = 0;
            // this.figureSettings.yAxis.viewBounds = [y, h];
        } else {
            y = dataset.y[0];
            h = dataset.y[dataset.y.length - 1] - y;
            this.figureSettings.yAxis.scale = 'lin';
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
        if (this.figureSettings.yAxis.autoscale) {
            let mins = [];
            let maxs = [];
            for (const plot of this.linePlots) {
                let [min, max] = plot.y.minmax();
                mins.push(min);
                maxs.push(max);
            }
            let y0 = this.invTransform(Math.min(...mins), 'y');
            let y1 = this.invTransform(Math.max(...maxs), 'y');

            let diff = y1 - y0;

            if (!this.heatmap) {
                this._range.y = y0 - fy * diff;
                this._range.h = diff * (1 + 2 * fy);
            }
        }

        if (this.figureSettings.xAxis.autoscale) {
            let x0 = this.invTransform(Math.min(...this.linePlots.map(p => p.x[0])), 'x');
            let x1 = this.invTransform(Math.min(...this.linePlots.map(p => p.x[p.x.length - 1])), 'x');

            let diff = x1 - x0;

            if (!this.heatmap) {
                this._range.x = x0 - fx * diff;
                this._range.w = diff * (1 + 2 * fx);
            }
        }
    }

    // transforms from dummy axis value to real value
    public transform(num: number, axis: string) {
        let axisScale = (axis === 'x') ? this.figureSettings.xAxis.scale : this.figureSettings.yAxis.scale
        switch (axisScale) {
            case 'lin': {
                return num;
            }
            case 'log': {
                return 10 ** num;
            }                
            case 'symlog': {
                throw new Error('Not implemented');
            }
            default: // for data bound scale
                if (!(axisScale instanceof NumberArray)) {
                    throw new Error("Not implemented");
                }
                return axisScale[Math.min(axisScale.length - 1, Math.max(0, Math.round(num)))];
        }
    }

    // transforms from real data to dummy axis value
    public invTransform(num: number, axis: string) {
        let axisScale = (axis === 'x') ? this.figureSettings.xAxis.scale : this.figureSettings.yAxis.scale
        switch (axisScale) {
            case 'lin': {
                return num;
            }
            case 'log': {
                return Math.log10(num);
            }                
            case 'symlog': {
                throw new Error('Not implemented');
            }
            default: // for data bound scale
                if (!(axisScale instanceof NumberArray)) {
                    throw new Error("Not implemented");
                }
                return axisScale.nearestIndex(num);
        }
    }


    private paintPlots(e: IPaintEvent) {
        if (this.linePlots.length < 1) {
            return;
        }

        this.autoscale();

        e.ctx.save();

        // the speed was almost the same as for the above case
        for (const plot of this.linePlots) {

            e.ctx.beginPath();

            let usei = false; // in case the scale is determined by data
            let x0;
            if (this.figureSettings.xAxis.scale instanceof NumberArray && plot.x.length === this.figureSettings.xAxis.scale.length) {
                usei = true;
                x0 = 0;
            } else {
                x0 = this.invTransform(plot.x[0], 'x');
            }

            let p0 = this.mapRange2Canvas({x: x0, y: this.invTransform(plot.y[0], 'y')});
            e.ctx.moveTo(p0.x, p0.y);

            for (let i = 1; i < plot.x.length; i++) {
                let p = this.mapRange2Canvas({x: (usei) ? i : this.invTransform(plot.x[i], 'x'), y: this.invTransform(plot.y[i], 'y')});
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

        // console.time('paint');

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

        // paint all additional graphics objects if necessary
        // update the canvas and margins for other items
        for (const item of this.items) {
            item.canvasRect = {...this.canvasRect};
            item.margin = {...this.margin};
        }
        super.paint(e);

        e.ctx.restore();
        
        e.ctx.save();

        e.ctx.rect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
        e.ctx.clip();
        
        // draw figure rectangle
        e.ctx.lineWidth = 3;
        e.ctx.strokeRect(this.effRect.x, this.effRect.y, this.effRect.w, this.effRect.h);
        this.drawTicks(e);

        e.ctx.restore();

        // console.timeEnd('paint');

        // this.ctx.restore();

        // this.ctx.save();


    }

    public drawTicks(e: IPaintEvent){  // r is Figure Rectangle, the frame
        e.ctx.fillStyle = textColor;
        let va = this.figureSettings.axisAlignment === 'vertical';
        this.requiredMargin = {left: 0, right: 0, bottom: 0, top: 0};

        // let pr = window.devicePixelRatio;

        let [xticks, xticksVals] = this.genMajorTicks('x');
        let [yticks, yticksVals] = this.genMajorTicks('y');

        if (this.figureSettings.xAxis.scale instanceof NumberArray) {
            this.xAxisSigFigures = 4;
        } else {
            this.xAxisSigFigures = Math.max(2, ...xticksVals.map(num => determineSigFigures(num)));
        }

        if (this.figureSettings.yAxis.scale instanceof NumberArray) {
            this.yAxisSigFigures = 4;
        } else {
            this.yAxisSigFigures = Math.max(2, ...yticksVals.map(num => determineSigFigures(num)));
        }

        if (this.figureSettings.xAxis.scale === 'log') {
            this.xAxisSigFigures = 1;
        }

        if (this.figureSettings.yAxis.scale === 'log') {
            this.yAxisSigFigures = 1;
        }

        let xFigs = this.xAxisSigFigures;
        let yFigs = this.yAxisSigFigures;

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

        let tickSize = 15;
        let textOffset = 20;

        // draw x ticks

        let r = this.effRect;

        let textMaxHeight = 0;

        e.ctx.font = "25px sans-serif";
        e.ctx.textAlign = 'center';  // vertical alignment
        e.ctx.textBaseline = 'middle'; // horizontal alignment
        e.ctx.beginPath();

        for (let i = 0; i < xticks.length; i++) {
            let p = this.mapRange2Canvas((va) ? {x: 0, y: xticks[i]} : {x: xticks[i], y: 0});
    
            if (this.figureSettings.showTicks.includes('bottom')){
                e.ctx.moveTo(p.x, r.y + r.h - tickSize);
                e.ctx.lineTo(p.x, r.y + r.h);
            }
    
            if (this.figureSettings.showTicks.includes('top')){
                e.ctx.moveTo(p.x, r.y);
                e.ctx.lineTo(p.x, r.y + tickSize);
            }

            let text = `${formatNumber(xticksVals[i], xFigs)}`;
            let metrics = e.ctx.measureText(text);
            let textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
            if (textMaxHeight < textHeight) {
                textMaxHeight = textHeight;
            }
    
            if (this.figureSettings.showTickNumbers.includes('bottom')){
                e.ctx.fillText(text, p.x, r.y + r.h + textOffset);
            }
    
            if (this.figureSettings.showTickNumbers.includes('top')){
                e.ctx.fillText(text, p.x, r.y - textOffset);
            }
        }
        e.ctx.stroke();

        if (this.figureSettings.showTickNumbers.includes('bottom')){
            this.requiredMargin.bottom += textMaxHeight + textOffset;
        }

        if (this.figureSettings.showTickNumbers.includes('top')){
            this.requiredMargin.top += textMaxHeight + textOffset;
        }

        const xLabel = (va) ? this.figureSettings.yAxis.label : this.figureSettings.xAxis.label;
        const yLabel = (va) ? this.figureSettings.xAxis.label : this.figureSettings.yAxis.label;

        // draw axis labels
        if (xLabel !== "") {
            const midPointX = r.x + r.w / 2;
            e.ctx.fillText(xLabel, midPointX, r.y + r.h + this.requiredMargin.bottom + textOffset);
            this.requiredMargin.bottom += textMaxHeight + textOffset;
        }
                
    
        // draw y ticks

        let textMaxWidth = 0;

        e.ctx.beginPath();
        for (let i = 0; i < yticks.length; i++) {
            let p = this.mapRange2Canvas((va) ? {x:yticks[i], y: 0} : {x:0, y: yticks[i]});

            if (this.figureSettings.showTicks.includes('left')){
                e.ctx.moveTo(r.x, p.y);
                e.ctx.lineTo(r.x + tickSize, p.y);
            }

            if (this.figureSettings.showTicks.includes('right')){
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

            if (this.figureSettings.showTickNumbers.includes('left')){
                e.ctx.textAlign = 'right';
                e.ctx.fillText(text, r.x - textOffset, p.y);
            }

            if (this.figureSettings.showTickNumbers.includes('right')){
                e.ctx.textAlign = 'left';
                e.ctx.fillText(text, r.x + r.w + textOffset, p.y);
            }
        }
        e.ctx.stroke();

        if (this.figureSettings.showTickNumbers.includes('left')){
            this.requiredMargin.left += textMaxWidth + textOffset;
        }

        if (this.figureSettings.showTickNumbers.includes('right')){
            this.requiredMargin.right += textMaxWidth + textOffset;
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
    genMajorTicks(axis: string): [NumberArray, NumberArray]{
        // calculate scale

        let coor, size, scaleType, prefferedNBins;
        const f = 0.005;
        let w = this.effRect.w;
        let h = this.effRect.h;
        if (this.figureSettings.axisAlignment == 'vertical') {
            [w, h] = [h, w];
        }
        if (axis === 'x') {
            coor = this._range.x;
            size = this._range.w;
            scaleType = this.figureSettings.xAxis.scale;
            prefferedNBins = Math.max(Math.round(w * f), 2);
        } else {
            coor = this._range.y;
            size = this._range.h;
            scaleType = this.figureSettings.yAxis.scale;
            prefferedNBins = Math.max(Math.round(h * f), 2);
        }

        switch (scaleType) {
            case 'lin': {
                const scale = 10 ** Math.trunc(Math.log10(Math.abs(size)));
        
                const extStepsScaled = NumberArray.fromArray([
                    ...NumberArray.mul(this.steps, 0.01 * scale), 
                    ...NumberArray.mul(this.steps, 0.1 * scale), 
                    ...NumberArray.mul(this.steps, scale)]);
            
                const rawStep = size / prefferedNBins;
            
                //find the nearest value in the array
                const step = extStepsScaled.nearestValue(rawStep);
                const bestMin = Math.ceil(coor / step) * step;
            
                const nticks = 1 + (coor + size - bestMin) / step >> 0; // integer division
                const ticks = new NumberArray(nticks);
            
                // generate ticks
                for (let i = 0; i < nticks; i++) {
                    ticks[i] = bestMin + step * i;
                }
        
                return [ticks, ticks];
            }
            case 'log': {
                let fillMinors = size * 11 <= prefferedNBins * 2;

                // make major ticks
                const bestMin = Math.ceil(coor);
                const nticks = 1 + (coor + size - bestMin) >> 0; // integer division
                const ticks = new NumberArray(nticks);
                const ticksValues = new NumberArray(nticks);
            
                // generate ticks
                for (let i = 0; i < nticks; i++) {
                    ticks[i] = bestMin + i;
                    ticksValues[i] = 10 ** ticks[i];
                }
                // console.log(fillMinors, ticks, ticksValues);
                
                return [ticks, ticksValues];
            }
            case 'symlog': {
                throw new Error("Not implemented");

            }
            default: {  
                if (!(scaleType instanceof NumberArray)) {
                    throw new Error("Not implemented");
                }
                // data bound

                const step = Math.max(1, Math.round(size / prefferedNBins));
                const bestMin = Math.ceil(coor / step) * step;

                const nticks = 1 + (coor + size - bestMin) / step >> 0; // integer division
                const ticks = new NumberArray(nticks);
                const ticksValues = new NumberArray(nticks);
            
                // generate ticks
                for (let i = 0; i < nticks; i++) {
                    ticks[i] = bestMin + step * i;
                    let val = scaleType[ticks[i]];
                    ticksValues[i] = (val === undefined) ? Number.NaN : val;
                }
                return [ticks, ticksValues];
            }
        }
    }


}