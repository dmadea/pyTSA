import { GraphicObject, IMouseEvent, IPaintEvent } from "./object";
import { Figure } from "../figure/figure";
import { DraggableRegion } from "./draggable";
import { Point, Rect } from "../types";


export class ROIPoint extends DraggableRegion {

    private _internalPosition: Point;
    public shape: string = "rectangle";

    constructor(parent: GraphicObject, parentFigure: Figure, internalPos?: Point) {
        super(parent, parentFigure, true);
        this._internalPosition = internalPos ?? {x: 0, y: 0};
        this.regionRect.w = 30;
        this.regionRect.h = 30;
    }

    public regionRectPositionChanged(): void {
        const x = this.regionRect.x + this.regionRect.w / 2;
        const y = this.regionRect.y + this.regionRect.h / 2;

        this._internalPosition = this.figure.mapCanvas2Range({x, y});
    }

    private recalculateRegionPosition(internalPosition: Point) {
        const pcanvas = this.figure.mapRange2Canvas(internalPosition);
        this.regionRect = {
            x: pcanvas.x - this.regionRect.w / 2,
            y: pcanvas.y - this.regionRect.h / 2,
            w: this.regionRect.w,
            h: this.regionRect.h
        }
    }

    // public mouseMove(e: IMouseEvent): void {
    //     super.mouseMove(e);

    //     const p = this.parent as LinearROI;
    //     console.log("moouse move from roi ", p.items.indexOf(this));
    // }

    public rangeChanged(range: Rect): void {
        this.recalculateRegionPosition(this._internalPosition);
    }

    set internalPosition(p: Point) {
        this._internalPosition = p;
        this.recalculateRegionPosition(p);
    }

    get internalPosition(): Point {
        return this._internalPosition;
    }

    get position(): Point {
        return {
            x: this.figure.xAxis.transform(this._internalPosition.x), 
            y:  this.figure.yAxis.transform(this._internalPosition.y)
        };
    }

    set position(p: Point) {
        this.internalPosition = {
            x: this.figure.xAxis.invTransform(p.x), 
            y: this.figure.yAxis.invTransform(p.y), 
        }
    }

    public paint(e: IPaintEvent): void {
        
        e.topCtx.save();

        const r = this.figure.getEffectiveRect();
        e.topCtx.rect(r.x, r.y, r.w, r.h);
        e.topCtx.clip();

        if (this.hovering){
            // e.topCtx.setLineDash([4, 2]);
            e.topCtx.lineWidth = 3;
        } else {
            e.topCtx.lineWidth = 1;
        }
        e.topCtx.strokeRect(this.regionRect.x, this.regionRect.y, this.regionRect.w, this.regionRect.h);

        e.topCtx.restore();
    }
}


export class LinearROI extends GraphicObject {

    private figure: Figure;
    // public ROIList: ROIPoint[] = [];

    constructor(parent: Figure) {
        super(parent);
        this.figure = parent;

        this.addPoint({x: 0, y: 0});
        this.addPoint({x: 1, y: 1});
        this.addPoint({x: -1, y: 1});
        this.addPoint({x: -1, y: -1});
    }

    public addPoint(internalPosition: Point) {
        this.addItem(new ROIPoint(this, this.figure, internalPosition));
    }

    public paint(e: IPaintEvent): void {

        super.paint(e);

    }
}