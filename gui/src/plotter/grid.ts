import { GraphicObject } from "./object";
import { Margin, NumberArray, Rect} from "./types";

interface IPosition {
    row: number, 
    col: number,
    rowSpan: number,
    colSpan: number
}

interface IGridSettings {
    horizontalSpace: number,
    verticalSpace: number,
    widthRatios: NumberArray | null,
    heightRatios: NumberArray | null
}

export class Grid extends GraphicObject {

    private positions: IPosition[];
    public gridSettings: IGridSettings = {
        horizontalSpace: 0.005,  // from 0 - 1, how much overall width one space will take
        verticalSpace: 0.005,
        widthRatios: null,
        heightRatios: null
    };

    constructor (parent?: GraphicObject, canvasRect?: Rect, margin?: Margin) {
        super(parent, canvasRect, margin);
        this.positions = [];
    }
    
    remove(item: GraphicObject){
        let idx = this.items.indexOf(item);
        if (idx >= 0){
            this.items.splice(idx, 1);
            this.positions.splice(idx, 1);
            this.recalculateGrid();
            this.repaint();
        }
    }

    public resize(): void {
        this.calcEffectiveRect();
        this.recalculateGrid();
        for (const item of this.items) {
            item.resize();
        }
    }

    public setCanvasRect(cr: Rect): void {
        this.canvasRect = cr;
        this.recalculateGrid();
    }

    public setMargin(m: Margin): void {
        // do nothing
    }

    public recalculateGrid(){
        let ncols = Math.max(...this.positions.map(p => (p.col))) + 1;
        let nrows = Math.max(...this.positions.map(p => (p.row))) + 1;

        // console.log('recalculateGrid', this.canvasRect);

        // calculate total width and height of components
        let width = this.effRect.w - this.effRect.w * (ncols - 1) * this.gridSettings.horizontalSpace;
        let height = this.effRect.h - this.effRect.h * (nrows - 1) * this.gridSettings.verticalSpace;

        if (this.gridSettings.widthRatios === null || this.gridSettings.widthRatios.length !== ncols){
            this.gridSettings.widthRatios = new NumberArray(ncols).fill(1);  // fill only ones
        }

        if (this.gridSettings.heightRatios === null || this.gridSettings.heightRatios.length !== nrows){
            this.gridSettings.heightRatios = new NumberArray(nrows).fill(1);  // fill only ones
        }

        let wtotalRatio = this.gridSettings.widthRatios.sum();
        let htotalRatio = this.gridSettings.heightRatios.sum();

        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const pos = this.positions[i];

            var x = this.effRect.x;

            for (let j = 0; j < pos.col; j++) {
                x += width * this.gridSettings.widthRatios[j] / wtotalRatio;
                x += this.effRect.w * this.gridSettings.horizontalSpace;
            }
            var y = this.effRect.y;
            for (let j = 0; j < pos.row; j++) {
                y += height * this.gridSettings.heightRatios[j] / htotalRatio;
                y += this.effRect.h * this.gridSettings.verticalSpace;
            }

            const wRatios = this.gridSettings.widthRatios.slice(pos.col, pos.col + pos.colSpan).sum();
            const hRatios = this.gridSettings.heightRatios.slice(pos.row, pos.row + pos.rowSpan).sum();

            item.setCanvasRect({
                x, 
                y,
                w: width * wRatios / wtotalRatio + this.effRect.w * (pos.colSpan - 1) * this.gridSettings.horizontalSpace, 
                h: height * hRatios / htotalRatio + this.effRect.h * (pos.rowSpan - 1) * this.gridSettings.verticalSpace
            });
        }

    }

    addItem(item: GraphicObject, row: number = 0, col: number = 0, rowSpan: number = 1, colSpan: number = 1) {
        super.addItem(item);
        this.positions.push({row, col, rowSpan, colSpan});
        this.recalculateGrid();
    }
}

export class EmptySpace extends GraphicObject {

}