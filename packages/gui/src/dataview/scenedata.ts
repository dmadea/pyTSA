import { Dataset, LayoutScene, Colormap, Colormaps, NumberArray } from "@pytsa/ts-graph";

interface IUpdateFunctions {
  updateTrace: (value: number) => void,
  updateSpectrum: (value: number) => void,
}

export class SceneData extends LayoutScene {

  public datasets: Dataset[] = [];
  public fitDataset: Dataset | null = null;
  public updateFuncions: IUpdateFunctions[] = [];
  public chirpData: NumberArray | null = null;

  public updateFitData(fitDataset: Dataset, chirpData?: NumberArray) {
    this.fitDataset = fitDataset;
    this.chirpData = chirpData ?? null;

    const hfig = this.groupPlots[0].heatmapFig;

    if (this.chirpData && hfig.linePlots.length === 0) {
      hfig.plotLine(this.datasets[0].x, this.chirpData, "black", [], 3);
    } else if (this.chirpData && hfig.linePlots.length !== 0) {
      hfig.linePlots[0].x = this.datasets[0].x;
      hfig.linePlots[0].y = this.chirpData;
    }

    this.replot();
  }

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

    this.replot();
    setTimeout(() => this.resize(), 100);
  }

  public processDatasets() {
    // this.clear();

    this.groupPlots = [];
    // this.traceFigures = [];
    // this.spectraFigures = [];

    const n = this.datasets.length;

    this.populateFigures(n);
    this.updateFuncions = [];

    for (let i = 0; i < n; i++) {
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

      const updateSpectrumData = (y: number) => {
        const idxy = hmap.dataset.y.nearestIndex(y);
        const row = hmap.dataset.data.getRow(idxy);
        spectrumPlot.y = row;
        
        if (this.fitDataset) {
          spectrumFitPlot.x = this.fitDataset.x;
          spectrumFitPlot.y = this.fitDataset.data.getRow(idxy);
        }

        spectrum.replot();
      }

      const updateTraceData = (x: number) => {
        const idxx = hmap.dataset.x.nearestIndex(x);
        const col = hmap.dataset.data.getCol(idxx);
        tracePlot.y = col;

        if (this.fitDataset) {
          traceFitPlot.x = this.fitDataset.y;
          traceFitPlot.y = this.fitDataset.data.getCol(idxx);
        }

        trace.replot();
      }

      this.updateFuncions.push({
        updateTrace: updateTraceData,
        updateSpectrum: updateSpectrumData
      });

      this.groupPlots[i].heatmapDLines.addPositionChangedListener((e) => {
        if (e.yChanged) {
          updateSpectrumData(e.realPosition.y);
        }

        if (e.xChanged) {
          updateTraceData(e.realPosition.x);
        }
      });

      this.groupPlots[i].spectrumDLines.addPositionChangedListener((e) => {
        updateTraceData(e.realPosition.x);
      });

      this.groupPlots[i].traceDLines.addPositionChangedListener((e) => {
        updateSpectrumData(e.realPosition.x);
      });
    }

    this.arangeFigures();

    this.repaint();
    setTimeout(() => this.resize(), 100);

   }

   public replot(): void {
    for (let i = 0; i < this.datasets.length; i++) {
      let {x, y} = this.groupPlots[i].heatmapDLines.realPosition;
      this.updateFuncions[i].updateSpectrum(y);
      this.updateFuncions[i].updateTrace(x);
    }
    super.replot();
   }

}
