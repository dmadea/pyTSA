import { GraphicObject } from "./object";
import { NumberArray, Rect} from "./types";

interface IPosition {
    row: number, 
    col: number
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
        horizontalSpace: 0.02,  // from 0 - 1, how much overall width one space will take
        verticalSpace: 0.02,
        widthRatios: null,
        heightRatios: null
    };

    constructor (parent: GraphicObject, canvasRect?: Rect) {
        super(parent, canvasRect);
        this.positions = [];
    }
    
    remove(item: GraphicObject){
        let idx = this.items.indexOf(item);
        if (idx >= 0){
            this.items.splice(idx, 1);
            this.positions.splice(idx, 1);
            this.recalculateGrid();
        }
    }

    public resize(): void {
        this.recalculateGrid(false);
    }

    recalculateGrid(repaint: boolean = true){
        let ncols = Math.max(...this.positions.map(p => (p.col))) + 1;
        let nrows = Math.max(...this.positions.map(p => (p.row))) + 1;

        // calculate total width and height of components
        let width = this.canvasRect.w - this.canvasRect.w * (ncols - 1) * this.gridSettings.horizontalSpace;
        let height = this.canvasRect.h - this.canvasRect.h * (nrows - 1) * this.gridSettings.verticalSpace;

        if (this.gridSettings.widthRatios === null || this.gridSettings.widthRatios.length !== ncols){
            this.gridSettings.widthRatios = new NumberArray(ncols).fill(1);  // fill only ones
        }

        if (this.gridSettings.heightRatios === null || this.gridSettings.heightRatios.length !== ncols){
            this.gridSettings.heightRatios = new NumberArray(nrows).fill(1);  // fill only ones
        }

        let wtotalRatio = this.gridSettings.widthRatios.sum();
        let htotalRatio = this.gridSettings.heightRatios.sum();

        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const pos = this.positions[i];

            var x = this.canvasRect.x;

            for (let j = 0; j < pos.col; j++) {
                x += width * this.gridSettings.widthRatios[j] / wtotalRatio;
                x += this.canvasRect.w * this.gridSettings.horizontalSpace;
            }
            var y = this.canvasRect.y;
            for (let j = 0; j < pos.row; j++) {
                y += height * this.gridSettings.heightRatios[j] / htotalRatio;
                y += this.canvasRect.h * this.gridSettings.verticalSpace;
            }

            item.canvasRect.x = x;
            item.canvasRect.y = y;
            item.canvasRect.w = width * this.gridSettings.widthRatios[pos.col] / wtotalRatio;
            item.canvasRect.h = height * this.gridSettings.heightRatios[pos.row] / htotalRatio;
        }

        //repaint
        if (repaint)
            this.repaint();
    }


    addItem(item: GraphicObject, row: number = 0, col: number = 0) {
        this.positions.push({row, col});
        this.items.push(item);
        this.recalculateGrid(false);
    }


    
}