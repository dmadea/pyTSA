import { GraphicObject, IMouseEvent, IPaintEvent } from "./object";
import { Point, Rect } from "../types";
import { drawTextWithGlow, formatNumber } from "../utils";
import { Figure } from "../figure/figure";
import { Orientation } from "./draggableLines";


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

    mouseDown(e: IMouseEvent): void {
        if (e.e.button !== 0) {
            return;
        }
        
        this.hovering = this.dragging;

        if (this.dragging) {
            // const f = this.parent as Figure;
            const va = this.figure.axisAlignment === Orientation.Vertical;
            this.figure.preventMouseEvents(true, true); // to prevent to change the cursor while dragging
            const lastMousePos = {x: e.e.clientX, y: e.e.clientY};
            const lastRegionPos = {x: this.regionRect.x, y: this.regionRect.y};

            const mousemove = (e: MouseEvent) => {
                let dist: Point = {
                    x: window.devicePixelRatio * (e.x - lastMousePos.x),
                    y: window.devicePixelRatio * (e.y - lastMousePos.y)
                }
    
                const r = this.figure.getEffectiveRect();
    
                let w = r.w;
                let h = r.h;
    
                let xSign = this.figure.xAxis.inverted ? -1 : 1;
                let ySign = this.figure.yAxis.inverted ? 1 : -1;
    
                if (va) {
                    [w, h] = [h, w];
                    xSign *= -1;
                }

                const rng = this.figure.internalRange;
    
                let xRatio = rng.w / w;
                let yRatio = rng.h / h;
    
                let pos = {
                    x: lastRegionPos.x + xSign * dist.x * xRatio,
                    y: lastRegionPos.y + ySign * dist.y * yRatio
                }

                // pos.x = Math.max(rng.x, Math.min(pos.x, rng.x + rng.w));
                // pos.y = Math.max(rng.y, Math.min(pos.y, rng.y + rng.h));

                this.regionRect = {...this.regionRect, ...pos}
                    
                // const xChanged = pos.x !== this.position.x;
                // const yChanged = pos.y !== this.position.y;
                // this.positionChanged(xChanged, yChanged);
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
        this.figure.preventMouseEvents(false, false);
    }

    public mouseMove(e: IMouseEvent): void {
        if (this.dragging) {
            return;
        }

        if (!this.isInsideEffRect(e.x, e.y)) return;

        var hovering = true;
        if (e.x < this.regionRect.x || e.x > this.regionRect.x + this.regionRect.w || 
            e.y < this.regionRect.y || e.y > this.regionRect.y + this.regionRect.h) {
            hovering = false;
        }

        // on change, repaint
        if (this.hovering !== hovering) {
            this.hovering = hovering;
            this.replot();
        } 
        
        this.figure.preventMouseEvents(undefined, this.hovering);

        if (this.hovering) {
            e.topCanvas.style.cursor = this.cursors.move;
        }  else {
            e.topCanvas.style.cursor = this.cursors.crosshair;
        }
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