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
        this.regionRect.w = 20;
        this.regionRect.h = 20;
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

    public resize(): void {
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

        e.topCtx.lineWidth = this.hovering ? 7 : 5;
        e.topCtx.strokeStyle = 'white';
        e.topCtx.strokeRect(this.regionRect.x, this.regionRect.y, this.regionRect.w, this.regionRect.h);

        e.topCtx.strokeStyle = 'black';
        e.topCtx.lineWidth = this.hovering ? 3 : 1;
        e.topCtx.strokeRect(this.regionRect.x, this.regionRect.y, this.regionRect.w, this.regionRect.h);

        e.topCtx.restore();
    }

}


export class LinearROI extends GraphicObject {

    private figure: Figure;

    constructor(parent: Figure) {
        super(parent);
        this.figure = parent;

        // this.addPoint({x: 400, y: 0});
        // this.addPoint({x: 450, y: 1});
        // this.addPoint({x: 480, y: 1});
        // this.addPoint({x: 500, y: -1});
        // this.addPoint({x: 550, y: -1});
        // this.addPoint({x: 560, y: -0.5});
        // this.addPoint({x: 800, y: -0.5});

    }

    public addPoint(internalPosition: Point) {
        this.addItem(new ROIPoint(this, this.figure, internalPosition));
    }

    public getPositions(sorted: boolean = true): Point[] {
        const positions = this.items.map(item => (item as ROIPoint).position);
        if (sorted) {
            positions.sort((a, b) => a.x - b.x);
        }
        return positions;
    }

    private _getSortedCanvasCoordinates(): Point[] {
        const positions = this.items.map(item => {
            const i = item as ROIPoint;
            const p: Point = {
                x: i.regionRect.x + i.regionRect.w / 2,
                y: i.regionRect.y + i.regionRect.h / 2
            }
            return p;
        });
        positions.sort((a, b) => a.x - b.x);
        return positions;
    }

    public paint(e: IPaintEvent): void {
        const positions = this._getSortedCanvasCoordinates();
        if (positions.length === 0) return;

        e.topCtx.save();

        const r = this.figure.getEffectiveRect();
        e.topCtx.beginPath();
        e.topCtx.rect(r.x, r.y, r.w, r.h);
        e.topCtx.clip();
        
        // paint connecting line
        // first calculate the nearest line, how to connect points

        e.topCtx.strokeStyle = 'black';
        e.topCtx.lineWidth = 3;
        e.topCtx.setLineDash([]);
        e.topCtx.beginPath();
        e.topCtx.moveTo(positions[0].x, positions[0].y);
        
        for (let i = 1; i < positions.length; i++) {
            e.topCtx.lineTo(positions[i].x, positions[i].y);
        }
        e.topCtx.stroke();

        super.paint(e);

        e.topCtx.restore();
    }
}