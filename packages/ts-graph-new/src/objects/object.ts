import { ContextMenu } from "../contextmenu";
import { Rect, Margin } from "../types";

export interface IPaintEvent {
    bottomCanvas: HTMLCanvasElement,
    bottomCtx: CanvasRenderingContext2D,
    topCanvas: HTMLCanvasElement,
    topCtx: CanvasRenderingContext2D
}

export interface IMouseEvent {
    e: MouseEvent,
    bottomCanvas: HTMLCanvasElement,
    topCanvas: HTMLCanvasElement,
    x: number,  // canvas x coordinate scaled by display ratio
    y: number  // canvas y coordinate scaled by display ratio
}

export interface ITouchEvent {
    e: TouchEvent,
    bottomCanvas: HTMLCanvasElement,
    topCanvas: HTMLCanvasElement,
    x: number,  // canvas x coordinate scaled by display ratio
    y: number  // canvas y coordinate scaled by display ratio
}

export interface Wasm {
    memory: WebAssembly.Memory,
    exports: WebAssembly.Exports
}

export enum ObjectType {
    root = 0,
    child = 1
}

export abstract class GraphicObject{
    public items: GraphicObject[];
    public parent: GraphicObject | null; // = null;

    public bottomCanvas: HTMLCanvasElement | null = null;  // main canvas for plotting figure etc.
    public bottomCtx: CanvasRenderingContext2D | null;     // corresponding context

    public topCanvas: HTMLCanvasElement | null = null; // canvas for plotting items, responsive minor stuff
    public topCtx: CanvasRenderingContext2D | null;  // corresponding context

    public canvasRect: Rect;    // rectangle in canvas coordinates where the object in located> [x0, x1, y0, y1]
    public margin: Margin;      // margin from canvasRect in absolute values: [left, right, top, bottom] 
    // public effRect: Rect         // canvas rectangle minus margins

    public contextMenu?: ContextMenu;
    public wasm?: Wasm;

    public active: boolean = false;
    public activeCursor: string;
    public passiveCursor: string | null;
    public preventEventsFunc: null | (() => void) = null;

    public visibleItems: GraphicObject[] = [];
    public objectType: ObjectType = ObjectType.child; 

    public visible = true;

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

    constructor(parent?: GraphicObject, canvasRect?: Rect, margin?: Margin) {
        if (parent) {
            this.parent = parent;
            this.setParent(parent);
        } else {
            this.parent = null;
        }
        this.items = [];
        this.canvasRect = canvasRect ?? {x: 0, y: 0, w: 0, h: 0};
        // this.setCanvasRect(canvasRect);
        this.margin = margin ?? {left: 0, right: 0, top: 0, bottom: 0};
        this.bottomCanvas = null;
        this.bottomCtx  = null;
        this.topCanvas = null;
        this.topCtx = null;
        // this.effRect = {...this.canvasRect};
        // this.calcEffectiveRect();
        // assign canvas and ctx to children objects
        this.activeCursor = this.cursors.default;
        this.passiveCursor = null;
    }

    // public setPreventEventsFunction(f: () => void) {
    //     this.preventEventsFunc = f;
    // }

    // public setActiveCursor(cursor: string) {
    //     this.activeCursor = cursor;
    // }

    public setWasm(wasm: Wasm) {
        this.wasm = wasm;
        for (const item of this.items) {
            item.wasm = wasm;
        }
    }

    protected setContextMenu() {
        // to be implemented ...
        // this.contextMenu = new ContextMenu();
    }

    public setParent(parent: GraphicObject | null) {
        this.parent = parent;
        if (this.parent) {
            this.bottomCanvas = this.parent.bottomCanvas;
            this.bottomCtx = this.parent.bottomCtx;
            this.topCanvas = this.parent.topCanvas;
            this.topCtx = this.parent.topCtx;
            this.wasm = this.parent.wasm;
        }
    }

    public addItem(item: GraphicObject) {
        if (this.items.indexOf(item) === -1) { 
            this.items.push(item);
            item.setParent(this);
        }
    }

    public getEffectiveRect(): Rect{
        let x = this.canvasRect.x + this.margin.left;
        let y = this.canvasRect.y + this.margin.top;
        return {
            x: x,
            y: y,
            w: this.canvasRect.w - this.margin.right - this.margin.left,
            h: this.canvasRect.h - this.margin.bottom - this.margin.top
        }
    }

    public isInsideEffRect(x: number, y: number): boolean
    {
        // we are outside of figure frame
        const r = this.getEffectiveRect();
        if (x < r.x || x > r.x + r.w || 
            y < r.y || y > r.y + r.h) {
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
            // item.calcEffectiveRect();
            if (item.visible) item.paint(e);
        }
    }

    public rangeChanged(range: Rect) {
        for (const item of this.items) {
            item.rangeChanged(range);
        }
    }

    protected repaint() {
        if (this.bottomCtx && this.bottomCanvas && this.topCanvas && this.topCtx) {
            const e: IPaintEvent = {bottomCanvas: this.bottomCanvas, bottomCtx: this.bottomCtx, topCanvas: this.topCanvas, topCtx: this.topCtx};
            this.paint(e);
        }
    }

    public replot() {
        this.repaint();
    }

    public clear() {
        this.items = [];
    }

    // public width() {
    //     return this.canvas?.width;
    // }
    
    // public height() {
    //     return this.canvas?.height;
    // }

    public setCanvasRect(cr: Rect) {
        this.canvasRect = {...cr};
        for (const item of this.items) {
            item.setCanvasRect(cr);
        }
        // this.calcEffectiveRect();
    }

    public setMargin(m: Margin) {
        this.margin = {...m};
        for (const item of this.items) {
            item.setMargin(m);
        }
    }

    public resize() {
        // const r = this.getEffectiveRect();
        //set new dimensions also for items
        for (const item of this.items) {
            item.setCanvasRect(this.canvasRect);
            // item.canvasRect = r;
            item.resize();
        }
    }

    get rootItem(): GraphicObject | null {
        var item: GraphicObject | null = this;
        while (true) {
            if (item) {
                if (item.objectType === ObjectType.root) return item;
                item = item.parent;
            } else {
                return null;
            }
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
        this.rootItem?.visibleItems.push(this);
        for (const item of this.items) {
            if (item.visible && item.isInsideCanvasRect(e.x, e.y)) {
                item.mouseDown(e);
            }
        }
        this.handleMultipleItemEvents();
    }

    mouseUp(e: IMouseEvent) {
        this.rootItem?.visibleItems.push(this);
        for (const item of this.items) {
            if (item.visible) item.mouseUp(e);
        }
        this.handleMultipleItemEvents();
    }

    mouseMove(e: IMouseEvent) {
        this.rootItem?.visibleItems.push(this);
        for (const item of this.items) {
            if (item.visible && item.isInsideCanvasRect(e.x, e.y)) {
                item.mouseMove(e);
            }
        }
        this.handleMultipleItemEvents();
    }
    
    public handleMultipleItemEvents() {
        if (this.objectType !== ObjectType.root) return;
        
        const activeItems = this.visibleItems.filter(item => item.active);
        // console.log(this.visibleItems, activeItems);
        if (activeItems.length > 0) {
            const last = activeItems[activeItems.length - 1];
            if (this.topCanvas) this.topCanvas.style.cursor = last.activeCursor;
            if (last.preventEventsFunc !== null) last.preventEventsFunc();
        } else {
            for (const item of this.visibleItems) {
                if (item.preventEventsFunc !== null) item.preventEventsFunc();
                if (item.passiveCursor && this.topCanvas) {
                    this.topCanvas.style.cursor = item.passiveCursor;
                }
            }
        }
        this.visibleItems = [];
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
