import {  Figure,  Colorbar,  Grid,  Scene,  Matrix,  NumberArray, ILinePlot, getDefaultColor, Dataset, Colormap, Colormaps, LinearROI} from "@pytsa/ts-graph";

export class SceneFit extends Scene {

  private grid: Grid;
  private CfitDASFigure: Figure;
  private STfitDASFigure: Figure;
  private CfitEASFigure: Figure;
  private STfitEASFigure: Figure;

  private residualsFigure: Figure;
  private resCBar: Colorbar;

  private LDMFigure: Figure;
  private LDMCBar: Colorbar;

  constructor(parentElement: HTMLDivElement) {
    super(parentElement);

    this.grid = new Grid(this);
    this.addItem(this.grid);

    this.CfitDASFigure = new Figure();
    this.STfitDASFigure = new Figure();
    this.CfitEASFigure = new Figure();
    this.STfitEASFigure = new Figure();
    this.residualsFigure = new Figure();
    this.LDMFigure = new Figure();

    this.CfitDASFigure.title = "Concentration profiles (DAS | SAS)";
    this.CfitEASFigure.title = "Concentration profiles (EAS)";

    this.STfitDASFigure.title = "Spectra (DAS | SAS)";
    this.STfitEASFigure.title = "Spectra (EAS)";
    this.residualsFigure.title = "Residuals";
    this.LDMFigure.title = "Lifetime density map (LDM)";

    this.CfitDASFigure.xAxis.autoscale = false;
    this.CfitDASFigure.yAxis.autoscale = true;
    this.STfitDASFigure.xAxis.autoscale = false;
    this.STfitDASFigure.yAxis.autoscale = true;
    this.CfitEASFigure.xAxis.autoscale = false;
    this.CfitEASFigure.yAxis.autoscale = true;
    this.STfitEASFigure.xAxis.autoscale = false;
    this.STfitEASFigure.yAxis.autoscale = true;

    this.CfitDASFigure.showLegend = true;
    this.STfitDASFigure.showLegend = true;
    this.CfitEASFigure.showLegend = true;
    this.STfitEASFigure.showLegend = true;

    this.CfitDASFigure.showTickNumbers = ['bottom', 'left'];
    this.STfitDASFigure.showTickNumbers = ['bottom', 'left'];
    this.CfitEASFigure.showTickNumbers = ['bottom', 'left'];
    this.STfitEASFigure.showTickNumbers = ['bottom', 'left'];
    this.residualsFigure.showTickNumbers = ['bottom', 'left'];
    this.LDMFigure.showTickNumbers = ['bottom', 'left'];

    // this.CfitDASFigure.xAxis.label = "Times / ps";
    this.CfitEASFigure.xAxis.label = "Times / ps";
    // this.STfitDASFigure.xAxis.label = "Wavelength / nm";
    this.STfitEASFigure.xAxis.label = "Wavelength / nm";
    this.residualsFigure.xAxis.label = "Wavelength / nm";
    this.residualsFigure.yAxis.label = "Times / ps";
    this.residualsFigure.yAxis.inverted = true;

    this.LDMFigure.xAxis.label = "Wavelength / nm";
    this.LDMFigure.yAxis.label = "Lifetime / ps";

    this.CfitDASFigure.linkXRange(this.CfitEASFigure);
    this.STfitDASFigure.linkXRange(this.STfitEASFigure);

    this.resCBar = this.residualsFigure.addColorbar();
    this.LDMCBar = this.LDMFigure.addColorbar();

    this.grid.addItem(this.STfitDASFigure, 0, 0);
    this.grid.addItem(this.CfitDASFigure, 0, 1);
    this.grid.addItem(this.residualsFigure, 2, 0);
    this.grid.addItem(this.STfitEASFigure, 1, 0);
    this.grid.addItem(this.CfitEASFigure, 1, 1);
    this.grid.addItem(this.LDMFigure, 2, 1);
  }

  public updateData(x: NumberArray, y: NumberArray, CDAS: Matrix, STDAS: Matrix, res: Dataset, CEAS?: Matrix, STEAS?: Matrix) {

    if (CDAS.ncols !== STDAS.nrows) {
      throw Error("asdapsodas");
    }
    
    const n = CDAS.ncols;

    const currLength = this.CfitDASFigure.linePlots.length;
    const diff = n - currLength;
    if (diff > 0) {   // add line plots
      for (let i = 0; i < diff; i++) {
        const color = getDefaultColor(i + currLength);
        const ld: number[] = [];
        const lw = 1;
        const labelDAS = `DAS ${i + currLength + 1}`;
        const labelEAS = `EAS ${i + currLength + 1}`;
        this.CfitDASFigure.plotLine([], [], color, ld, lw, labelDAS);
        this.CfitEASFigure.plotLine([], [], color, ld, lw, labelEAS);
        this.STfitDASFigure.plotLine([], [], color, ld, lw, labelDAS);
        this.STfitEASFigure.plotLine([], [], color, ld, lw, labelEAS);
      }
    } else if (diff < 0) {   // remove line plots
      for (let i = 0; i < -diff; i++) {
        this.CfitDASFigure.linePlots.pop();
        this.CfitEASFigure.linePlots.pop();
        this.STfitDASFigure.linePlots.pop();
        this.STfitEASFigure.linePlots.pop();
      }
    }

    for (let i = 0; i < n; i++) { 

      this.CfitDASFigure.linePlots[i].x = y;
      this.CfitEASFigure.linePlots[i].x = y;
      this.STfitDASFigure.linePlots[i].x = x;
      this.STfitEASFigure.linePlots[i].x = x;
      
      this.CfitDASFigure.linePlots[i].y = CDAS.getCol(i);
      if (CEAS) {
        this.CfitEASFigure.linePlots[i].y = CEAS.getCol(i);
      }
      
      this.STfitDASFigure.linePlots[i].y = STDAS.getRow(i);
      if (STEAS) {
        this.STfitEASFigure.linePlots[i].y = STEAS.getRow(i);
      }
      
      // this.STEASPlots[i].y = NumberArray.mul(this.STDASPlot[i].y, 1 / this.STDASPlot[i].y.max());
    }

    const hmap = this.residualsFigure.plotHeatmap(res, new Colormap(Colormaps.symgrad));
    this.resCBar.linkHeatMap(hmap);
    
    // set view bounds
    this.CfitDASFigure.xAxis.viewBounds = [y[0], y[y.length - 1]];
    this.CfitEASFigure.xAxis.viewBounds = [y[0], y[y.length - 1]];
    
    this.STfitDASFigure.xAxis.viewBounds = [x[0], x[x.length - 1]];
    this.STfitEASFigure.xAxis.viewBounds = [x[0], x[x.length - 1]];
    
    this.residualsFigure.xAxis.viewBounds = [x[0], x[x.length - 1]];
    this.residualsFigure.yAxis.viewBounds = [y[0], y[y.length - 1]];
    
    this.resCBar.viewAll();

    this.replot();
    setTimeout(() => this.resize(), 100);

  }

}
