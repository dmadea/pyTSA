import { Colormap, Colormaps, getDefaultColor } from "./plotter/color";
import { DraggableLines, Orientation } from "./plotter/draggableLines";
import { Colorbar, Figure, ILinePlot } from "./plotter/figure/figure";
import { Grid } from "./plotter/grid";
import { LayoutScene } from "./plotter/layoutscene";
import { Scene } from "./plotter/scene";
import { NumberArray } from "./plotter/types";
import { Dataset, loadData } from "./plotter/utils";
import { arr2json } from "./utils";


export class SceneUser extends LayoutScene {

    public fig: Figure | null = null;
    public figy: Figure | null = null;
    public figx: Figure | null = null;
    public dLines: DraggableLines | null = null;
    public colorbar: Colorbar | null = null;

    public datasets: Dataset[] = [];

    public dLinesArr: DraggableLines[] = [];

    // public figTrace: Figure | null = null;
    // public figSpecrum: Figure | null = null;

    constructor(parentElement: HTMLDivElement) {
        super(parentElement);

        this.grid = new Grid(this);
        this.addItem(this.grid);
    }

    public addFigure(){
        var figure = new Figure(this, {...this.canvasRect});
        this.items.push(figure);
        this.repaint();
        return figure;
    }

    public testWasmLoad(buffer: ArrayBuffer) {
        if (!this.wasm) return;

        console.log(buffer);

        var view = new Uint8Array(this.wasm.memory.buffer);
        console.log(view);

        const dataPtr = 0;
        view.set(new Uint8Array(buffer), dataPtr);

        const byteLength = buffer.byteLength;

        var f = this.wasm.exports._Z5abcdePcm as CallableFunction;
        var num = f(dataPtr, byteLength);


        console.log(num);

    }

    public loadFiles(files: FileList) {

        if(!files) return;
        
        this.datasets = [];
        var processed: boolean[] = new Array<boolean>(files.length);
        processed.fill(false);
        // var names: string[] = [];

        // console.log(processed);

        const t = this;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();
            const index = i;
            console.time('start loading');
            reader.addEventListener('load', function (e) {

                if (reader.result instanceof ArrayBuffer){
                    t.testWasmLoad(reader.result)
                }

                if (!(typeof reader.result === 'string')) return;

                const ext = file.name.split('.').pop()?.toLowerCase();

                const dataset = loadData(reader.result, (ext === 'csv') ? ',' : '\t');
                // dataset?.transpose();
                console.timeEnd('start loading');

                if (ext === 'txt') {
                    dataset?.transpose();
                }
                processed[index] = true;
                // names[index] = file.name;

                if (dataset) {
                    dataset.name = file.name;
                    t.datasets[index] = dataset;
                }

                // console.log(index, "processing", file);

                if (processed.every(entry => entry)) {
                    t.processDatasets();
                    t.postDatasets();
                }
            });
            reader.readAsBinaryString(file);
            // reader.readAsArrayBuffer(file);
        }
    }

    private postDatasets() {
        const xhr = new XMLHttpRequest();

        var datasets = [];
        for (const d of this.datasets) {
            datasets.push({
                times: arr2json(d.y),
                wavelengths: arr2json(d.x),
                matrix: {
                    data: arr2json(d.data),
                    c_contiguous: d.data.isCContiguous
                },
                name: d.name
            });
        }

        var data = {
            data: {
                datasets: datasets
            }
        }
        console.log(datasets[0]);

        xhr.onreadystatechange = () => {
            if (xhr.readyState == 4 && xhr.status == 200) {
                console.log('Success');
            }
        };
        // asynchronous requests
        xhr.open("POST", "/api/post_datasets", true);
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

        // Send the request over the network
        xhr.send(JSON.stringify(data));
    }

    public processDatasets() {
        
        // this.clear();

        this.groupPlots = [];
        // this.traceFigures = [];
        // this.spectraFigures = [];

        const n = this.datasets.length;

        this.populateFigures(n);

        for (let i = 0; i < n; i++) {
            const idx = i;
            const ds = this.datasets[i];
            const hfig = this.groupPlots[i].heatmapFig;
            const spectrum = this.groupPlots[i].spectrum;
            const trace = this.groupPlots[i].trace;
            const tracePlot = this.groupPlots[i].tracePlot;
            const spectrumPlot = this.groupPlots[i].spectrumPlot;

            // hfig.yAxis.inverted = true;
            // trace.xAxis.inverted = true;

            const cbar = hfig.addColorbar();
            const hmap = hfig.plotHeatmap(ds, new Colormap(Colormaps.symgrad));
            cbar.linkHeatMap(hmap);
            cbar.viewAll();
            hfig.xAxis.setViewBounds([ds.x[0], ds.x[ds.x.length - 1]]);
            hfig.yAxis.setViewBounds([ds.y[0], ds.y[ds.y.length - 1]]);
            hfig.title = ds.name;

            trace.xAxis.scale = hfig.yAxis.scale;
            spectrum.xAxis.scale = hfig.xAxis.scale;

            trace.xAxis.setViewBounds([ds.y[0], ds.y[ds.y.length - 1]]);
            spectrum.xAxis.setViewBounds([ds.x[0], ds.x[ds.x.length - 1]]);

            spectrumPlot.x = hmap.dataset.x;
            tracePlot.x = hmap.dataset.y;

            this.groupPlots[i].heatmapDLines.addPositionChangedListener((e) => {
                if (e.yChanged) {
                    let idxy = hmap.dataset.y.nearestIndex(e.realPosition.y);
                    let row = hmap.dataset.data.getRow(idxy);
                    spectrumPlot.y = row;
                    spectrum.replot();
                }

                if (e.xChanged) {
                    let idxx = hmap.dataset.x.nearestIndex(e.realPosition.x);
                    let col = hmap.dataset.data.getCol(idxx);
                    tracePlot.y = col;
                    trace.replot();
                }
            });

            this.groupPlots[i].spectrumDLines.addPositionChangedListener((e) => {
                let idxx = hmap.dataset.x.nearestIndex(e.realPosition.x);
                let col = hmap.dataset.data.getCol(idxx);
                tracePlot.y = col;
                trace.replot();
            });

            this.groupPlots[i].traceDLines.addPositionChangedListener((e) => {
                let idxy = hmap.dataset.y.nearestIndex(e.realPosition.x);
                let row = hmap.dataset.data.getRow(idxy);
                spectrumPlot.y = row;
                spectrum.replot();

            });
            
        }

        this.arangeFigures();

        this.repaint();
        setTimeout(() => this.resize(), 100);

        // var figy = new Figure();
        // // figy.xAxis.scale = 'lin';
        // figy.xAxis.symlogLinthresh = 2;
        // figy.xAxis.symlogLinscale = 2;
        // figy.xAxis.autoscale = false;
        // figy.yAxis.autoscale = true;    
        // this.figTrace = figy;

        // var figx = new Figure();
        // // figy.xAxis.scale = 'lin';
        // figx.xAxis.symlogLinthresh = 2;
        // figx.xAxis.symlogLinscale = 2;
        // figx.xAxis.autoscale = false;
        // figx.yAxis.autoscale = true;    
        // figx.xAxis.label = 'Wavelength / nm';
        // figy.xAxis.label = 'Time / ps';
        // figy.showTickNumbers = ['left', 'bottom'];
        // figx.showTickNumbers = ['left', 'bottom'];


        // this.figSpecrum = figx;

        // this.grid.addItem(figy, 1, 0, 1, n);
        // this.grid.addItem(figx, 2, 0, 1, n);

        // var ly = figy.addDraggableLines(DraggableLines.Orientation.Vertical);
        // var lx = figx.addDraggableLines(DraggableLines.Orientation.Vertical);

        // // var spectra: ILinePlot[] = Array<ILinePlot>(n);
        // // var traces: ILinePlot[] = Array<ILinePlot>(n);

        // // var linePlot = figx.plotLine(new NumberArray(), new NumberArray());
        // // var linePlotCol = figy.plotLine(new NumberArray(), new NumberArray());

        // figx.linkMargin(figy, Orientation.Vertical);

        // // ly.addPositionChangedListener((e) => {
        // //     if (this.fig?.heatmap) {
        // //         let idxy = this.fig.heatmap.dataset.y.nearestIndex(e.realPosition.x);
        // //         let row = this.fig.heatmap.dataset.data.getRow(idxy);

        // //         linePlot.y = row;

        // //         figx.repaint();
        // //     }
        // // });

        // // lx.addPositionChangedListener((e) => {
        // //     if (this.fig?.heatmap) {
        // //         let idxx = this.fig.heatmap.dataset.x.nearestIndex(e.realPosition.x);
        // //         let col = this.fig.heatmap.dataset.data.getCol(idxx);

        // //         linePlotCol.x = this.fig.heatmap.dataset.y;
        // //         linePlotCol.y = col;

        // //         figy.repaint();
        // //     }
        // // });

        // for (let i = 0; i < n; i++) {
        //     // dataset.data.log();
        //     const dataset = this.datasets[i];

        //     var heatmapFig = new Figure();
        //     this.heatmapFigures.push(heatmapFig);
        //     heatmapFig.yAxis.inverted = true;
        //     heatmapFig.yAxis.label = 'Time / ps';
        //     heatmapFig.xAxis.label = 'Wavelength / nm';
        //     heatmapFig.title = names[i];
        //     heatmapFig.showTickNumbers = ['left', 'bottom'];
        //     const heatmap = heatmapFig.plotHeatmap(dataset, new Colormap(Colormaps.symgrad));
        //     this.colorbar = heatmapFig.addColorbar(new Colormap(Colormaps.symgrad));
        //     this.colorbar.linkHeatMap(heatmap)
            
        //     this.grid.addItem(heatmapFig, 0, i);

        //     let xdiff, ydiff, xOffset, yOffset;
            
        //     if (!heatmap.isXRegular) {
        //         xdiff = 1;
        //         xOffset = 0;
        //     } else {
        //         xdiff = (dataset.x[dataset.x.length - 1] - dataset.x[0]) / (dataset.x.length - 1);
        //         xOffset = dataset.x[0];
        //     }
    
        //     // y axis
    
        //     if (!heatmap.isYRegular) {
        //         ydiff = 1;
        //         yOffset = 0;
        //     } else {
        //         ydiff = (dataset.y[dataset.y.length - 1] - dataset.y[0]) / (dataset.y.length - 1);
        //         yOffset = dataset.y[0];
        //     }

        //     var dLines = heatmapFig.addDraggableLines(DraggableLines.Orientation.Both);
        //     this.dLinesArr.push(dLines);
        //     dLines.setStickGrid(xdiff, xOffset, ydiff, yOffset);
        //     heatmapFig.setViewBounds([dataset.x[0], dataset.x[dataset.x.length - 1]], [dataset.y[0], dataset.y[dataset.y.length - 1]]);

        //     heatmapFig.linkXRange(figx);
        //     heatmapFig.linkYXRange(figy);  
            
        //     const index = i;
        //     const color = getDefaultColor(index);

        //     const linePlot = figx.plotLine(new NumberArray(), new NumberArray(), color);
        //     const linePlotCol = figy.plotLine(new NumberArray(), new NumberArray(), color);

        //     dLines.addPositionChangedListener((e) => {

        //         if (e.yChanged) {
        //                 // get row
        //             let idxy = heatmap.dataset.y.nearestIndex(e.realPosition.y);
        //             let row = heatmap.dataset.data.getRow(idxy);
        //             linePlot.y = row;
        //             figx.repaint();
        //         }

        //         if (e.xChanged) {
        //             let idxx = heatmap.dataset.x.nearestIndex(e.realPosition.x);
        //             let col = heatmap.dataset.data.getCol(idxx);
    
        //             if (linePlot.x.length !== heatmap.dataset.y.length) {
        //                 linePlot.x = heatmap.dataset.x;
        //             }
        //             linePlotCol.x = heatmap.dataset.y;
        //             linePlotCol.y = col;
        //             figy.repaint();
        //         }
    
        //     });
    
        //     dLines.linkX(lx);
        //     dLines.linkYX(ly);
        //     dLines.positionChanged(true, true);
        // }

        // this.grid.gridSettings.heightRatios = NumberArray.fromArray([2, 1, 1]);

        // // combinations
        // for (let i = 0; i < this.figHeatmaps.length - 1; i++) {
        //     for (let j = 1; j < this.figHeatmaps.length; j++) {
                
        //         this.figHeatmaps[i].linkXRange(this.figHeatmaps[j]);
        //         this.figHeatmaps[i].linkYRange(this.figHeatmaps[j]);

        //         this.dLinesArr[i].linkX(this.dLinesArr[j]);
        //         this.dLinesArr[i].linkY(this.dLinesArr[j]);

        //     }
        // }


        // this.repaint();
        // this.resize();
    
            // for (let i = 0; i < dataset.x.length; i++) {
            //     var col = dataset.data.getCol(i);
            //     const color = Colormap.getColor(i / (dataset.x.length - 1), Colormap.symgrad);
            //     scene.figy?.plotLine(dataset.y, col, Colormap.getStringColor(color), [], 1)
            // }
            
            // scene.figx?.clearPlots();
            // for (let i = 0; i < dataset.y.length; i+= 2) {
            //     var row = dataset.data.getRow(i);
            //     const color = Colormap.getStringColor(i / (dataset.y.length - 1), Colormap.jet);
            //     scene.figx?.plotLine(dataset.x, row, color, [], 1)
            // }

            // scene.repaint();
    }

    testAddGrid(){
        // this.calcEffectiveRect();
        var grid = new Grid(this);
        this.addItem(grid);
        // this.items.push(grid);

        this.fig = new Figure();
        // this.fig.axisAlignment = Orientation.Horizontal;
        this.fig.yAxis.inverted = true;
        // this.fig.showTickNumbers = ['top', 'left'];
        this.fig.yAxis.label = 'Time / ps';
        this.fig.xAxis.label = 'Wavelength / nm';
        this.colorbar = this.fig.addColorbar(new Colormap(Colormaps.symgrad));
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
        this.dLines.addPositionChangedListener((e) => {
            // console.log('position changed', pos);
            if (this.fig?.heatmap) {

                // this.figx.figureSettings.xAxis.scale = this.fig.figureSettings.xAxis.scale;
                // this.figy.xAxis.scale = this.fig.yAxis.scale;

                if (e.yChanged) {
                     // get row
                    let idxy = this.fig.heatmap.dataset.y.nearestIndex(e.realPosition.y);
                    let row = this.fig.heatmap.dataset.data.getRow(idxy);
                    linePlot.y = row;
                    this.figx?.replot();
                }

                if (e.xChanged) {
                    let idxx = this.fig.heatmap.dataset.x.nearestIndex(e.realPosition.x);
                    let col = this.fig.heatmap.dataset.data.getCol(idxx);
    
                    if (linePlot.x.length !== this.fig.heatmap.dataset.y.length) {
                        linePlot.x = this.fig.heatmap.dataset.x;
                    }
                    linePlotCol.x = this.fig.heatmap.dataset.y;
                    linePlotCol.y = col;
                    fy.replot();
                }

            }            
        });

        var ly = this.figy.addDraggableLines(DraggableLines.Orientation.Vertical);
        var lx = this.figx.addDraggableLines(DraggableLines.Orientation.Vertical);

        ly.addPositionChangedListener((e) => {
            if (this.fig?.heatmap) {
                let idxy = this.fig.heatmap.dataset.y.nearestIndex(e.realPosition.x);
                let row = this.fig.heatmap.dataset.data.getRow(idxy);

                linePlot.y = row;

                this.figx?.replot();
            }
        });


        lx.addPositionChangedListener((e) => {
            if (this.fig?.heatmap) {
                let idxx = this.fig.heatmap.dataset.x.nearestIndex(e.realPosition.x);
                let col = this.fig.heatmap.dataset.data.getCol(idxx);

                linePlotCol.x = this.fig.heatmap.dataset.y;
                linePlotCol.y = col;

                fy.replot();
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



}
