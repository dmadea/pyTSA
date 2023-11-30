import { Rect, Margin } from "./types";

export interface IPaintEvent {
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
}

export interface IMouseEvent {
    e: MouseEvent,
    canvas: HTMLCanvasElement,
    x: number,  // canvas x coordinate scaled by display ratio
    y: number  // canvas y coordinate scaled by display ratio
}

export abstract class GraphicObject{
    protected items: GraphicObject[];
    public parent: GraphicObject | null; // = null;

    public canvas: HTMLCanvasElement | null = null;
    public ctx: CanvasRenderingContext2D | null;

    public canvasRect: Rect;    // rectangle in canvas coordinates where the object in located> [x0, x1, y0, y1]
    public margin: Margin;    // margin from canvasRect in absolute values: [left, right, top, bottom] 
    public effRect: Rect // canvas rectangle minus margins

    // https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
    public cursors = {
        default: 'default',
        move: 'move',
        grab: 'grab',
        grabbing: 'grabbing',
        pointer: 'pointer',
        crosshair: 'crosshair',
        leftArrow: 'w-resize',
        topArrow: 'n-resize',
        verticalResize: 'ew-resize',
        horizontalResize: 'ns-resize'

    }

    constructor(parent?: GraphicObject,
        canvasRect: Rect = {x: 0, y: 0, w: 0, h: 0},
        margin: Margin = {left: 0, right: 0, top: 0, bottom: 0}) {
        if (parent) {
            this.parent = parent;
            this.setParent(parent);
        } else {
            this.parent = null;
        }
        this.canvasRect = canvasRect;
        this.margin = margin;
        this.canvas = null;
        this.ctx  = null;
        this.effRect = {...this.canvasRect};
        this.calcEffectiveRect();
        // assign canvas and ctx to children objects
        this.items = [];
        
    }

    public setParent(parent: GraphicObject | null) {
        this.parent = parent;
        if (this.parent) {
            if (this.parent.canvas !== null && this.parent.ctx !== null){
                this.canvas = this.parent.canvas;
                this.ctx = this.parent.ctx;
            }
        }
    }

    public addItem(item: GraphicObject) {
        if (this.items.indexOf(item) === -1) { 
            this.items.push(item);
            item.setParent(this);
        }
    }

    public calcEffectiveRect(){
        let x = this.canvasRect.x + this.margin.left;
        let y = this.canvasRect.y + this.margin.top;
        this.effRect = {
            x: x,
            y: y,
            w: this.canvasRect.w - this.margin.right - this.margin.left,
            h: this.canvasRect.h - this.margin.bottom - this.margin.top
        }
    }

    public isInsideEffRect(x: number, y: number): boolean
    {
        // we are outside of figure frame
        if (x < this.effRect.x || x > this.effRect.x + this.effRect.w || 
            y < this.effRect.y || y > this.effRect.y + this.effRect.h) {
            return false;
        }
        return true;
    }

    public paint(e: IPaintEvent): void {
        for (const item of this.items) {
            item.calcEffectiveRect();
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
            const e: IPaintEvent = {canvas: this.canvas, ctx: this.ctx};
            this.paint(e);
        }
    }

    public width() {
        return this.canvas?.width;
    }
    
    public height() {
        return this.canvas?.height;
    }

    public setCanvasRect(cr: Rect) {
        this.canvasRect = cr;
        this.calcEffectiveRect();
    }

    public resize() {
        this.calcEffectiveRect();
        //set new dimensions also for items
        for (const item of this.items) {
            item.canvasRect = {...this.effRect};
            item.resize();
        }
    }

    mouseDown(e: IMouseEvent) {
        for (const item of this.items) {
            item.calcEffectiveRect();
            if (item.isInsideEffRect(e.x, e.y)) {
                item.mouseDown(e);
            }
        }
    }

    mouseUp(e: IMouseEvent) {
        for (const item of this.items) {
            item.mouseUp(e);
        }
    }

    mouseMove(e: IMouseEvent) {
        for (const item of this.items) {
            if (item.isInsideEffRect(e.x, e.y)) {
                item.mouseMove(e);
            }
        }
    }

    contextMenu(e: IMouseEvent) {
        e.e.preventDefault();
        for (const item of this.items) {
            item.contextMenu(e);
        }
    }
}

