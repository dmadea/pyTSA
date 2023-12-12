import { Figure } from "./figure/figure";
import { GraphicObject, IMouseEvent, IPaintEvent } from "./object";
import { Point, Rect } from "./types";
import { drawTextWithGlow, formatNumber } from "./utils";


export enum Orientation {
    Horizontal,
    Vertical,
    Both
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
        const rng = parent.getInternalRange();
        this.position = {x: rng.x + rng.w / 2, y: rng.y + rng.h / 2};
        // this.lastMouseDownPos = {x: 0, y: 0};
        this.lastPosition = {...this.position};
        // this.setStickGrid(10, 3, 10, 4);
    }

    private checkBounds(x: number, y: number, orientation: Orientation) {
        let f = this.parent as Figure;
        let pos = f.mapRange2Canvas(this.position);

        let offset = 10;  // px

        if ((this.orientation === Orientation.Vertical || this.orientation === Orientation.Both ) && orientation === Orientation.Vertical) {
            return x >= pos.x - offset && x <= pos.x + offset;
        }

        if ((this.orientation === Orientation.Horizontal || this.orientation === Orientation.Both ) && orientation === Orientation.Horizontal) {
            return y >= pos.y - offset && y <= pos.y + offset;
        }

        return false;
    }

    public linkX(line: DraggableLines) {
        if (line === this) {
            return;
        }

        line.xLinks.push(this);
        this.xLinks.push(line);
    }

    public linkY(line: DraggableLines) {
        if (line === this) {
            return;
        }

        line.yLinks.push(this);
        this.yLinks.push(line);
    }

    public linkXY(line: DraggableLines) {
        if (line === this) {
            return;
        }

        line.yxLinks.push(this);
        this.xyLinks.push(line);
    }

    public linkYX(line: DraggableLines) {
        if (line === this) {
            return;
        }

        line.xyLinks.push(this);
        this.yxLinks.push(line);
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

            var mousemove = (e: MouseEvent) => {
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

                const rng = f.getInternalRange();
    
                let xRatio = rng.w / w;
                let yRatio = rng.h / h;
    
                let pos = {
                    x: ((va) ? this.horizontalDragging : this.verticalDragging) ? this.lastPosition.x + xSign * dist.x * xRatio : this.lastPosition.x,
                    y: ((va) ? this.verticalDragging : this.horizontalDragging) ? this.lastPosition.y + ySign * dist.y * yRatio : this.lastPosition.y
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
            // line.fireEvent(xChanged, yChanged);
            lf.repaintItems();
        }
        for (const line of this.yLinks) {
            const lf = line.parent as Figure;
            if (lf.yAxis.scale === f.yAxis.scale) {
                line.position.y = this.position.y;
            } else {
                line.position.y = lf.yAxis.invTransform(yT(this.position.y));
            }
            // line.fireEvent(xChanged, yChanged);
            lf.repaintItems();
        }
        for (const line of this.xyLinks) {
            const lf = line.parent as Figure;
            if (lf.yAxis.scale === f.xAxis.scale) {
                line.position.y = this.position.x;
            } else {
                line.position.y = lf.yAxis.invTransform(xT(this.position.x));
            }
            // line.fireEvent(xChanged, yChanged);
            lf.repaintItems();
        }
        for (const line of this.yxLinks) {
            const lf = line.parent as Figure;
            if (lf.xAxis.scale === f.yAxis.scale) {
                line.position.x = this.position.y;
            } else {
                line.position.x = lf.xAxis.invTransform(yT(this.position.y));
            }
            // line.fireEvent(xChanged, yChanged);
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

        const vh = this.checkBounds(e.x, e.y, Orientation.Vertical);
        const hh = this.checkBounds(e.x, e.y, Orientation.Horizontal);

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
            e.topCanvas.style.cursor = this.cursors.verticalResize;
        } else if (!this.verticalHovering && this.horizontalHovering) {
            e.topCanvas.style.cursor = this.cursors.horizontalResize;
        } else if (this.verticalHovering && this.horizontalHovering) {
            e.topCanvas.style.cursor = this.cursors.move;
        }  else {
            e.topCanvas.style.cursor = this.cursors.crosshair;
        }

        // console.log(this.verticalHovering, this.horizontalHovering);
    }

    public rangeChanged(range: Rect): void {
        if (this.position.x < range.x) {
            this.position.x = range.x;
            this.positionChanged(true, false);
        }

        if (this.position.y < range.y) {
            this.position.y = range.y;
            this.positionChanged(false, true);
        }

        if (this.position.x > range.x + range.w) {
            this.position.x = range.x + range.w;
            this.positionChanged(true, false);
        }

        if (this.position.y > range.y + range.h) {
            this.position.y = range.y + range.h;
            this.positionChanged(false, true);
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

        if (this.showText) {
            const xText = r.x - this.textPosition + r.w;

            e.topCtx.fillStyle = this.onHoverColor;
            e.topCtx.textAlign = 'right';  // vertical alignment
            e.topCtx.textBaseline = 'middle'; // horizontal alignment
            e.topCtx.font = f.tickValuesFont;

            const num = (va) ? f.xAxis.transform(this.position.x) : f.yAxis.transform(this.position.y);

            const text = formatNumber(num, 1 + ((va) ? f.xAxis.displayedSignificantFigures : f.yAxis.displayedSignificantFigures));
            const textSize = e.topCtx.measureText(text);
            const offset = 6;

            e.topCtx.save()
            drawTextWithGlow(text, xText, p0.y, e.topCtx, f.tickValuesFont);
            e.topCtx.restore();

            e.topCtx.lineTo(xText - textSize.width - offset, p0.y);
            e.topCtx.moveTo(xText + offset, p0.y);
        }

        e.topCtx.lineTo(r.x + r.w, p0.y);
        e.topCtx.stroke();
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

        if (this.showText) {
            const yText = r.y + this.textPosition;

            const num = (va) ? f.yAxis.transform(this.position.y) : f.xAxis.transform(this.position.x);

            e.topCtx.save();
            e.topCtx.translate(p0.x, yText);
            e.topCtx.rotate(-Math.PI / 2);
            
            e.topCtx.textAlign = 'right';  // vertical alignment
            e.topCtx.textBaseline = 'middle'; // horizontal alignment
            e.topCtx.font = f.tickValuesFont;

            const text = formatNumber(num, 1 + ((va) ? f.yAxis.displayedSignificantFigures : f.xAxis.displayedSignificantFigures));
            const textSize = e.topCtx.measureText(text);
            
            drawTextWithGlow(text, 0, 0, e.topCtx, f.tickValuesFont);
            e.topCtx.restore();

            const offset = 6;

            e.topCtx.lineTo(p0.x, yText + textSize.width + offset);
            e.topCtx.moveTo(p0.x, yText - offset);
        }

        e.topCtx.lineTo(p0.x, r.y);
        e.topCtx.stroke();
    }

    public paint(e: IPaintEvent): void {
        e.topCtx.save();

        // https://stackoverflow.com/questions/39048227/html5-canvas-invert-color-of-pixels
        // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
        // e.topCtx.globalCompositeOperation = 'difference';  // calculate the difference of the colors
        
        // let pr = window.devicePixelRatio;
        e.topCtx.lineWidth = 2;
        e.topCtx.setLineDash([10, 6]);

        if (this.orientation === Orientation.Horizontal) {
            this.strokeHorizontal(e);
        } else if (this.orientation === Orientation.Vertical ) {
            this.strokeVertical(e);
        } else {  // both
            this.strokeVertical(e);
            this.strokeHorizontal(e);
        }

        e.topCtx.restore();
    }
}