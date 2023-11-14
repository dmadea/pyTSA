import { Figure } from "./figure";
import { Grid } from "./grid";
import { DraggableLines, GraphicObject, IPaintEvent } from "./object";
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

        this.canvas.addEventListener('mousedown', e => this.mouseDown(e));
        this.canvas.addEventListener('mouseup', e => this.mouseUp(e));
        this.canvas.addEventListener('mousemove', e => this.mouseMove(e));
        this.canvas.addEventListener("contextmenu", e => this.contextMenu(e));
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
        this.repaint();
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

        this.fig.plotLine(x, y, 'blue', [], 1);
        grid.addItem(f1, 0, 1);
        
        var f2 = new Figure(grid);
        var linePlot = f2.plotLine(new NumberArray(), new NumberArray());
        // f2.addDraggableLines(DraggableLines.Orientation.Both);
        
        this.fig.linkXRange(f2);
        // this.fig.linkYRange(f1);
        
        grid.addItem(f2, 1, 0);
        var lines = this.fig.addDraggableLines(DraggableLines.Orientation.Both);
        lines.addPositionChangedListener((pos) => {
            // console.log('position changed', pos);
            if (this.fig?.heatmap) {

                // get row
                let idx = this.fig.heatmap.dataset.y.nearestIndex(pos.y);
                let row = this.fig.heatmap.dataset.data.getRow(idx);

                if (linePlot.x.length !== this.fig.heatmap.dataset.y.length) {
                    linePlot.x = this.fig.heatmap.dataset.x;
                }

                linePlot.y = row;
                f2.repaint();

                // console.log(col);


            }            

        });

        grid.gridSettings.widthRatios = NumberArray.fromArray([3, 1]);
        grid.gridSettings.heightRatios = NumberArray.fromArray([2, 1]);

        grid.recalculateGrid(false);

        this.repaint()
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

    public paint(e: IPaintEvent): void {
        // console.log(this.canvasRect);

        // clear plot

        e.ctx.restore();
        // this.ctx.fillStyle = backgroundColor;
        e.ctx.clearRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
        e.ctx.save();
        console.log('initial paint from scene');

        super.paint(e);

    }


}

// let message: string = 'Hello World';
// console.log(message);