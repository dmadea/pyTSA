import { Figure } from "./figure";
import { GraphicObject } from "./object";
// import { Rect } from "./types";


export class Scene extends GraphicObject {

    constructor(canvas: HTMLCanvasElement) {
        super(null);
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        this.items = [];
        this.margin = {left: 0, right:0 , top: 0, bottom: 0};
        this.canvasRect = {x:0, y:0, w: this.canvas.width, h: this.canvas.height};
        this.canvas.addEventListener('mousedown', e => this.mouseDown(e));
        this.canvas.addEventListener('mouseup', e => this.mouseUp(e));
        this.canvas.addEventListener('mousemove', e => this.mouseMove(e));
        this.canvas.addEventListener("contextmenu", e => this.contextMenu(e));
    }

    mouseDown(e: MouseEvent): void {
        super.mouseDown(e);
        for (const item of this.items) {
            item.mouseDown(e);           
        }
    }

    mouseUp(e: MouseEvent): void {
        super.mouseUp(e);
        for (const item of this.items) {
            item.mouseUp(e);           
        }
    }

    mouseMove(e: MouseEvent): void {
        super.mouseMove(e);
        // console.log('mouse moving', this.items, e.offsetX,e.offsetY);
        for (const item of this.items) {
            item.mouseMove(e);           
        }
    }

    contextMenu(e: MouseEvent): void {
        super.contextMenu(e);
        for (const item of this.items) {
            item.contextMenu(e);           
        }
    }

    addFigure(){
        var figure = new Figure(this, {...this.canvasRect});
        this.items.push(figure);
        this.paint();
        return figure;
    }

    paint(): void {
        if (this.canvas === null || this.ctx === null)
            return;
        
        // set some dimensions

        // clear plot

        this.ctx.restore();
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