import {  Figure,  Colorbar,  Grid,  Scene,  Matrix,  NumberArray, ILinePlot, getDefaultColor, Dataset, Colormap, Colormaps, LinearROI} from "@pytsa/ts-graph";
import { IFitParsedData } from "./fitmodel";

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
    this.CfitEASFigure.xAxis.label = "Time / ps";
    // this.STfitDASFigure.xAxis.label = "Wavelength / nm";
    this.STfitEASFigure.xAxis.label = "Wavelength / nm";
    this.residualsFigure.xAxis.label = "Wavelength / nm";
    this.residualsFigure.yAxis.label = "Time / ps";
    this.residualsFigure.yAxis.inverted = true;

    this.CfitDASFigure.xAxis.scale = 'symlog';
    this.CfitEASFigure.xAxis.scale = 'symlog';

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

  public updateData(x: NumberArray, y: NumberArray, parsedData: IFitParsedData) {
    if (parsedData.CfitDAS.ncols !== parsedData.STfitDAS.nrows) {
      throw Error("Number of species of C profiles and spectra does not match.");
    }
    
    const n = parsedData.CfitDAS.ncols;
    const plotsBefore = this.CfitDASFigure.linePlots.length > 0;

    // remove line plots

    this.CfitDASFigure.linePlots = [];
    this.CfitEASFigure.linePlots = [];
    this.STfitDASFigure.linePlots = [];
    this.STfitEASFigure.linePlots = [];

    // plot

    if (parsedData.Cartifacts && parsedData.STartifacts) {
      for (let i = 0; i < parsedData.Cartifacts.ncols; i++) {
        const color = getDefaultColor(i);
        const ld: number[] = [8, 4];
        const lw = 1;
        const label = `Artifact ${i + 1}`;

        this.CfitDASFigure.plotLine(y, parsedData.Cartifacts.getCol(i) , color, ld, lw, label);
        this.CfitEASFigure.plotLine(y, parsedData.Cartifacts.getCol(i), color, ld, lw, label);
        this.STfitDASFigure.plotLine(x, parsedData.STartifacts.getRow(i), color, ld, lw, label);
        this.STfitEASFigure.plotLine(x, parsedData.STartifacts.getRow(i), color, ld, lw, label);
      }
    }

    for (let i = 0; i < n; i++) {
      const color = getDefaultColor(i);
      const ld: number[] = [];
      const lw = 2;
      const labelDAS = `DAS ${i + 1}`;
      const labelEAS = `EAS ${i + 1}`;

      this.CfitDASFigure.plotLine(y, parsedData.CfitDAS.getCol(i) , color, ld, lw, labelDAS);
      if (parsedData.CfitEAS) {
        this.CfitEASFigure.plotLine(y, parsedData.CfitEAS.getCol(i), color, ld, lw, labelEAS);
      }
      this.STfitDASFigure.plotLine(x, parsedData.STfitDAS.getRow(i), color, ld, lw, labelDAS);
      if (parsedData.STfitEAS) {
        this.STfitEASFigure.plotLine(x, parsedData.STfitEAS.getRow(i), color, ld, lw, labelEAS);
      }
    }

    const hmap = this.residualsFigure.plotHeatmap(parsedData.residuals, new Colormap(Colormaps.symgrad));
    this.resCBar.linkHeatMap(hmap);
    
    // set view bounds
    this.CfitDASFigure.xAxis.viewBounds = [y[0], y[y.length - 1]];
    this.CfitEASFigure.xAxis.viewBounds = [y[0], y[y.length - 1]];
    
    this.STfitDASFigure.xAxis.viewBounds = [x[0], x[x.length - 1]];
    this.STfitEASFigure.xAxis.viewBounds = [x[0], x[x.length - 1]];
    
    this.residualsFigure.xAxis.viewBounds = [x[0], x[x.length - 1]];
    this.residualsFigure.yAxis.viewBounds = [y[0], y[y.length - 1]];

    this.resCBar.viewAll();

    if (!plotsBefore) {
      this.CfitDASFigure.viewAll();
      this.CfitEASFigure.viewAll();
      this.STfitDASFigure.viewAll();
      this.STfitEASFigure.viewAll();
    }

    this.replot();
    setTimeout(() => this.resize(), 100);

  }

}
