import { ContextMenu } from "./contextmenu";
import { DraggableLines, Orientation } from "./draggableLines";
import { Figure, ILinePlot } from "./figure/figure";
import { Grid } from "./grid";
import { Scene, SceneNavBar, SceneNavBarContextMenu } from "./scene";
import { NumberArray } from "./types";
import { combinations } from "./utils";


export class LayoutSceneNavBar extends SceneNavBar {

    constructor(scene: Scene) {
        super(scene);
    }

    protected setContextMenu() {
        this.contextMenu = new LayoutSceneNavBarContextMenu(this.scene);
    }
}

export class LayoutSceneNavBarContextMenu extends SceneNavBarContextMenu {

    protected constructMenu(): void {
        super.constructMenu();

        const scene = this.scene as LayoutScene;
        
        var ops = ["Femto", "Transient emission", "HPLC"];

        var layout = this.addSelect("Layout", ...ops);
        layout.addEventListener("change", e => {
            scene.layout = layout.selectedOptions[0].text;
        });

        var ops = ["Matrix", "Column-wise", "Row-wise"];
        var alignment = this.addSelect("Alignment", ...ops);
        alignment.addEventListener("change", e => {
            scene.alignment = alignment.selectedOptions[0].text;
        });

        var linkXAxes = this.addCheckBox("Link x axes");
        var linkYAxes = this.addCheckBox("Link y axes");

        linkXAxes.addEventListener("change", e => {
            const figs = [...scene.groupPlots.map(p => p.heatmapFig), ...scene.groupPlots.map(p => p.spectrum)]
            for (const [f1, f2] of combinations<Figure>(figs)) {
                if (linkXAxes.checked) {
                    f1.linkXRange(f2);
                } else {
                    f1.unlinkXRange(f2);
                }
            }
        });

        linkYAxes.addEventListener("change", e => {
            // TODO link yx axes.
            const figs = [...scene.groupPlots.map(p => p.heatmapFig)]  // , ...scene.groupPlots.map(p => p.trace)
            for (const [f1, f2] of combinations<Figure>(figs)) {
                if (linkYAxes.checked) {
                    f1.linkYRange(f2);
                } else {
                    f1.unlinkYRange(f2);
                }
            }
        });

        this.addUpdateUICallback(() => {
            // axAlign.selectedOptions[0].text = this.fig.axisAlignment === Orientation.Vertical ? "Vertical" : "Horizontal";
        });
    }
}

export interface IGroupPlot {
    heatmapFig: Figure,
    spectrum: Figure,
    trace: Figure,
    heatmapDLines: DraggableLines,
    spectrumDLines: DraggableLines,
    traceDLines: DraggableLines,
    spectrumPlot: ILinePlot,
    tracePlot: ILinePlot
}


export class LayoutScene extends Scene {

    public grid: Grid;
    public groupPlots: IGroupPlot[] = [];
    public _layout: string = "Femto";
    public _alignment: string = "Matrix";
    // public linkVerticalLines = false;
    // public linkHorizontalLines = false;

    constructor(parentElement: HTMLDivElement) {
        super(parentElement);
        
        this.grid = new Grid();
        this.addItem(this.grid);

        // var hfig = new Figure();
        // // hfig.addColorbar();
        // var trace = new Figure();
        // var spectrum = new Figure();

        // this.heatmapFigures.push(hfig);
        // this.traceFigures.push(trace);
        // this.spectraFigures.push(spectrum);

        // this.arangeFigures();
    }

    get layout() {
        return this._layout;
    }

    set layout(layout: string) {
        this._layout = layout;
        this.arangeFigures();
    }

    get alignment() {
        return this._alignment;
    }

    set alignment(alignment: string) {
        this._alignment = alignment;
        this.arangeFigures();
    }

    protected arangeFigures(n?: number) {
        this.grid.clear();
        var repaint = true;
        if (n) {
            repaint = false;
            this.groupPlots = [];

            for (let i = 0; i < n; i++) {
                var h = new Figure();
                var s = new Figure();
                var t = new Figure();

                this.groupPlots.push({
                    heatmapFig: h,
                    spectrum: s,
                    trace: t,
                    heatmapDLines: h.addDraggableLines(Orientation.Both),
                    spectrumDLines: s.addDraggableLines(Orientation.Vertical),
                    traceDLines: t.addDraggableLines(Orientation.Vertical),
                    spectrumPlot: s.plotLine([], []),
                    tracePlot: t.plotLine([], []),
                })
            }
        } else {
            n = this.groupPlots.length;
        }
        let nrows, ncols;
        if (this._alignment === "Matrix") {
            ncols = Math.floor(n ** 0.5);
            nrows = Math.ceil(n / ncols);
        } else if (this._alignment === "Column-wise") {
            ncols = n;
            nrows = 1;
        } else { // row-wise
            ncols = 1;
            nrows = n;
        }

        switch (this.layout) {
            case "Femto": {
                for (let row = 0; row < nrows; row++) {
                    for (let col = 0; col < ncols; col++) {
                        const i = row * ncols + col;
                        if (i === n) break;
                        const hmap = this.groupPlots[i].heatmapFig;
                        const sp = this.groupPlots[i].spectrum;
                        const tr = this.groupPlots[i].trace;
                        
                        hmap.showTickNumbers = ['left', 'bottom'];
                        sp.showTickNumbers = ['left', 'bottom'];
                        tr.showTickNumbers = ['right', 'bottom'];
                        tr.axisAlignment = Orientation.Vertical;

                        sp.xAxis.autoscale = false;
                        tr.xAxis.autoscale = false;
                        hmap.xAxis.autoscale = false;
                        hmap.yAxis.autoscale = false;

                        hmap.linkMargin(sp, Orientation.Horizontal);
                        hmap.linkMargin(tr, Orientation.Vertical);
                        hmap.linkXRange(sp);
                        hmap.linkYXRange(tr);

                        this.groupPlots[i].heatmapDLines.linkX(this.groupPlots[i].spectrumDLines);
                        this.groupPlots[i].heatmapDLines.linkYX(this.groupPlots[i].traceDLines);
    
                        // display 
                        this.grid.addItem(hmap, 2 * row, 2 * col, 1, 1);    
                        this.grid.addItem(sp, 2 * row + 1, 2 * col, 1, 1);
                        this.grid.addItem(tr, 2 * row, 2 * col + 1, 1, 1);
                    }
                }
                var wr = new NumberArray();
                for (let i = 0; i < ncols; i++) {wr.push(2); wr.push(1);}
                var hr = new NumberArray();
                for (let i = 0; i < nrows; i++) {hr.push(2); hr.push(1);}

                this.grid.gridSettings.widthRatios = wr;
                this.grid.gridSettings.heightRatios = hr;
                break;
            }
            // case "Femto": {


            //     break;
            // }
            // case "Femto": {


            //     break;
            // }
        }
        if (repaint) {
            this.grid.recalculateGrid();
            this.repaint();
            setTimeout(() => this.resize(), 100);
        }
            
    }

    protected setNavBar(): void {
        this.navBar = new LayoutSceneNavBar(this);
    }
}
