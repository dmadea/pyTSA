import { ContextMenu } from "./contextmenu";
import { DraggableLines, Orientation } from "./objects/draggableLines";
import { Figure, ILinePlot } from "./figure/figure";
import { Grid } from "./objects/grid";
import { Scene, SceneNavBar, SceneNavBarContextMenu } from "./scene";
import { F32Array } from "./array";
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
        
        var opsLayout = ["Triangle", "Packed"];

        var layout = this.addSelect("Layout", ...opsLayout);
        layout.addEventListener("change", e => {
            scene.layout = layout.selectedOptions[0].text;
        });

        var opsAlignment = ["Matrix", "Column-wise", "Row-wise"];
        var alignment = this.addSelect("Alignment", ...opsAlignment);
        alignment.addEventListener("change", e => {
            scene.alignment = alignment.selectedOptions[0].text;
        });

        var linkXAxes = this.addCheckBox("Link x axes");
        var linkYAxes = this.addCheckBox("Link y axes");

        // TODO include draggable lines links

        linkXAxes.addEventListener("change", e => {
            const figs = [...scene.groupPlots.map(p => p.heatmapFig), ...scene.groupPlots.map(p => p.spectrum)]
            const lines = [...scene.groupPlots.map(p => p.heatmapDLines), ...scene.groupPlots.map(p => p.spectrumDLines)]

            if (linkXAxes.checked) {
                for (const [f1, f2] of combinations<Figure>(figs)) {
                    f1.linkXRange(f2);
                }
                for (const [l1, l2] of combinations<DraggableLines>(lines)) {
                    l1.linkX(l2);
                }

            } else {
                for (const fig of figs) {
                    fig.unlinkAllXRange();                    
                }
                
                for (const line of scene.groupPlots.map(p => p.heatmapDLines)) {
                    line.unlinkAllX();
                }
                
                for (const p of scene.groupPlots) {
                    p.heatmapDLines.linkX(p.spectrumDLines);
                    p.heatmapFig.linkXRange(p.spectrum);
                }
            }
        });

        linkYAxes.addEventListener("change", e => {
            const hmaps = [...scene.groupPlots.map(p => p.heatmapFig)];
            const traces = [...scene.groupPlots.map(p => p.trace)];
            const hmapLines = [...scene.groupPlots.map(p => p.heatmapDLines)];
            const traceLines = [...scene.groupPlots.map(p => p.traceDLines)];

            if (linkYAxes.checked) {
                for (const [f1, f2] of combinations<Figure>([...hmaps, ...traces])) {
                    if (hmaps.includes(f1) && hmaps.includes(f2)) {
                        f1.linkYRange(f2);
                    }
                    if (hmaps.includes(f1) && traces.includes(f2)) {
                        f1.linkYXRange(f2);
                    }
                    if (traces.includes(f1) && traces.includes(f2)) {
                        f1.linkXRange(f2);
                    }
                }

                for (const [l1, l2] of combinations<DraggableLines>([...hmapLines, ...traceLines])) {
                    if (hmapLines.includes(l1) && hmapLines.includes(l2)) {
                        l1.linkY(l2);
                    }
                    if (hmapLines.includes(l1) && traceLines.includes(l2)) {
                        l1.linkYX(l2);
                    }
                    if (traceLines.includes(l1) && traceLines.includes(l2)) {
                        l1.linkX(l2);
                    }
                }
            } else {
                for (const [f1, f2] of combinations<Figure>([...hmaps, ...traces])) {
                    if (hmaps.includes(f1) && hmaps.includes(f2)) {
                        f1.unlinkYRange(f2);
                    }
                    if (hmaps.includes(f1) && traces.includes(f2)) {
                        f1.unlinkYXRange(f2);
                    }
                    if (traces.includes(f1) && traces.includes(f2)) {
                        f1.unlinkXRange(f2);
                    }
                }
                for (const [l1, l2] of combinations<DraggableLines>([...hmapLines, ...traceLines])) {
                    if (hmapLines.includes(l1) && hmapLines.includes(l2)) {
                        l1.unlinkY(l2);
                    }
                    if (hmapLines.includes(l1) && traceLines.includes(l2)) {
                        l1.unlinkYX(l2);
                    }
                    if (traceLines.includes(l1) && traceLines.includes(l2)) {
                        l1.unlinkX(l2);
                    }
                }

                for (const p of scene.groupPlots) {
                    p.heatmapFig.linkYXRange(p.trace);
                    p.heatmapDLines.linkYX(p.traceDLines);
                }
            }
        });

        this.addUpdateUICallback(() => {
            layout.selectedIndex = opsLayout.indexOf(scene.layout);
            alignment.selectedIndex = opsAlignment.indexOf(scene.alignment);

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
    tracePlot: ILinePlot,
    spectrumFitPlot: ILinePlot,
    traceFitPlot: ILinePlot
}


export class LayoutScene extends Scene {

    public grid: Grid;
    public groupPlots: IGroupPlot[] = [];
    public _layout: string = "Packed";
    public _alignment: string = "Column-wise";

    constructor(parentElement: HTMLDivElement) {
        super(parentElement);
        
        this.grid = new Grid();
        this.addItem(this.grid);
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

    public clear() {
        this.grid.clear();
        this.groupPlots = [];
    }

    private setDefaultPlotSettings() {
        for (const p of this.groupPlots) {
            p.heatmapFig.showTickNumbers = ['left', 'bottom'];
            p.heatmapFig.axisAlignment = Orientation.Horizontal;
            p.heatmapFig.yAxis.inverted = true;
            p.heatmapFig.xAxis.inverted = false;
            p.spectrum.showTickNumbers = ['left', 'bottom'];
            p.spectrum.axisAlignment = Orientation.Horizontal;
            p.spectrum.yAxis.inverted = false;
            p.spectrum.xAxis.inverted = false;
            p.trace.showTickNumbers = ['right', 'bottom'];
            p.trace.axisAlignment = Orientation.Horizontal;
            p.trace.yAxis.inverted = false;
            p.trace.xAxis.inverted = false;

            p.spectrum.xAxis.autoscale = false;
            p.trace.xAxis.autoscale = false;
            p.heatmapFig.xAxis.autoscale = false;
            p.heatmapFig.yAxis.autoscale = false;

            p.trace.xAxis.label = "Time / us";
            p.heatmapFig.yAxis.label = "Time / us";
            p.spectrum.xAxis.label = "Wavelength / nm";
            p.heatmapFig.xAxis.label = "Wavelength / nm";

            for (const fig of [p.heatmapFig, p.spectrum, p.trace]) {
                fig.unlinkAllXRange();
                fig.unlinkAllYRange();
                fig.unlinkAllXYRange();
                fig.unlinkAllYXRange();
                fig.unlinkAllMargin();   // TODO properly
            }
        }
    }

    protected populateFigures(n: number) {
        this.groupPlots = [];

        for (let i = 0; i < n; i++) {
            var h = new Figure();
            var s = new Figure();
            var t = new Figure();
            
            if (this.wasm){
                h.setWasm(this.wasm);
                s.setWasm(this.wasm);
                t.setWasm(this.wasm);
            }

            this.groupPlots.push({
                heatmapFig: h,
                spectrum: s,
                trace: t,
                heatmapDLines: h.addDraggableLines(Orientation.Both),
                spectrumDLines: s.addDraggableLines(Orientation.Vertical),
                traceDLines: t.addDraggableLines(Orientation.Vertical),
                spectrumPlot: s.plotLine([], []),
                tracePlot: t.plotLine([], []),
                spectrumFitPlot: s.plotLine([], []),
                traceFitPlot: t.plotLine([], []),
            })
        }
    }

    protected arangeFigures() {
        this.grid.clear();
        var repaint = true;
        const n = this.groupPlots.length;
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
            case "Triangle": {
                this.setDefaultPlotSettings()
                for (let row = 0; row < nrows; row++) {
                    for (let col = 0; col < ncols; col++) {
                        const i = row * ncols + col;
                        if (i === n) break;
                        const hmap = this.groupPlots[i].heatmapFig;
                        const sp = this.groupPlots[i].spectrum;
                        const tr = this.groupPlots[i].trace;

                        // hmap.showTickNumbers = ['left', 'bottom'];
                        // sp.showTickNumbers = ['left', 'bottom'];
                        // tr.showTickNumbers = ['right', 'bottom'];
                        tr.axisAlignment = Orientation.Vertical;
                        tr.xAxis.inverted = true;

                        tr.title = "";
                        sp.title = "";

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
                var wr = new F32Array();
                for (let i = 0; i < ncols; i++) {wr.push(2); wr.push(1);}
                var hr = new F32Array();
                for (let i = 0; i < nrows; i++) {hr.push(2); hr.push(1);}

                this.grid.gridSettings.widthRatios = wr;
                this.grid.gridSettings.heightRatios = hr;
                break;
            }
            case "Packed": {
                this.setDefaultPlotSettings();

                for (const [f1, f2] of combinations<Figure>(this.groupPlots.map(p => p.heatmapFig))) {
                    f1.linkMargin(f2, Orientation.Both);
                }

                for (const [f1, f2] of combinations<Figure>(this.groupPlots.map(p => p.spectrum))) {
                    f1.linkMargin(f2, Orientation.Both);
                }

                for (const [f1, f2] of combinations<Figure>(this.groupPlots.map(p => p.trace))) {
                    f1.linkMargin(f2, Orientation.Both);
                }

                for (let row = 0; row < nrows; row++) {
                    for (let col = 0; col < ncols; col++) {
                        const i = row * ncols + col;
                        if (i === n) break;
                        const hmap = this.groupPlots[i].heatmapFig;
                        const sp = this.groupPlots[i].spectrum;
                        const tr = this.groupPlots[i].trace;
                        tr.xAxis.inverted = false;

                        tr.title = `Trace [${hmap.heatmap?.dataset.name}]`;
                        sp.title = `Spectrum [${hmap.heatmap?.dataset.name}]`;
                        
                        hmap.linkXRange(sp);
                        hmap.linkYXRange(tr);

                        this.groupPlots[i].heatmapDLines.linkX(this.groupPlots[i].spectrumDLines);
                        this.groupPlots[i].heatmapDLines.linkYX(this.groupPlots[i].traceDLines);
    
                        if (this._alignment === "Column-wise") {
                            let colspan = Math.floor(ncols / 2);
                            if (ncols === 1) {
                                colspan = 1;
                            }
                            this.grid.addItem(hmap, 0, col, 2, 1);    
                            this.grid.addItem(sp, col + 2, 0, 1, colspan);
                            this.grid.addItem(tr, col + 2, colspan, 1, colspan);
                        } else if (this._alignment === "Row-wise")  {
                            this.grid.addItem(hmap, row, 0, 1, 1);    
                            this.grid.addItem(sp, row, 1, 1, 1);
                            this.grid.addItem(tr, row, 2, 1, 1);

                        } else {
                            this.grid.addItem(hmap, 2 * row, col, 2, 1);    
                            this.grid.addItem(sp, i, ncols, 1, 1);
                            this.grid.addItem(tr, i, ncols + 1, 1, 1);
                        }
                    }
                }
                this.grid.gridSettings.widthRatios = null;
                this.grid.gridSettings.heightRatios = null;
                break;
            }
        }
        if (repaint) {
            this.grid.recalculateGrid();
            for (const p of this.groupPlots) {
                p.heatmapFig.heatmap?.recalculateImage();
            }
            this.repaint();
            setTimeout(() => this.resize(), 100);
        }
            
    }

    protected setNavBar(): void {
        this.navBar = new LayoutSceneNavBar(this);
    }
}
