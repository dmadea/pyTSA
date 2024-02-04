import { GraphicObject, IMouseEvent, IPaintEvent } from "./object";
import { Figure } from "../figure/figure";
import { DraggableRegion } from "./draggable";


export class Legend extends DraggableRegion {

    constructor(parent: Figure) {
        super(parent, parent, false);
    }

    public paint(e: IPaintEvent): void {
        console.log('paint legend called');


        if (!this.figure.showLegend) return;

        e.bottomCtx.save();

        if (true){
            e.bottomCtx.setLineDash([4, 2]);
            e.bottomCtx.strokeRect(this.regionRect.x, this.regionRect.y, this.regionRect.w, this.regionRect.h);
        }

        for (const plot of this.figure.linePlots) {

            
        }

        e.bottomCtx.restore();
    }
}