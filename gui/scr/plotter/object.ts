import { Rect, Margin } from "./types";


export abstract class GraphicObject{
    protected items: GraphicObject[];
    abstract paint(): void;
    public parent: GraphicObject | null; // = null;

    public canvas: HTMLCanvasElement | null = null;
    public ctx: CanvasRenderingContext2D | null;

    public canvasRect: Rect;    // rectangle in canvas coordinates where the object in located> [x0, x1, y0, y1]
    public margin: Margin;    // margin from canvasRect in absolute values: [left, right, top, bottom] 

    constructor(parent: GraphicObject | null = null) {
        this.parent = parent;
        this.canvas = null;
        this.ctx  = null;
        // assign canvas and ctx to children objects
        if (this.parent){
            if (this.parent.canvas !== null || this.parent.ctx !== null){
                this.canvas = this.parent.canvas;
                this.ctx = this.parent.ctx;
                // console.log('assignemnt of canvas and ctx')
            }
        }
        this.items = [];
        this.margin = {left: 0, right: 0, top: 0, bottom: 0};
        this.canvasRect = {x: 0, y: 0, w: 0, h: 0};  // needs to be modified in subclasses
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