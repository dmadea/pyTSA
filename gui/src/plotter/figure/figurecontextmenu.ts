import { ContextMenu } from "../contextmenu";
import { Figure } from "./figure";



class AxisContextMenu extends ContextMenu {

    public fig: Figure;

    constructor(parentFigure: Figure) {
        super();
        this.fig = parentFigure;
    }

    protected createMenu(): HTMLDivElement {
        super.createMenu();

        this.addCheckBox("Autoscale");

        var s = this.addSelect("Scale", "Linear", "Logarithmic", "Symlog", "Data bound");
        s.addEventListener("change", e => {
            console.log(s.selectedOptions[0].text);
        });

        var linthresh = this.addNumberInput("linthresh", 1, 0);
        var linscale = this.addNumberInput("linscale", 1, 0);
        
        return this.menu;
    }
}

export class FigureContextMenu extends ContextMenu {

    public fig: Figure;

    constructor(parentFigure: Figure) {
        super();
        this.fig = parentFigure;
    }

    protected createMenu(): HTMLDivElement {
        super.createMenu();

        var viewAllAction = this.addAction("View all");
        viewAllAction.addEventListener("click", e => {
            this.fig.viewAll();
        });

        var a2 = this.addAction("action 2");
        this.addDivider();
        var a3 = this.addAction("action 3");
        this.addAction("action 3");
        this.addCheckBox('checkbox 1');

        var menu = new AxisContextMenu(this.fig);
        this.addMenu("X axis", menu);


        a3.addEventListener("click", e => {
            // console.log("action 3 clicked");
        });

        return this.menu;
    }
}