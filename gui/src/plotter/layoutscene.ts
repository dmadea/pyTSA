import { ContextMenu } from "./contextmenu";
import { Figure } from "./figure/figure";
import { Grid } from "./grid";
import { Scene, SceneNavBar, SceneNavBarContextMenu } from "./scene";
import { NumberArray } from "./types";


export class LayoutSceneNavBar extends SceneNavBar {
    protected setContextMenu() {
        this.contextMenu = new LayoutSceneNavBarContextMenu(this.scene);
    }
}

export class LayoutSceneNavBarContextMenu extends SceneNavBarContextMenu {

    protected constructMenu(): void {
        super.constructMenu();
        
        var ops = ["Femto", "Transient emission", "HPLC"]

        var layout = this.addSelect("Layout", ...ops);
        layout.addEventListener("change", e => {

            // const opt = axAlign.selectedOptions[0].text;
            // this.fig.axisAlignment = opt == "Vertical" ? Orientation.Vertical : Orientation.Horizontal;
            // this.fig.repaint();
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
    public layout: string = "Femto";


    constructor(parentElement: HTMLDivElement) {
        super(parentElement);
        
        this.grid = new Grid();
        this.addItem(this.grid);

        var hfig = new Figure();
        hfig.addColorbar();
        var trace = new Figure();
        var spectrum = new Figure();

        this.heatmapFigures.push(hfig);
        this.traceFigures.push(trace);
        this.spectraFigures.push(spectrum);

        this.arangeFigures();
    }

    protected arangeFigures() {
        const n = this.heatmapFigures.length;
        this.grid.clear();

        switch (this.layout) {
            case "Femto": {

                for (let i = 0; i < n; i++) {
                    const hmap = this.heatmapFigures[i];
                    const sp = this.spectraFigures[i];
                    const tr = this.traceFigures[i];

                    hmap.showTickNumbers = ['left', 'bottom'];
                    sp.showTickNumbers = ['left', 'bottom'];
                    tr.showTickNumbers = ['right', 'bottom'];

                    // display 
                    this.grid.addItem(hmap, 0, 2 * i, 1, 1);
                    this.grid.addItem(sp, 1, 2 * i, 1, 1);
                    this.grid.addItem(tr, 0, 2 * i + 1, 1, 1);
                }
                var ratios = new NumberArray();
                for (let i = 0; i < n; i++) {ratios.push(2); ratios.push(1);}

                this.grid.gridSettings.widthRatios = ratios;
                this.grid.gridSettings.heightRatios = ratios;
                break;
            }
            case "Femto": {


                break;
            }
            case "Femto": {


                break;
            }
        }
        this.repaint();
        setTimeout(() => this.resize(), 100);
    }

    protected setNavBar(): void {
        this.navBar = new LayoutSceneNavBar(this);
    }
}
