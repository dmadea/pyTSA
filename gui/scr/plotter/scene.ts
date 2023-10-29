import { Figure } from "./figure";
import { Grid } from "./grid";
import { GraphicObject } from "./object";
import { backgroundColor } from "./settings";
// import { Rect } from "./types";


export class Scene extends GraphicObject {

    constructor(canvas: HTMLCanvasElement) {
        super(null);
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        this.items = [];
        this.margin = {left: 0, right:0 , top: 0, bottom: 0};
        this.canvasRect = {x:0, y:0, w: this.canvas.width, h: this.canvas.height};

    }

    addFigure(){
        var figure = new Figure(this, {...this.canvasRect});
        this.items.push(figure);
        this.paint();
        return figure;
    }

    testAddGrid(){
        var grid = new Grid(this, {...this.canvasRect});
        this.items.push(grid);
        grid.addItem(new Figure(grid), 0, 0);
        grid.addItem(new Figure(grid), 0, 1);
        grid.addItem(new Figure(grid), 1, 0);
        grid.addItem(new Figure(grid), 1, 1);

        this.paint()
    }

    paint(): void {
        if (this.canvas === null || this.ctx === null)
            return;
        
        // set some dimensions

        // clear plot

        this.ctx.restore();
        // this.ctx.fillStyle = backgroundColor;
        this.ctx.clearRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
        this.ctx.save();
        console.log('initial paint from scene');

        for (const item of this.items) {
            item.paint();            
        }
    }


}

// let message: string = 'Hello World';
// console.log(message);