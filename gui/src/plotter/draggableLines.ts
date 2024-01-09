import { Figure } from "./figure/figure";
import { GraphicObject, IMouseEvent, IPaintEvent } from "./object";
import { Point, Rect } from "./types";
import { drawTextWithGlow, formatNumber } from "./utils";


export enum Orientation {
    Horizontal,
    Vertical,
    Both,
    None
}

export interface IPositionChangedEvent {
    internalPosition: Point,
    realPosition: Point,
    xChanged: boolean,
    yChanged: boolean
}

interface IStickGrid {
    xdiff: number, 
    xOffset: number, 
    ydiff: number,
     yOffset: number
}

export class DraggableLines extends GraphicObject {

    static readonly Orientation: typeof Orientation = Orientation;

    public orientation: Orientation; // or vertical or both for cross
    public position: Point;
    // private lastMouseDownPos: Point;
    private lastPosition: Point;

    public onHoverColor: string = "black";
    public color: string = "grey";
    public stickToData: boolean = true; // change position event is fired only when the position belongs to another data point
    public stickGrid: IStickGrid | null = null; // internal position stick grid

    public showText: boolean = true;
    public textPosition: number = 20;  // in pixels from the left/top
    // public textFont: string = "25px sans-serif";  //default is 10px sans-serif
    public textSignificantFigures: number = 3;

    private verticalHovering: boolean = false;
    private horizontalHovering: boolean = false;

    private verticalDragging: boolean = false;
    private horizontalDragging: boolean = false;
    private positionChangedListeners: ((position: IPositionChangedEvent) => void)[] = [];

    private xLinks: DraggableLines[] = [];
    private yLinks: DraggableLines[] = [];
    private xyLinks: DraggableLines[] = [];
    private yxLinks: DraggableLines[] = [];


    constructor(parent: Figure, orientation: Orientation = Orientation.Vertical) {
        super(parent);
        this.orientation = orientation;
        const rng = parent.internalRange;
        this.position = {x: rng.x + rng.w / 2, y: rng.y + rng.h / 2};
        // this.lastMouseDownPos = {x: 0, y: 0};
        this.lastPosition = {...this.position};
        // this.setStickGrid(10, 3, 10, 4);
    }

    public linkX(line: DraggableLines) {
        if (line === this && this.xLinks.includes(line)) {
            return;
        }

        line.xLinks.push(this);
        this.xLinks.push(line);
    }

    public linkY(line: DraggableLines) {
        if (line === this && this.yLinks.includes(line)) {
            return;
        }

        line.yLinks.push(this);
        this.yLinks.push(line);
    }

    public linkXY(line: DraggableLines) {
        if (line === this && this.xyLinks.includes(line)) {
            return;
        }

        line.yxLinks.push(this);
        this.xyLinks.push(line);
    }

    public linkYX(line: DraggableLines) {
        if (line === this && this.yxLinks.includes(line)) {
            return;
        }

        line.xyLinks.push(this);
        this.yxLinks.push(line);
    }

    public unlinkAllX(){
        for (const line of this.xLinks) {
            const idx = line.xLinks.indexOf(this);
            line.xLinks.splice(idx);
        }
        this.xLinks = [];
    }

    public unlinkAllY(){
        for (const line of this.yLinks) {
            const idx = line.yLinks.indexOf(this);
            line.yLinks.splice(idx);
        }
        this.yLinks = [];
    }

    public unlinkAllXY(){
        for (const line of this.xyLinks) {
            const idx = line.yxLinks.indexOf(this);
            line.yxLinks.splice(idx);
        }
        this.xyLinks = [];
    }

    public unlinkAllYX(){
        for (const line of this.yxLinks) {
            const idx = line.xyLinks.indexOf(this);
            line.xyLinks.splice(idx);
        }
        this.yxLinks = [];
    }

    public unlinkX(line: DraggableLines) {
        if (line === this) {
            return;
        }
        let idx = line.xLinks.indexOf(this);
        line.xLinks.splice(idx);

        idx = this.xLinks.indexOf(line);
        this.xLinks.splice(idx);
    }

    public unlinkY(line: DraggableLines) {
        if (line === this) {
            return;
        }
        let idx = line.yLinks.indexOf(this);
        line.yLinks.splice(idx);

        idx = this.yLinks.indexOf(line);
        this.yLinks.splice(idx);
    }

    public unlinkXY(line: DraggableLines) {
        if (line === this) {
            return;
        }
        let idx = line.yxLinks.indexOf(this);
        line.yxLinks.splice(idx);

        idx = this.xyLinks.indexOf(line);
        this.xyLinks.splice(idx);
    }

    public unlinkYX(line: DraggableLines) {
        if (line === this) {
            return;
        }
        let idx = line.xyLinks.indexOf(this);
        line.xyLinks.splice(idx);

        idx = this.yxLinks.indexOf(line);
        this.yxLinks.splice(idx);
    }

    public setStickGrid(xdiff: number, xOffset: number, ydiff: number, yOffset: number) {
        this.stickGrid = {xdiff, xOffset, ydiff, yOffset};
    }

    mouseDown(e: IMouseEvent): void {
        if (e.e.button !== 0) {
            return;
        }
        
        this.verticalDragging = this.verticalHovering;
        this.horizontalDragging = this.horizontalHovering;
        // this.lastMouseDownPos = {x: e.x, y: e.y};
        this.lastPosition = {...this.position};

        if (this.horizontalDragging || this.verticalDragging) {
            const f = this.parent as Figure;
            const va = f.axisAlignment === Orientation.Vertical;
            f.preventMouseEvents(true, true); // to prevent to change the cursor while dragging
            const lastPos = {x: e.e.clientX, y: e.e.clientY};

            const mousemove = (e: MouseEvent) => {
                // console.time('mousemove');
                let dist: Point = {
                    x: window.devicePixelRatio * (e.x - lastPos.x),
                    y: window.devicePixelRatio * (e.y - lastPos.y)
                }
    
                if (va) {
                    dist = {x: dist.y, y: dist.x};
                }

                const r = f.getEffectiveRect();
    
                let w = r.w;
                let h = r.h;
    
                let xSign = f.xAxis.inverted ? -1 : 1;
                let ySign = f.yAxis.inverted ? 1 : -1;
    
                if (va) {
                    [w, h] = [h, w];
                    xSign *= -1;
                }

                const rng = f.internalRange;
    
                let xRatio = rng.w / w;
                let yRatio = rng.h / h;
    
                // let pos = {
                //     x: ((va) ? this.horizontalDragging : this.verticalDragging) ? this.lastPosition.x + xSign * dist.x * xRatio : this.lastPosition.x,
                //     y: ((va) ? this.verticalDragging : this.horizontalDragging) ? this.lastPosition.y + ySign * dist.y * yRatio : this.lastPosition.y
                // }
                let pos = {
                    x: this.verticalDragging ? this.lastPosition.x + xSign * dist.x * xRatio : this.lastPosition.x,
                    y: this.horizontalDragging ? this.lastPosition.y + ySign * dist.y * yRatio : this.lastPosition.y
                }

                pos.x = Math.max(rng.x, Math.min(pos.x, rng.x + rng.w));
                pos.y = Math.max(rng.y, Math.min(pos.y, rng.y + rng.h));
    
                if (this.stickGrid && this.stickToData) {
    
                    let xnum = Math.round((pos.x - this.stickGrid.xOffset) / this.stickGrid.xdiff);
                    let ynum = Math.round((pos.y - this.stickGrid.yOffset) / this.stickGrid.ydiff);
    
                    let newPos = {
                        x: xnum * this.stickGrid.xdiff + this.stickGrid.xOffset,
                        y: ynum * this.stickGrid.ydiff + this.stickGrid.yOffset
                    }

                    const xChanged = newPos.x !== this.position.x;
                    const yChanged = newPos.y !== this.position.y;
    
                    if (xChanged || yChanged) {
                        this.position = newPos;
                        this.positionChanged(xChanged, yChanged);
                        f.repaintItems();
                    }
                } else {
                    const xChanged = pos.x !== this.position.x;
                    const yChanged = pos.y !== this.position.y;
                    this.position = pos;
                    this.positionChanged(xChanged, yChanged);
                    f.repaintItems();
                }
                // console.timeEnd('mousemove');

            }

            var mouseup = (e: MouseEvent) => {
                window.removeEventListener('mousemove', mousemove);
                window.removeEventListener('mouseup', mouseup);
            }

            window.addEventListener('mousemove', mousemove);
            window.addEventListener('mouseup', mouseup);
        }

    }

    public mouseUp(e: IMouseEvent): void {
        this.verticalDragging = false;
        this.horizontalDragging = false;
        (this.parent as Figure).preventMouseEvents(false, false);
    }

    public positionChanged(xChanged: boolean, yChanged: boolean) {
        const f = this.parent as Figure;
        const xT = f.xAxis.transform;
        const yT = f.yAxis.transform;

        for (const line of this.xLinks) {
            const lf = line.parent as Figure;
            if (lf.xAxis.scale === f.xAxis.scale) {
                line.position.x = this.position.x;
            } else {
                line.position.x = lf.xAxis.invTransform(xT(this.position.x));
            }
            line.fireEvent(true, false);
            lf.repaintItems();
        }
        for (const line of this.yLinks) {
            const lf = line.parent as Figure;
            if (lf.yAxis.scale === f.yAxis.scale) {
                line.position.y = this.position.y;
            } else {
                line.position.y = lf.yAxis.invTransform(yT(this.position.y));
            }
            line.fireEvent(false, true);
            lf.repaintItems();
        }
        for (const line of this.xyLinks) {
            const lf = line.parent as Figure;
            if (lf.yAxis.scale === f.xAxis.scale) {
                line.position.y = this.position.x;
            } else {
                line.position.y = lf.yAxis.invTransform(xT(this.position.x));
            }
            line.fireEvent(false, true);
            lf.repaintItems();
        }
        for (const line of this.yxLinks) {
            const lf = line.parent as Figure;
            if (lf.xAxis.scale === f.yAxis.scale) {
                line.position.x = this.position.y;
            } else {
                line.position.x = lf.xAxis.invTransform(yT(this.position.y));
            }
            line.fireEvent(true, false);
            lf.repaintItems();
        }

        this.fireEvent(xChanged, yChanged);
    }

    public fireEvent(xChanged: boolean, yChanged: boolean) {
        const f = this.parent as Figure;
        const xT = f.xAxis.transform;
        const yT = f.yAxis.transform;
        for (const fun of this.positionChangedListeners) {
            let pos: IPositionChangedEvent = {
                internalPosition: this.position,
                realPosition: {x: xT(this.position.x), y: yT(this.position.y)},
                xChanged, yChanged
            };

            fun(pos);
        }
    }

    public addPositionChangedListener(callback: (pos: IPositionChangedEvent) => void) {
        this.positionChangedListeners.push(callback);
    }

    public mouseMove(e: IMouseEvent): void {
        if (this.horizontalDragging || this.verticalDragging) {
            return;
        }

        if (!this.isInsideEffRect(e.x, e.y)) return;

        const f = this.parent as Figure;

        const pos = f.mapRange2Canvas(this.position);
        const offset = 10;  // px
        
        var vh = e.x >= pos.x - offset && e.x <= pos.x + offset;
        var hh = e.y >= pos.y - offset && e.y <= pos.y + offset;

        const va = f.axisAlignment === Orientation.Vertical;
        
        if (va) {
            [vh, hh] = [hh, vh];
        }

        // on change, repaint
        if (this.verticalHovering !== vh) {
            this.verticalHovering = vh;
            f.repaintItems();
        } 
        
        if (this.horizontalHovering !== hh) {
            this.horizontalHovering = hh;
            f.repaintItems();
        }

        f.preventMouseEvents(undefined, this.verticalHovering || this.horizontalHovering);

        if (this.verticalHovering && !this.horizontalHovering) {
            e.topCanvas.style.cursor = (va) ? this.cursors.horizontalResize : this.cursors.verticalResize;
        } else if (!this.verticalHovering && this.horizontalHovering) {
            e.topCanvas.style.cursor = (va) ? this.cursors.verticalResize : this.cursors.horizontalResize;
        } else if (this.verticalHovering && this.horizontalHovering) {
            e.topCanvas.style.cursor = this.cursors.move;
        }  else {
            e.topCanvas.style.cursor = this.cursors.crosshair;
        }

        // console.log("vh", this.verticalHovering, "hh", this.horizontalHovering);
    }

    public rangeChanged(range: Rect): void {
        if (this.position.x < range.x) {
            this.position.x = range.x;
            // this.positionChanged(true, false);
        }

        if (this.position.y < range.y) {
            this.position.y = range.y;
            // this.positionChanged(false, true);
        }

        if (this.position.x > range.x + range.w) {
            this.position.x = range.x + range.w;
            // this.positionChanged(true, false);
        }

        if (this.position.y > range.y + range.h) {
            this.position.y = range.y + range.h;
            // this.positionChanged(false, true);
        }
    }

    private strokeHorizontal(e: IPaintEvent) {
        e.topCtx.strokeStyle = (this.horizontalHovering) ? this.onHoverColor : this.color;
        // e.ctx.lineWidth = (this.horizontalHovering) ? 2 : 1;
        const f = this.parent as Figure;
        const r = f.getEffectiveRect();
        const va = f.axisAlignment === Orientation.Vertical;
        const p0 = f.mapRange2Canvas((va) ? {x: this.position.x, y: 0} : {x: 0, y: this.position.y});
        e.topCtx.beginPath();
        e.topCtx.moveTo(r.x, p0.y);
        e.topCtx.lineTo(r.x + r.w, p0.y);
        e.topCtx.stroke();

        if (this.showText) {
            const num = (va) ? f.xAxis.transform(this.position.x) : f.yAxis.transform(this.position.y);
            e.topCtx.save();
            e.topCtx.textAlign = 'right';  // vertical alignment
            e.topCtx.textBaseline = 'middle'; // horizontal alignment
            e.topCtx.font = f.tickValuesFont;
            const text = formatNumber(num, 1 + ((va) ? f.xAxis.displayedSignificantFigures : f.yAxis.displayedSignificantFigures));
    
            const _metrics = e.topCtx.measureText(text);
            let textOffset = _metrics.actualBoundingBoxAscent + _metrics.actualBoundingBoxDescent;

            e.topCtx.fillStyle = "rgba(100, 100, 100, 0.9)";
            e.topCtx.strokeStyle = "black";
            e.topCtx.setLineDash([]);

            let wRect = 4 / 3 *_metrics.width;
    
            e.topCtx.fillRect(r.x - wRect, p0.y - textOffset, wRect, 2 * textOffset);  //  - 1.8 * textOffset
            e.topCtx.strokeRect(r.x - wRect, p0.y - textOffset, wRect, 2 * textOffset);  //  - 1.8 * textOffset
    
            e.topCtx.fillStyle = "white";
            e.topCtx.fillText(text, r.x - textOffset / 2, p0.y);
            e.topCtx.restore();
            
            if (f.minimalMargin.left !== wRect){
                f.minimalMargin.left = wRect;
            }
        }


        // if (this.showText) {
        //     const xText = r.x - this.textPosition + r.w;

        //     e.topCtx.fillStyle = this.onHoverColor;
        //     e.topCtx.textAlign = 'right';  // vertical alignment
        //     e.topCtx.textBaseline = 'middle'; // horizontal alignment
        //     e.topCtx.font = f.tickValuesFont;

        //     const num = (va) ? f.xAxis.transform(this.position.x) : f.yAxis.transform(this.position.y);

        //     const text = formatNumber(num, 1 + ((va) ? f.xAxis.displayedSignificantFigures : f.yAxis.displayedSignificantFigures));
        //     const textSize = e.topCtx.measureText(text);
        //     const offset = 6;

        //     e.topCtx.save()
        //     drawTextWithGlow(text, xText, p0.y, e.topCtx, f.tickValuesFont);
        //     e.topCtx.restore();

        //     e.topCtx.lineTo(xText - textSize.width - offset, p0.y);
        //     e.topCtx.moveTo(xText + offset, p0.y);
        // }

    }

    private strokeVertical(e: IPaintEvent) {
        e.topCtx.strokeStyle = (this.verticalHovering) ? this.onHoverColor : this.color;
        // e.ctx.lineWidth = (this.verticalHovering) ? 2 : 1;
        const f = this.parent as Figure;
        const r = f.getEffectiveRect();
        const va = f.axisAlignment === Orientation.Vertical;
        const p0 = f.mapRange2Canvas((va) ? {x: 0, y: this.position.y} : {x: this.position.x, y: 0});
        e.topCtx.beginPath();
        // f.calcEffectiveRect();
        e.topCtx.moveTo(p0.x, r.y + r.h);
        e.topCtx.lineTo(p0.x, r.y);
        e.topCtx.stroke();

        if (this.showText) {
            const num = (va) ? f.yAxis.transform(this.position.y) : f.xAxis.transform(this.position.x);

            e.topCtx.save();
            e.topCtx.textAlign = 'center';  // vertical alignment
            e.topCtx.textBaseline = 'middle'; // horizontal alignment
            e.topCtx.font = f.tickValuesFont;
            const text = formatNumber(num, 1 + ((va) ? f.yAxis.displayedSignificantFigures : f.xAxis.displayedSignificantFigures));

            const _metrics = e.topCtx.measureText(text);
            let textOffset = _metrics.actualBoundingBoxAscent + _metrics.actualBoundingBoxDescent;

            e.topCtx.fillStyle = "rgba(100, 100, 100, 0.9)";
            e.topCtx.strokeStyle = "black";
            e.topCtx.setLineDash([]);

            e.topCtx.fillRect(p0.x - _metrics.width / 1.5, r.y + r.h + 0, 4 / 3 * _metrics.width, 1.8 * textOffset);
            e.topCtx.strokeRect(p0.x - _metrics.width / 1.5, r.y + r.h + 0, 4 / 3 * _metrics.width, 1.8 * textOffset);

            e.topCtx.fillStyle = "white";
            e.topCtx.fillText(text, p0.x, r.y + r.h + textOffset);
            e.topCtx.restore();
        }
    }

    public paint(e: IPaintEvent): void {
        if (this.orientation === Orientation.None) return;
        const f = this.parent as Figure;

        // this.checkRangeChanged(f.internalRange);

        e.topCtx.save();

        // https://stackoverflow.com/questions/39048227/html5-canvas-invert-color-of-pixels
        // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
        // e.topCtx.globalCompositeOperation = 'difference';  // calculate the difference of the colors
        
        // let pr = window.devicePixelRatio;
        e.topCtx.lineWidth = 2;
        e.topCtx.setLineDash([10, 6]);

        var h = Orientation.Horizontal;
        var v = Orientation.Vertical;
        if (f.axisAlignment === Orientation.Vertical) {
            [v, h] = [h, v];
        }

        if (this.orientation === h) {
            this.strokeHorizontal(e);
        } else if (this.orientation === v) {
            this.strokeVertical(e);
        } else {  // both
            this.strokeVertical(e);
            this.strokeHorizontal(e);
        }

        e.topCtx.restore();
    }
}