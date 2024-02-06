import { GraphicObject, IMouseEvent, IPaintEvent } from "./object";
import { Point, Rect } from "../types";
import { Figure } from "../figure/figure";


export class DraggableRegion extends GraphicObject {

    public hovering: boolean = false;
    public dragging: boolean = false;

    public regionRect: Rect = {x: 0, y:0, w:0, h:0};

    public figure: Figure; // parent figure
    public paintOnTopCanvas: boolean;

    constructor(parent: GraphicObject, parentFigure: Figure, paintOnTopCanvas: boolean) {
        super(parent);
        this.figure = parentFigure;
        this.paintOnTopCanvas = paintOnTopCanvas;
    }

    public regionRectPositionChanged() {

    }

    mouseDown(e: IMouseEvent): void {
        super.mouseDown(e);
        if (e.e.button !== 0) {
            return;
        }
        
        this.dragging = this.hovering;

        if (this.dragging) {
            // this.figure.preventMouseEvents(true, true); // to prevent to change the cursor while dragging
            this.preventEventsFunc = () => {
                this.figure.preventMouseEvents(true, true);
            };
            const lastMousePos = {x: e.e.clientX, y: e.e.clientY};
            const lastRegionPos = {x: this.regionRect.x, y: this.regionRect.y};

            const mousemove = (e: MouseEvent) => {
                let dist: Point = {
                    x: window.devicePixelRatio * (e.x - lastMousePos.x),
                    y: window.devicePixelRatio * (e.y - lastMousePos.y)
                }

                this.regionRect.x = lastRegionPos.x + dist.x;
                this.regionRect.y = lastRegionPos.y + dist.y;

                this.regionRectPositionChanged();
                this.replot();
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
        this.dragging = false;
        this.preventEventsFunc = () => {
            this.figure.preventMouseEvents(false, false);
        };
        // this.figure.preventMouseEvents(false, false);
    }

    public mouseMove(e: IMouseEvent): void {
        if (this.dragging) {
            this.activeCursor = this.cursors.grabbing;
            // this.setActiveCursor(this.cursors.grabbing);
            return;
        }
        
        if (!this.figure.isInsideEffRect(e.x, e.y)) return;

        var hovering = true;
        if (e.x < this.regionRect.x || e.x > this.regionRect.x + this.regionRect.w || 
            e.y < this.regionRect.y || e.y > this.regionRect.y + this.regionRect.h) {
            hovering = false;
        }

        // on change, repaint
        if (this.hovering !== hovering) {
            this.hovering = hovering;
            this.active = hovering;

            this.preventEventsFunc = () => {
                this.figure.preventMouseEvents(undefined, this.hovering);
            };

            // this.setPreventEventsFunction(() => {
            //     this.figure.preventMouseEvents(undefined, this.hovering);
            //     // const a = 5;
            // });
        } 

        // this.figure.preventMouseEvents(undefined, this.hovering);
        
        if (this.hovering) {
            this.activeCursor = this.cursors.move;
            // e.topCanvas.style.cursor = this.cursors.move;
        }  

        // else {
        //     e.topCanvas.style.cursor = this.cursors.crosshair;
        // }
    }

    public replot() {
        if (this.paintOnTopCanvas) {
            this.figure.repaintItems();
        } else {
            this.figure.replot();
        }
    }

    public paint(e: IPaintEvent): void {

        const ctx = this.paintOnTopCanvas ? e.topCtx : e.bottomCtx;

        e.topCtx.save();

        if (true){
            ctx.setLineDash([4, 2]);
            ctx.strokeRect(this.regionRect.x, this.regionRect.y, this.regionRect.w, this.regionRect.h);
        }

        e.topCtx.restore();
    }
}