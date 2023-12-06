import { ContextMenu } from "./contextmenu";
import { Rect, Margin } from "./types";

export interface IPaintEvent {
    mainCanvas: HTMLCanvasElement,
    mainCtx: CanvasRenderingContext2D,
    secCanvas: HTMLCanvasElement,
    secCtx: CanvasRenderingContext2D
}

export interface IMouseEvent {
    e: MouseEvent,
    mainCanvas: HTMLCanvasElement,
    secCanvas: HTMLCanvasElement,
    x: number,  // canvas x coordinate scaled by display ratio
    y: number  // canvas y coordinate scaled by display ratio
}

export interface ITouchEvent {
    e: TouchEvent,
    mainCanvas: HTMLCanvasElement,
    secCanvas: HTMLCanvasElement,
    x: number,  // canvas x coordinate scaled by display ratio
    y: number  // canvas y coordinate scaled by display ratio
}

export abstract class GraphicObject{
    protected items: GraphicObject[];
    public parent: GraphicObject | null; // = null;

    public mainCanvas: HTMLCanvasElement | null = null;  // main canvas for plotting figure etc.
    public mainCtx: CanvasRenderingContext2D | null;     // corresponding context

    public secCanvas: HTMLCanvasElement | null = null; // canvas for plotting items, responsive minor stuff
    public secCtx: CanvasRenderingContext2D | null;  // corresponding context

    public canvasRect: Rect;    // rectangle in canvas coordinates where the object in located> [x0, x1, y0, y1]
    public margin: Margin;      // margin from canvasRect in absolute values: [left, right, top, bottom] 
    public effRect: Rect         // canvas rectangle minus margins

    public contextMenu?: ContextMenu;

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
        this.items = [];
        this.canvasRect = canvasRect;
        // this.setCanvasRect(canvasRect);
        this.margin = margin;
        this.mainCanvas = null;
        this.mainCtx  = null;
        this.secCanvas = null;
        this.secCtx = null;
        this.effRect = {...this.canvasRect};
        // this.calcEffectiveRect();
        // assign canvas and ctx to children objects
        
    }

    public setParent(parent: GraphicObject | null) {
        this.parent = parent;
        if (this.parent) {
            this.mainCanvas = this.parent.mainCanvas;
            this.mainCtx = this.parent.mainCtx;
            this.secCanvas = this.parent.secCanvas;
            this.secCtx = this.parent.secCtx;
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

    public isInsideCanvasRect(x: number, y: number): boolean
    {
        // we are outside of figure frame
        if (x < this.canvasRect.x || x > this.canvasRect.x + this.canvasRect.w || 
            y < this.canvasRect.y || y > this.canvasRect.y + this.canvasRect.h) {
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
        if (this.mainCtx && this.mainCanvas && this.secCanvas && this.secCtx) {
            const e: IPaintEvent = {mainCanvas: this.mainCanvas, mainCtx: this.mainCtx, secCanvas: this.secCanvas, secCtx: this.secCtx};
            this.paint(e);
        }
    }

    // public width() {
    //     return this.canvas?.width;
    // }
    
    // public height() {
    //     return this.canvas?.height;
    // }

    public setCanvasRect(cr: Rect) {
        this.canvasRect = cr;
        for (const item of this.items) {
            item.setCanvasRect(cr);
        }
        // this.calcEffectiveRect();
    }

    public setMargin(m: Margin) {
        this.margin = m;
        for (const item of this.items) {
            item.setMargin(m);
        }
    }

    public resize() {
        // this.calcEffectiveRect();
        //set new dimensions also for items
        for (const item of this.items) {
            item.setCanvasRect(this.canvasRect);
            // item.canvasRect = {...this.effRect};
            item.resize();
        }
    }

    doubleClick(e: IMouseEvent) {
        e.e.preventDefault();
        for (const item of this.items) {
            if (item.isInsideCanvasRect(e.x, e.y)) {
                item.doubleClick(e);
            }
        }
    }

    mouseDown(e: IMouseEvent) {
        for (const item of this.items) {
            // item.calcEffectiveRect();
            if (item.isInsideCanvasRect(e.x, e.y)) {
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
            if (item.isInsideCanvasRect(e.x, e.y)) {
                item.mouseMove(e);
            }
        }
    }

    showContextMenu(e: IMouseEvent) {
        if (e.e.ctrlKey) return;
        e.e.preventDefault();
        if (this.contextMenu) {
            this.contextMenu.show({x: e.e.pageX, y: e.e.pageY});
        }
        // for (const item of this.items) {
        //     item.contextMenu(e);
        // }
    }

    touchStart(e: TouchEvent) {
        // const dpr = window.devicePixelRatio;
        for (const item of this.items) {
            // if (item.isInsideEffRect(e.touches[0].clientX * dpr, e.touches[0].clientY * dpr)) {
            item.touchStart(e);
            // }
        }
    }

    touchMove(e: TouchEvent) {
        // const dpr = window.devicePixelRatio;
        for (const item of this.items) {
            // if (item.isInsideEffRect(e.touches[0].clientX * dpr, e.touches[0].clientY * dpr)) {
            item.touchMove(e);
            // }
        }
    }

    touchEnd(e: TouchEvent) {
        for (const item of this.items) {
            item.touchEnd(e);
        }
    }







}

