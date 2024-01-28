import {
  Figure,
  Colorbar,
  DraggableLines,
  Dataset,
  LayoutScene,
  Grid,
  Colormap,
  Colormaps,
} from "@pytsa/ts-graph";

import { arr2json, loadData } from "./utils";

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

  public addFigure() {
    const figure = new Figure(this, { ...this.canvasRect });
    this.items.push(figure);
    this.repaint();
    return figure;
  }

  // public testWasmLoad(buffer: ArrayBuffer) {
  //   if (!this.wasm) return;

  //   console.log(buffer);

  //   const view = new Uint8Array(this.wasm.memory.buffer);
  //   console.log(view);

  //   const dataPtr = 0;
  //   view.set(new Uint8Array(buffer), dataPtr);

  //   const byteLength = buffer.byteLength;

  //   const f = this.wasm.exports._Z5abcdePcm as CallableFunction;
  //   const num = f(dataPtr, byteLength);

  //   console.log(num);
  // }

  public updateData(datasets: Dataset[]) {
    if (datasets.length !== this.datasets.length) {
      throw Error("Length of updated datasets must me the same as those plotted.");
    }

    const n = this.datasets.length;

    for (let i = 0; i < n; i++) {
      this.datasets[i] = datasets[i];

      const ds = this.datasets[i];
      const hfig = this.groupPlots[i].heatmapFig;
      const spectrum = this.groupPlots[i].spectrum;
      const trace = this.groupPlots[i].trace;
      const tracePlot = this.groupPlots[i].tracePlot;
      const spectrumPlot = this.groupPlots[i].spectrumPlot;

      hfig.plotHeatmap(ds, new Colormap(Colormaps.symgrad));
      hfig.xAxis.viewBounds = [ds.x[0], ds.x[ds.x.length - 1]];
      hfig.yAxis.viewBounds = [ds.y[0], ds.y[ds.y.length - 1]];
      hfig.title = ds.name;

      spectrumPlot.x = ds.x;
      tracePlot.x = ds.y;
      trace.xAxis.viewBounds = [ds.y[0], ds.y[ds.y.length - 1]];
      spectrum.xAxis.viewBounds = [ds.x[0], ds.x[ds.x.length - 1]];
      
      hfig.heatmap?.recalculateImage();
    }

    this.repaint();
    setTimeout(() => this.resize(), 100);
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

      hfig.xAxis.viewBounds = [ds.x[0], ds.x[ds.x.length - 1]];
      hfig.yAxis.viewBounds = [ds.y[0], ds.y[ds.y.length - 1]];
      console.log("x", hfig.xAxis.scale, "y", hfig.yAxis.scale);
      console.log("x", hfig.xAxis.viewBounds, "y", hfig.yAxis.viewBounds);

      hfig.title = ds.name;

      trace.xAxis.scale = hfig.yAxis.scale;
      spectrum.xAxis.scale = hfig.xAxis.scale;

      trace.xAxis.viewBounds = [ds.y[0], ds.y[ds.y.length - 1]];
      spectrum.xAxis.viewBounds = [ds.x[0], ds.x[ds.x.length - 1]];

      spectrumPlot.x = ds.x;
      tracePlot.x = ds.y;

      this.groupPlots[i].heatmapDLines.addPositionChangedListener((e) => {
        if (e.yChanged) {
          const idxy = hmap.dataset.y.nearestIndex(e.realPosition.y);
          const row = hmap.dataset.data.getRow(idxy);
          spectrumPlot.y = row;
          spectrum.replot();
        }

        if (e.xChanged) {
          const idxx = hmap.dataset.x.nearestIndex(e.realPosition.x);
          const col = hmap.dataset.data.getCol(idxx);
          tracePlot.y = col;
          trace.replot();
        }
      });

      this.groupPlots[i].spectrumDLines.addPositionChangedListener((e) => {
        const idxx = hmap.dataset.x.nearestIndex(e.realPosition.x);
        const col = hmap.dataset.data.getCol(idxx);
        tracePlot.y = col;
        trace.replot();
      });

      this.groupPlots[i].traceDLines.addPositionChangedListener((e) => {
        const idxy = hmap.dataset.y.nearestIndex(e.realPosition.x);
        const row = hmap.dataset.data.getRow(idxy);
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
}
