import { Rect, Margin, Point } from "./types";
import { Figure } from "./figure";

export interface IPaintEvent {
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
}

export abstract class GraphicObject{
    protected items: GraphicObject[];
    public parent: GraphicObject | null; // = null;

    public canvas: HTMLCanvasElement | null = null;
    public ctx: CanvasRenderingContext2D | null;

    public canvasRect: Rect;    // rectangle in canvas coordinates where the object in located> [x0, x1, y0, y1]
    public margin: Margin;    // margin from canvasRect in absolute values: [left, right, top, bottom] 

    public cursors = {
        default: 'default',
        move: 'move',
        pointer: 'pointer',
        crosshair: 'crosshair',
        leftArrow: 'w-resize',
        topArrow: 'n-resize'
    }

    constructor(parent: GraphicObject | null = null,
        canvasRect: Rect = {x: 0, y: 0, w: 0, h: 0},
        margin: Margin = {left: 0, right: 0, top: 0, bottom: 0}) {
        this.parent = parent;
        this.canvasRect = canvasRect;
        this.margin = margin;
        this.canvas = null;
        this.ctx  = null;
        // assign canvas and ctx to children objects
        if (this.parent){
            if (this.parent.canvas !== null || this.parent.ctx !== null){
                this.canvas = this.parent.canvas;
                this.ctx = this.parent.ctx;

                // this.canvas?.addEventListener('mousedown', e => this.mouseDown(e));
                // this.canvas?.addEventListener('mouseup', e => this.mouseUp(e));
                // this.canvas?.addEventListener('mousemove', e => this.mouseMove(e));
                // this.canvas?.addEventListener("contextmenu", e => this.contextMenu(e));
                // console.log('assignemnt of canvas and ctx')
            }
        }
        this.items = [];
    }

    public paint(e: IPaintEvent): void {
        for (const item of this.items) {
            item.paint(e);
        }
    }

    public rangeChanged(range: Rect) {
        for (const item of this.items) {
            item.rangeChanged(range);
        }
    }

    public repaint() {
        if (this.ctx && this.canvas) {
            let e: IPaintEvent = {canvas: this.canvas, ctx: this.ctx};
            this.paint(e);
        }
    }

    public width() {
        return this.canvas?.width;
    }
    
    public height() {
        return this.canvas?.height;
    }

    public resize() {
        this.repaint();

    }

    mouseDown(e: MouseEvent) {
        for (const item of this.items) {
            item.mouseDown(e);
        }
    }

    mouseUp(e: MouseEvent) {
        for (const item of this.items) {
            item.mouseUp(e);
        }
    }

    mouseMove(e: MouseEvent) {
        for (const item of this.items) {
            item.mouseMove(e);
        }
    }

    contextMenu(e: MouseEvent) {
        e.preventDefault();
        for (const item of this.items) {
            item.contextMenu(e);
        }
    }
}

export enum Orientation {
    Horizontal,
    Vertical,
    Both
}

export class DraggableLines extends GraphicObject {

    static readonly Orientation: typeof Orientation = Orientation;

    public orientation: Orientation; // or vertical or both for cross
    public position: Point;
    private lastMouseDownPos: Point;
    private lastPosition: Point;

    public onHoverColor: string = "white";
    public color: string = "grey";

    public showText: boolean = true;
    public textPosition: number = 20;  // in pixels from the left/top
    public textFont: string = "11px sans-serif";  //default is 10px sans-serif
    public textSignificantFigures: number = 3;

    private verticalHovering: boolean = false;
    private horizontalHovering: boolean = false;

    private verticalDragging: boolean = false;
    private horizontalDragging: boolean = false;
    private positionChangedListeners: ((position: Point) => void)[] = [];

    constructor(parent: Figure, orientation: Orientation = Orientation.Vertical) {
        super(parent);
        this.orientation = orientation;
        this.position = {x: parent.range.x, y: parent.range.y};
        this.lastMouseDownPos = {x: 0, y: 0};
        this.lastPosition = {...this.position};
    }

    private checkBounds(e: MouseEvent, orientation: Orientation) {
        let f = this.parent as Figure;
        let pos = f.mapRange2Canvas(this.position);

        let offset = 7;  // px

        if ((this.orientation === Orientation.Vertical || this.orientation === Orientation.Both ) && orientation === Orientation.Vertical) {
            return e.offsetX >= pos.x - offset && e.offsetX <= pos.x + offset;
        }

        if ((this.orientation === Orientation.Horizontal || this.orientation === Orientation.Both ) && orientation === Orientation.Horizontal) {
            return e.offsetY >= pos.y - offset && e.offsetY <= pos.y + offset;
        }

        return false;
    }

    mouseDown(e: MouseEvent): void {
        if (e.button === 0) {
            this.verticalDragging = this.verticalHovering;
            this.horizontalDragging = this.horizontalHovering;
            this.lastMouseDownPos = {x:e.offsetX, y: e.offsetY};
            this.lastPosition = {...this.position};
        }
    }

    mouseUp(e: MouseEvent): void {
        this.verticalDragging = false;
        this.horizontalDragging = false;
        let f = this.parent as Figure;
        f.preventMouseEvents(false, false);
    }

    private positionChanged() {
        for (const fun of this.positionChangedListeners) {
            fun(this.position);
        }
    }

    public addPositionChangedListener(callback: (position: Point) => void) {
        this.positionChangedListeners.push(callback);
    }

    public mouseMove(e: MouseEvent): void {
        if (!this.canvas) {
            return;
        }
        let f = this.parent as Figure;

        if (this.horizontalDragging || this.verticalDragging) {
            f.preventMouseEvents(true, true); // to prevent to change the cursor while dragging

            let dist: Point = {
                x: e.offsetX - this.lastMouseDownPos.x,
                y: e.offsetY - this.lastMouseDownPos.y
            }

            let xRatio = f.range.w / f.figureRect.w;
            let yRatio = f.range.h / f.figureRect.h;

            this.position = {
                x: (this.verticalDragging) ? this.lastPosition.x + dist.x * xRatio : this.lastPosition.x,
                y: (this.horizontalDragging) ? this.lastPosition.y - dist.y * yRatio : this.lastPosition.y
            };

            this.positionChanged();

            f.repaint();
            return;
        }

        let vh = this.checkBounds(e, Orientation.Vertical);
        let hh = this.checkBounds(e, Orientation.Horizontal);

        // on change, repaint
        if (this.verticalHovering !== vh) {
            this.verticalHovering = vh;
            f.repaint();
            // console.log('this.verticalHovering !== vh', vh);
        } 
        
        if (this.horizontalHovering !== hh) {
            this.horizontalHovering = hh;
            f.repaint();
            // console.log('this.horizontalHovering !== vh', hh);
        }

        f.preventMouseEvents(undefined, this.verticalHovering || this.horizontalHovering);

        if (this.verticalHovering && !this.horizontalHovering) {
            this.canvas.style.cursor = this.cursors.leftArrow;
        } else if (!this.verticalHovering && this.horizontalHovering) {
            this.canvas.style.cursor = this.cursors.topArrow;
        } else if (this.verticalHovering && this.horizontalHovering) {
            this.canvas.style.cursor = this.cursors.move;
        }  else {
            this.canvas.style.cursor = this.cursors.crosshair;
        }

        // console.log(this.verticalHovering, this.horizontalHovering);
    }

    public rangeChanged(range: Rect): void {
        if (this.position.x < range.x) {
            this.position.x = range.x;
            this.positionChanged();
        }

        if (this.position.y < range.y) {
            this.position.y = range.y;
            this.positionChanged();
        }

        if (this.position.x > range.x + range.w) {
            this.position.x = range.x + range.w;
            this.positionChanged();
        }

        if (this.position.y > range.y + range.h) {
            this.position.y = range.y + range.h;
            this.positionChanged();
        }
    }

    private strokeHorizontal(e: IPaintEvent) {
        e.ctx.strokeStyle = (this.horizontalHovering) ? this.onHoverColor : this.color;
        // e.ctx.lineWidth = (this.horizontalHovering) ? 2 : 1;
        e.ctx.setLineDash([4, 2]);
        let f = this.parent as Figure;
        let p0 = f.mapRange2Canvas({x: 0, y: this.position.y});
        e.ctx.beginPath();
        e.ctx.moveTo(f.figureRect.x, p0.y);

        if (this.showText) {
            let xText = f.figureRect.x - this.textPosition + f.figureRect.w;

            e.ctx.fillStyle = this.onHoverColor;
            e.ctx.textAlign = 'right';  // vertical alignment
            e.ctx.textBaseline = 'middle'; // horizontal alignment
            e.ctx.font = this.textFont;

            let text = this.position.y.toPrecision(this.textSignificantFigures);
            let textSize = e.ctx.measureText(text);

            let offset = 3;

            e.ctx.lineTo(xText - textSize.width - offset, p0.y);
            e.ctx.fillText(text, xText, p0.y);
            e.ctx.moveTo(xText + offset, p0.y);
        }

        e.ctx.lineTo(f.figureRect.x + f.figureRect.w, p0.y);
        e.ctx.stroke();
    }

    private strokeVertical(e: IPaintEvent) {
        e.ctx.strokeStyle = (this.verticalHovering) ? this.onHoverColor : this.color;
        // e.ctx.lineWidth = (this.verticalHovering) ? 2 : 1;

        e.ctx.setLineDash([4, 2]);
        let f = this.parent as Figure;
        let p0 = f.mapRange2Canvas({x: this.position.x, y: 0});
        e.ctx.beginPath();
        e.ctx.moveTo(p0.x, f.figureRect.y);

        if (this.showText) {
            let yText = f.figureRect.y + this.textPosition;

            let text = this.position.x.toPrecision(this.textSignificantFigures);
            let textSize = e.ctx.measureText(text);

            e.ctx.save();
            e.ctx.translate(p0.x, yText);
            e.ctx.rotate(-Math.PI / 2);
            e.ctx.fillText(text, p0.x, yText);

            e.ctx.fillStyle = this.onHoverColor;
            e.ctx.textAlign = 'right';  // vertical alignment
            e.ctx.textBaseline = 'middle'; // horizontal alignment
            e.ctx.font = this.textFont;

            e.ctx.fillText(text, 0, 0);
            e.ctx.restore();

            let offset = 3;

            e.ctx.lineTo(p0.x, yText  - offset);
            e.ctx.moveTo(p0.x, yText + textSize.width + offset);
        }

        e.ctx.lineTo(p0.x, f.figureRect.y + f.figureRect.h);
        e.ctx.stroke();
    }

    public paint(e: IPaintEvent): void {
        // console.log('paint dragable lines');
        e.ctx.save();

        // https://stackoverflow.com/questions/39048227/html5-canvas-invert-color-of-pixels
        // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
        e.ctx.globalCompositeOperation = 'difference';  // calculate the difference of the colors
        e.ctx.lineWidth = 1;

        if (this.orientation === Orientation.Horizontal) {
            this.strokeHorizontal(e);
        } else if (this.orientation === Orientation.Vertical ) {
            this.strokeVertical(e);
        } else {  // both
            this.strokeHorizontal(e);
            this.strokeVertical(e);
        }

        e.ctx.restore();
    }



}