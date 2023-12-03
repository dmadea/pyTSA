import { Colormap, getDefaultColor, hsvColor } from "./color";
import { DraggableLines, Orientation } from "./draggableLines";
import { Figure } from "./figure/figure";
import { EmptySpace, Grid } from "./grid";
import {  GraphicObject, IMouseEvent, IPaintEvent } from "./object";
import { backgroundColor } from "./settings";
import { NumberArray, Matrix } from "./types";
// import { Rect } from "./types";



export class Scene extends GraphicObject {

    private canvasResizeObserver: ResizeObserver;
    public fig: Figure | null = null;
    public figy: Figure | null = null;
    public figx: Figure | null = null;
    public dLines: DraggableLines | null = null;

    constructor(canvas: HTMLCanvasElement) {
        super();
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        this.items = [];
        this.margin = {left: 10, right:10 , top: 10, bottom: 10};
        this.canvasRect = {x:0, y:0, w: this.canvas.width, h: this.canvas.height};
        this.canvasResizeObserver = new ResizeObserver((entries) => this.observerCallback(entries));
        this.canvasResizeObserver.observe(this.canvas);

        const dpr = window.devicePixelRatio;

        this.canvas.addEventListener('mousedown', e => this.mouseDown({e, canvas, x: e.offsetX * dpr, y: e.offsetY * dpr}));
        this.canvas.addEventListener('mouseup', e => this.mouseUp({e, canvas, x: e.offsetX * dpr, y: e.offsetY * dpr}));
        this.canvas.addEventListener('mousemove', e => this.mouseMove({e, canvas, x: e.offsetX * dpr, y: e.offsetY * dpr}));
        this.canvas.addEventListener("contextmenu", e => this.showContextMenu({e, canvas, x: e.offsetX * dpr, y: e.offsetY * dpr}));
        this.canvas.addEventListener("dblclick", e => this.doubleClick({e, canvas, x: e.offsetX * dpr, y: e.offsetY *dpr}));

        this.canvas.addEventListener("touchstart", e => this.touchStart(e));
        this.canvas.addEventListener("touchmove", e => this.touchMove(e));
        this.canvas.addEventListener("touchend", e => this.touchEnd(e));

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
        // this.calcEffectiveRect();
        var grid = new Grid(this, {...this.effRect});
        this.addItem(grid);
        // this.items.push(grid);

        this.fig = new Figure();
        // this.fig.axisAlignment = Orientation.Horizontal;
        this.fig.yAxis.inverted = true;
        // this.fig.showTickNumbers = ['top', 'left'];
        this.fig.yAxis.label = 'Time / ps';
        this.fig.xAxis.label = 'Wavelength / nm';
        // this.fig.xAxis.scale = 'symlog';
        // this.fig.yAxis.scale = 'symlog';


        // this.fig.minimalMargin.left = 200;

        
        // var gridInner = new Grid();
        // grid.addItem(gridInner, 0, 1);
        this.figy = new Figure();
        // this.figy.axisAlignment = 'vertical';
        // this.figy.xAxis.inverted = true;
        this.figy.xAxis.scale = 'lin';
        this.figy.xAxis.symlogLinthresh = 2;
        this.figy.xAxis.symlogLinscale = 2;
        this.figy.xAxis.autoscale = false;
        this.figy.yAxis.autoscale = true;    


        const n = 1000;
        const nSpectra = 50;
        // for (let i = 0; i < nSpectra; i++) {
        //     var x = NumberArray.linspace(-Math.PI, Math.PI, n, true);
        //     var y = x.copy().apply(num => Math.sin(1 * num + 2 * i * Math.PI / (nSpectra - 1)));
        //     const color = Colormap.getStringColor(i / (nSpectra - 1), Colormap.hot);
        //     this.figy.plotLine(x, y, color, [], 0.5);
        // }




        // this.figy.showTickNumbers = ['top', 'right', 'bottom'];
        // this.figy.yAxis.label = 'Amplitude';

        // grid.addItem(this.figy, 1, 0);


        // let n = 1000;
        var x = NumberArray.linspace(-1, 3, n, true);
        var y = NumberArray.random(-1, 3, n, false);
        this.fig.plotLine(x, y, 'blue', [], 1);
        // console.log(x, y);
        // f1.plotLine(NumberArray.fromArray([-1, 0, 1]), NumberArray.fromArray([-1, 2, -0.5]), 'green'); 
        // f1.plotLine(NumberArray.fromArray([-1, 0, 1]), NumberArray.fromArray([1, -2, 0.5]), 'red'); 

        
        this.figx = new Figure();
        this.figx.xAxis.label = 'Wavelength / nm';
        this.figy.xAxis.label = 'Time / ps';
        this.figx.xAxis.autoscale = false;
        this.figx.yAxis.autoscale = true;



        // this.figx.figureSettings.yAxis.label = 'Amplitude';
        
        // this.figx.figureSettings.showTickNumbers = ['left', 'bottom'];
        // this.figx.minimalMargin.left = 200;
        
        
        var linePlot = this.figx.plotLine(new NumberArray(), new NumberArray());
        var linePlotCol = this.figy.plotLine(new NumberArray(), new NumberArray());
        
        // f2.addDraggableLines(DraggableLines.Orientation.Both);
        
        this.fig.linkXRange(this.figx);
        this.fig.linkYXRange(this.figy);  
        
        // this.fig.linkMargin(this.figx, Orientation.Horizontal);
        // this.fig.linkMargin(this.figy, Orientation.Vertical);
        
        
        // this.fig.linkYRange(f1);
        grid.addItem(this.fig, 0, 0, 2, 1);
        grid.addItem(this.figy, 0, 1, 1, 1);
        grid.addItem(this.figx, 1, 1, 1, 1);
        // grid.addItem(new EmptySpace(), 0, 1);
        // gridInner.addItem(new Figure(), 0, 0);

        const fy = this.figy;

        this.dLines = this.fig.addDraggableLines(DraggableLines.Orientation.Both);
        this.dLines.addPositionChangedListener((pos) => {
            // console.log('position changed', pos);
            if (this.fig?.heatmap) {

                // this.figx.figureSettings.xAxis.scale = this.fig.figureSettings.xAxis.scale;
                // this.figy.xAxis.scale = this.fig.yAxis.scale;

                if (pos.yChanged) {
                     // get row
                    let idxy = this.fig.heatmap.dataset.y.nearestIndex(pos.realPosition.y);
                    let row = this.fig.heatmap.dataset.data.getRow(idxy);
                    linePlot.y = row;
                    this.figx?.repaint();
                }

                if (pos.xChanged) {
                    let idxx = this.fig.heatmap.dataset.x.nearestIndex(pos.realPosition.x);
                    let col = this.fig.heatmap.dataset.data.getCol(idxx);
    
                    if (linePlot.x.length !== this.fig.heatmap.dataset.y.length) {
                        linePlot.x = this.fig.heatmap.dataset.x;
                    }
                    linePlotCol.x = this.fig.heatmap.dataset.y;
                    linePlotCol.y = col;
                    fy.repaint();
                }

            }            
        });

        var ly = this.figy.addDraggableLines(DraggableLines.Orientation.Vertical);
        var lx = this.figx.addDraggableLines(DraggableLines.Orientation.Vertical);

        ly.addPositionChangedListener((pos) => {
            if (this.fig?.heatmap) {
                let idxy = this.fig.heatmap.dataset.y.nearestIndex(pos.realPosition.x);
                let row = this.fig.heatmap.dataset.data.getRow(idxy);

                linePlot.y = row;

                this.figx?.repaint();
            }
        });


        lx.addPositionChangedListener((pos) => {
            if (this.fig?.heatmap) {
                let idxx = this.fig.heatmap.dataset.x.nearestIndex(pos.realPosition.x);
                let col = this.fig.heatmap.dataset.data.getCol(idxx);

                linePlotCol.x = this.fig.heatmap.dataset.y;
                linePlotCol.y = col;

                fy.repaint();
            }
        });

        this.dLines.linkX(lx);
        this.dLines.linkYX(ly);

        // grid.gridSettings.widthRatios = NumberArray.fromArray([2, 1]);
        // grid.gridSettings.heightRatios = NumberArray.fromArray([2, 1]);

        // grid.recalculateGrid(false);
        // gridInner.recalculateGrid(false);

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
        super.resize();
        this.repaint();
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
    
    public mouseMove(e: IMouseEvent): void {
        // if (this.canvas) {
        //     this.canvas.style.cursor = this.cursors.default;
        // }

        super.mouseMove(e);

    }


}

// let message: string = 'Hello World';
// console.log(message);