import { ContextMenu } from "./contextmenu";
import { Figure } from "./figure/figure";
import { Grid } from "./grid";
import { Scene, SceneNavBar, SceneNavBarContextMenu } from "./scene";
import { NumberArray } from "./types";


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

        var ops = ["Matrix", "Columns-wise", "Row-wise"];
        var alignment = this.addSelect("Alignment", ...ops);
        alignment.addEventListener("change", e => {
            scene.alignment = alignment.selectedOptions[0].text;
        });

        var linkHorizontalLine = this.addCheckBox("Link horizontal lines");
        var linkVerticalLine = this.addCheckBox("Link vertical lines");

        linkHorizontalLine.addEventListener("change", e => {

        });

        linkVerticalLine.addEventListener("change", e => {
            
        });

        this.addUpdateUICallback(() => {
            // axAlign.selectedOptions[0].text = this.fig.axisAlignment === Orientation.Vertical ? "Vertical" : "Horizontal";
        });
    }
}


export class LayoutScene extends Scene {

    public grid: Grid;
    public heatmapFigures: Figure[] = [];
    public traceFigures: Figure[] = [];
    public spectraFigures: Figure[] = [];
    public _layout: string = "Femto";
    public _alignment: string = "Matrix";
    public linkVerticalLines = false;
    public linkHorizontalLines = false;

    constructor(parentElement: HTMLDivElement) {
        super(parentElement);
        
        this.grid = new Grid();
        this.addItem(this.grid);

        var hfig = new Figure();
        // hfig.addColorbar();
        var trace = new Figure();
        var spectrum = new Figure();

        this.heatmapFigures.push(hfig);
        this.traceFigures.push(trace);
        this.spectraFigures.push(spectrum);

        this.arangeFigures();
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

    protected arangeFigures() {
        this.grid.clear();
        const n = this.heatmapFigures.length;
        let nrows, ncols;
        if (this._alignment === "Matrix") {
            nrows = Math.floor(n ** 0.5);
            ncols = Math.ceil(n / nrows);
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
                        const hmap = this.heatmapFigures[i];
                        const sp = this.spectraFigures[i];
                        const tr = this.traceFigures[i];
    
                        hmap.showTickNumbers = ['left', 'bottom'];
                        sp.showTickNumbers = ['left', 'bottom'];
                        tr.showTickNumbers = ['right', 'bottom'];
    
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
        this.grid.recalculateGrid();
        this.repaint();
        setTimeout(() => this.resize(), 100);
    }

    protected setNavBar(): void {
        this.navBar = new LayoutSceneNavBar(this);
    }
}
