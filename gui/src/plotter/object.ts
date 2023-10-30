import { Rect, Margin } from "./types";


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

                this.canvas?.addEventListener('mousedown', e => this.mouseDown(e));
                this.canvas?.addEventListener('mouseup', e => this.mouseUp(e));
                this.canvas?.addEventListener('mousemove', e => this.mouseMove(e));
                this.canvas?.addEventListener("contextmenu", e => this.contextMenu(e));
                // console.log('assignemnt of canvas and ctx')
            }
        }
        this.items = [];
    }

    public paint(): void {
        for (const item of this.items) {
            item.paint();
        }
    }

    public width() {
        return this.canvas?.width;
    }
    
    public height() {
        return this.canvas?.height;
    }

    mouseDown(e: MouseEvent) {
    }

    mouseUp(e: MouseEvent) {
    }

    mouseMove(e: MouseEvent) {

    }
    contextMenu(e: MouseEvent) {
        e.preventDefault();
    }



}