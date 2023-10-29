import { GraphicObject } from "./object";
import { NumberArray, Rect } from "./types";

interface Position {
    row: number, 
    col: number
}


export class Grid extends GraphicObject {

    private positions: Position[];
    public horizontalSpace: number = 0.01;  // from 0-1
    public verticalSpace: number = 0.05;
    public widthRatios: Array<number> | null = null;
    public heightRatios: Array<number> | null = null;

    private plotCanvasRect = false;
    
    constructor (parent: GraphicObject, canvasRect?: Rect) {
        super(parent, canvasRect);
        this.positions = [];
    }
    
    paint(): void {
        for (const item of this.items) {
            item.paint();
        }
    }

    remove(item: GraphicObject){
        let idx = this.items.indexOf(item);
        if (idx >= 0){
            this.items.splice(idx, 1);
            this.positions.splice(idx, 1);
            this.recalculateGrid();
        }
    }

    recalculateGrid(){
        let ncols = Math.max(...this.positions.map(p => (p.col))) + 1;
        let nrows = Math.max(...this.positions.map(p => (p.row))) + 1;

        // calculate total width and height of components
        let width = this.canvasRect.w - this.canvasRect.w * (ncols - 1) * this.horizontalSpace;
        let height = this.canvasRect.h - this.canvasRect.h * (nrows - 1) * this.verticalSpace;

        // todo include also components that are missing
        let wtotalRatio = (this.widthRatios) ? new NumberArray(...this.widthRatios).sum() : ncols;
        let htotalRatio = (this.heightRatios) ? new NumberArray(...this.heightRatios).sum() : nrows;

        let wRatios = (this.widthRatios) ? this.widthRatios : new Array<number>(ncols).fill(1);
        let hRatios = (this.heightRatios) ? this.heightRatios : new Array<number>(nrows).fill(1);


        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const pos = this.positions[i];

            var x = this.canvasRect.x;

            for (let j = 0; j < pos.col; j++) {
                let p = this.positions.find(pos => pos.col === j);
                if (p) {
                    x += width * wRatios[i] / wtotalRatio;
                } else {
                    x += width * 1 / wtotalRatio;
                }
                x += this.canvasRect.w * this.horizontalSpace;
            }

            var y = this.canvasRect.y;

            for (let j = 0; j < pos.row; j++) {
                let p = this.positions.find(pos => pos.row === j);
                if (p) {
                    y += height * hRatios[i] / htotalRatio;
                } else {
                    y += height * 1 / htotalRatio;
                }
                y += this.canvasRect.h * this.verticalSpace;
            }

            item.canvasRect.x = x;
            item.canvasRect.y = y;
            item.canvasRect.w = width * wRatios[pos.col] / wtotalRatio;
            item.canvasRect.h = height * hRatios[pos.row] / htotalRatio;
        }
        //repaint
        this.paint();
    }



    addItem(item: GraphicObject, row: number = 0, col: number = 0) {
        this.positions.push({row, col});
        this.items.push(item);
        this.recalculateGrid();
    }


    
}