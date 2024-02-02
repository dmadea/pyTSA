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

export class SceneData extends LayoutScene {

  public datasets: Dataset[] = [];
  public fitDataset: Dataset | null = null;

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

      const traceFitPlot = this.groupPlots[i].traceFitPlot;
      const spectrumFitPlot = this.groupPlots[i].spectrumFitPlot;
      traceFitPlot.color = 'red';
      spectrumFitPlot.color = 'red';

      // hfig.yAxis.inverted = true;
      // trace.xAxis.inverted = true;

      const cbar = hfig.addColorbar();
      const hmap = hfig.plotHeatmap(ds, new Colormap(Colormaps.symgrad));
      cbar.linkHeatMap(hmap);
      cbar.viewAll();

      hfig.xAxis.viewBounds = [ds.x[0], ds.x[ds.x.length - 1]];
      hfig.yAxis.viewBounds = [ds.y[0], ds.y[ds.y.length - 1]];
      // console.log("x", hfig.xAxis.scale, "y", hfig.yAxis.scale);
      // console.log("x", hfig.xAxis.viewBounds, "y", hfig.yAxis.viewBounds);

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
          
          if (this.fitDataset) {
            spectrumFitPlot.x = this.fitDataset.x;
            spectrumFitPlot.y = this.fitDataset.data.getRow(idxy);
          }

          spectrum.replot();
        }

        if (e.xChanged) {
          const idxx = hmap.dataset.x.nearestIndex(e.realPosition.x);
          const col = hmap.dataset.data.getCol(idxx);
          tracePlot.y = col;

          if (this.fitDataset) {
            traceFitPlot.x = this.fitDataset.y;
            traceFitPlot.y = this.fitDataset.data.getCol(idxx);
          }

          trace.replot();
        }
      });

      this.groupPlots[i].spectrumDLines.addPositionChangedListener((e) => {
        const idxx = hmap.dataset.x.nearestIndex(e.realPosition.x);
        const col = hmap.dataset.data.getCol(idxx);
        tracePlot.y = col;

        if (this.fitDataset) {
          traceFitPlot.x = this.fitDataset.y;
          traceFitPlot.y = this.fitDataset.data.getCol(idxx);
        }

        trace.replot();
      });

      this.groupPlots[i].traceDLines.addPositionChangedListener((e) => {
        const idxy = hmap.dataset.y.nearestIndex(e.realPosition.x);
        const row = hmap.dataset.data.getRow(idxy);
        spectrumPlot.y = row;

        if (this.fitDataset) {
          spectrumFitPlot.x = this.fitDataset.x;
          spectrumFitPlot.y = this.fitDataset.data.getRow(idxy);
        }

        spectrum.replot();
      });
    }

    this.arangeFigures();

    this.repaint();
    setTimeout(() => this.resize(), 100);

   }
}
