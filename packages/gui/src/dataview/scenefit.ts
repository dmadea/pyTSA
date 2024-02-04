import {  Figure,  Colorbar,  Grid,  Scene,  Matrix,  NumberArray, ILinePlot, getDefaultColor} from "@pytsa/ts-graph";

export class SceneFit extends Scene {

  private grid: Grid;
  private CfitFigure: Figure;
  private STfitFigure: Figure;
  private CfitNormFigure: Figure;
  private STfitNormFigure: Figure;

  private CresidualsFigure: Figure;
  private CresCBar: Colorbar;

  private Cplots: ILinePlot[] = [];
  private Cnormplots: ILinePlot[] = [];
  private STplots: ILinePlot[] = [];
  private STnormplots: ILinePlot[] = [];

  constructor(parentElement: HTMLDivElement) {
    super(parentElement);

    this.grid = new Grid(this);
    this.addItem(this.grid);

    this.CfitFigure = new Figure();
    this.STfitFigure = new Figure();
    this.CfitNormFigure = new Figure();
    this.STfitNormFigure = new Figure();
    this.CresidualsFigure = new Figure();

    this.CfitFigure.title = "Concentration profiles";
    this.CfitNormFigure.title = "Concentration profiles (normalized)";

    this.STfitFigure.title = "Spectra";
    this.STfitNormFigure.title = "Spectra (normalized)";
    this.CresidualsFigure.title = "Residuals";

    this.CfitFigure.xAxis.autoscale = false;
    this.CfitFigure.yAxis.autoscale = true;
    this.STfitFigure.xAxis.autoscale = false;
    this.STfitFigure.yAxis.autoscale = true;
    this.CfitNormFigure.xAxis.autoscale = false;
    this.CfitNormFigure.yAxis.autoscale = true;
    this.STfitNormFigure.xAxis.autoscale = false;
    this.STfitNormFigure.yAxis.autoscale = true;

    this.CresCBar = this.CresidualsFigure.addColorbar();

    this.grid.addItem(this.STfitFigure, 0, 0);
    this.grid.addItem(this.CfitFigure, 0, 1);
    this.grid.addItem(this.CresidualsFigure, 0, 2);

    this.grid.addItem(this.STfitNormFigure, 1, 0);
    this.grid.addItem(this.CfitNormFigure, 1, 1);
  }

  public updateData(x: NumberArray, y: NumberArray, C: Matrix, ST: Matrix, res: Matrix) {

    if (C.ncols !== ST.nrows) {
      throw Error("asdapsodas");
    }
    
    const n = C.ncols;

    const diff = n - this.Cplots.length;
    if (diff > 0) {   // add line plots
      for (let i = 0; i < diff; i++) {
        const color = getDefaultColor(i + this.Cplots.length);
        this.Cplots.push(this.CfitFigure.plotLine([], [], color));
        this.Cnormplots.push(this.CfitNormFigure.plotLine([], [], color));
        this.STplots.push(this.STfitFigure.plotLine([], [], color));
        this.STnormplots.push(this.STfitNormFigure.plotLine([], [], color));
      }
    } else if (diff < 0) {   // remove line plots
      for (let i = 0; i < -diff; i++) {
        this.CfitFigure.removePlot(this.Cplots.pop() as ILinePlot);
        this.CfitNormFigure.removePlot(this.Cnormplots.pop() as ILinePlot);
        this.STfitFigure.removePlot(this.STplots.pop() as ILinePlot);
        this.STfitNormFigure.removePlot(this.STnormplots.pop() as ILinePlot);
      }
    }

    for (let i = 0; i < n; i++) { 

      this.Cplots[i].x = y;
      this.Cnormplots[i].x = y;
      this.STplots[i].x = x;
      this.STnormplots[i].x = x;
      
      this.Cplots[i].y = C.getCol(i);
      this.Cnormplots[i].y = NumberArray.mul(this.Cplots[i].y, 1 / this.Cplots[i].y.max());
      
      this.STplots[i].y = ST.getRow(i);
      this.STnormplots[i].y = NumberArray.mul(this.STplots[i].y, 1 / this.STplots[i].y.max());

      // TODO residuals
    }
    
    // set view bounds
    this.CfitFigure.xAxis.viewBounds = [y[0], y[y.length - 1]];
    this.CfitNormFigure.xAxis.viewBounds = [y[0], y[y.length - 1]];

    this.STfitFigure.xAxis.viewBounds = [x[0], x[x.length - 1]];
    this.STfitNormFigure.xAxis.viewBounds = [x[0], x[x.length - 1]];

    this.replot();
    setTimeout(() => this.resize(), 100);



    // if (datasets.length !== this.datasets.length) {
    //   throw Error("Length of updated datasets must me the same as those plotted.");
    // }

    // const n = this.datasets.length;

    // for (let i = 0; i < n; i++) {
    //   this.datasets[i] = datasets[i];

    //   const ds = this.datasets[i];
    //   const hfig = this.groupPlots[i].heatmapFig;
    //   const spectrum = this.groupPlots[i].spectrum;
    //   const trace = this.groupPlots[i].trace;
    //   const tracePlot = this.groupPlots[i].tracePlot;
    //   const spectrumPlot = this.groupPlots[i].spectrumPlot;

    //   hfig.plotHeatmap(ds, new Colormap(Colormaps.symgrad));
    //   hfig.xAxis.viewBounds = [ds.x[0], ds.x[ds.x.length - 1]];
    //   hfig.yAxis.viewBounds = [ds.y[0], ds.y[ds.y.length - 1]];
    //   hfig.title = ds.name;

    //   spectrumPlot.x = ds.x;
    //   tracePlot.x = ds.y;
    //   trace.xAxis.viewBounds = [ds.y[0], ds.y[ds.y.length - 1]];
    //   spectrum.xAxis.viewBounds = [ds.x[0], ds.x[ds.x.length - 1]];
      
    //   hfig.heatmap?.recalculateImage();
    // }

  }

}
