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
    public dLines: DraggableLines | null = null;

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

                this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
                this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
                // console.log(window.devicePixelRatio, this.canvas.width, this.canvas.height);

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
        // this.fig.figureSettings.axisAlignment = 'vertical';
        this.fig.figureSettings.yAxis.inverted = true;
        this.fig.figureSettings.showTickNumbers = ['top', 'left', 'right'];
        
        // f.plot(x, y, 'red', '-', 1);

        grid.addItem(this.fig, 0, 0);

        var f1y = new Figure(grid);
        f1y.figureSettings.axisAlignment = 'vertical';
        f1y.figureSettings.xAxis.inverted = true;

        let n = 1000;
        var x = NumberArray.linspace(-1, 3, n, true);
        var y = NumberArray.random(-1, 3, n, false);
        console.log(x, y);
        // f1.plotLine(NumberArray.fromArray([-1, 0, 1]), NumberArray.fromArray([-1, 2, -0.5]), 'green'); 
        // f1.plotLine(NumberArray.fromArray([-1, 0, 1]), NumberArray.fromArray([1, -2, 0.5]), 'red'); 

        this.fig.plotLine(x, y, 'blue', [], 1);
        grid.addItem(f1y, 0, 1);
        
        var f2x = new Figure(grid);
        var linePlot = f2x.plotLine(new NumberArray(), new NumberArray());
        var linePlotCol = f1y.plotLine(new NumberArray(), new NumberArray());

        // f2.addDraggableLines(DraggableLines.Orientation.Both);
        
        this.fig.linkXRange(f2x);
        this.fig.linkYXRange(f1y);

        // this.fig.linkYRange(f1);
        
        grid.addItem(f2x, 1, 0);
        this.dLines = this.fig.addDraggableLines(DraggableLines.Orientation.Both);
        this.dLines.addPositionChangedListener((pos) => {
            // console.log('position changed', pos);
            if (this.fig?.heatmap) {

                f2x.figureSettings.xAxis.scale = this.fig.figureSettings.xAxis.scale;
                f1y.figureSettings.xAxis.scale = this.fig.figureSettings.yAxis.scale;

                // get row
                let idxy = this.fig.heatmap.dataset.y.nearestIndex(pos.realPosition.y);
                let row = this.fig.heatmap.dataset.data.getRow(idxy);

                let idxx = this.fig.heatmap.dataset.x.nearestIndex(pos.realPosition.x);
                let col = this.fig.heatmap.dataset.data.getCol(idxx);

                if (linePlot.x.length !== this.fig.heatmap.dataset.y.length) {
                    linePlot.x = this.fig.heatmap.dataset.x;
                }

                linePlot.y = row;
                
                linePlotCol.x = this.fig.heatmap.dataset.y;
                linePlotCol.y = col;
                
                f1y.repaint();
                f2x.repaint();
                // console.log(col);


            }            

        });

        grid.gridSettings.widthRatios = NumberArray.fromArray([2, 1]);
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