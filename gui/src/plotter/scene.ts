import { Figure } from "./figure";
import { Grid } from "./grid";
import { GraphicObject } from "./object";
import { backgroundColor } from "./settings";
import { NumberArray, Matrix } from "./types";
// import { Rect } from "./types";
import { Dataset, genTestData } from "./utils";



export class Scene extends GraphicObject {

    private canvasResizeObserver: ResizeObserver;
    public fig: Figure | null = null;

    constructor(canvas: HTMLCanvasElement) {
        super(null);
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        this.items = [];
        this.margin = {left: 0, right:0 , top: 0, bottom: 0};
        this.canvasRect = {x:0, y:0, w: this.canvas.width, h: this.canvas.height};
        this.canvasResizeObserver = new ResizeObserver((entries) => this.observerCallback(entries));
        this.canvasResizeObserver.observe(this.canvas);
    }

    private observerCallback(entries: ResizeObserverEntry[]) {
        window.requestAnimationFrame((): void | undefined => {
            if (!Array.isArray(entries) || !entries.length) {
              return;
            }

            if (this.canvas){
                this.canvas.width = this.canvas.clientWidth;
                this.canvas.height = this.canvas.clientHeight;
                this.resize();
            }
          });
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
        this.fig = new Figure(grid);
        this.fig.figureSettings.axisAlignment = 'horizontal';
        
        // f.plot(x, y, 'red', '-', 1);

        grid.addItem(this.fig, 0, 0);

        var f1 = new Figure(grid);
        var [x, y]  = genTestData(5);
        f1.plotLine(NumberArray.fromArray([-1, 0, 1]), NumberArray.fromArray([-1, 2, -0.5]), 'green'); 
        f1.plotLine(NumberArray.fromArray([-1, 0, 1]), NumberArray.fromArray([1, -2, 0.5]), 'red'); 

        this.fig.plotLine(x, y, 'blue', '-', 1);
    
        // test heatmap
        // var x = NumberArray.linspace(-1, 1, 100);
        // var y = NumberArray.linspace(-1, 1, 200);
        // var m = new Matrix(x.length, y.length);
        // m.fillRandom();
        // m.mul(255, false);
        // console.log(m);
        // this.fig.plotHeatmap({data: m, x, y});

        grid.addItem(f1, 0, 1);
        grid.addItem(new Figure(grid), 1, 0);
        grid.gridSettings.widthRatios = NumberArray.fromArray([2, 1]);
        grid.gridSettings.heightRatios = NumberArray.fromArray([2, 1]);

        grid.recalculateGrid(false);

        this.paint()
        // f.redrawHeatmapOffCanvas();
    }

    // public addHeatmap(dataset: Dataset) {
    //     this.fig?.plotHeatmap(dataset);
    // }


    public resize(): void {
        // set new dimensions
        if (this.canvas){
            this.canvasRect = {
                x: 0,
                y: 0,
                w: this.canvas.width,
                h: this.canvas.height
            }
        }
        //set new dimensions also for items
        for (const item of this.items) {
            item.canvasRect = this.canvasRect;
            item.resize();
        }
        super.resize();
    }

    paint(): void {
        if (this.canvas === null || this.ctx === null)
            return;
        
        // console.log(this.canvasRect);

        // clear plot

        this.ctx.restore();
        // this.ctx.fillStyle = backgroundColor;
        this.ctx.clearRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
        this.ctx.save();
        console.log('initial paint from scene');

        super.paint();

    }


}

// let message: string = 'Hello World';
// console.log(message);