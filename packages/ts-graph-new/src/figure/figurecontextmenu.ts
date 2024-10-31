import { Colormap, Colormaps, ILut } from "../color";
import { ContextMenu } from "../contextmenu";
import { Orientation } from "../objects/draggableLines";
import { F32Array } from "../array";
import { Axis, AxisType, Scale } from "./axis";
import { Colorbar, Figure } from "./figure";



class AxisContextMenu extends ContextMenu {

    public fig: Figure;
    public axis: Axis;

    protected getTextFromScale(scale: string | F32Array) {
        switch (scale) {
            case 'lin': {
                return "Linear";
            }
            case 'log': {
                return "Logarithmic";
            }                
            case 'symlog': {
                return "Symmetric logarithmic";
            }
            default: // for data bound scale
                if (!(scale instanceof F32Array)) {
                    throw new Error("Not implemented");
                }

                return "Data bound";
        }
    }

    protected getScaleFromText(scale: string): Scale {
        switch (scale) {
            case 'Linear': {
                return "lin";
            }
            case 'Logarithmic': {
                return "log";
            }                
            case 'Symmetric logarithmic': {
                return "symlog";
            }
            default: {  // data bound
                if (this.fig.heatmap) {
                    return (this.axis.axisType === AxisType.xAxis) ? this.fig.heatmap.dataset.x : this.fig.heatmap.dataset.y;
                } else if (this.fig.linePlots.length > 0) {
                    return this.fig.linePlots[0].x;
                } else {
                    return "lin";
                }
            }
        }
    }

    constructor(parentFigure: Figure, axis: Axis) {
        super();
        this.fig = parentFigure;
        this.axis = axis;
    }

    protected constructMenu() {
        var autoscale = this.addCheckBox("Autoscale");
        autoscale.addEventListener("change", e => {
            this.axis.autoscale = autoscale.checked;
            if (autoscale.checked) this.fig.replot();
        });

        var keepcentered = this.addCheckBox("Keep centered");
        keepcentered.addEventListener("change", e => {
            // keep the range centered
            this.axis.keepCentered = keepcentered.checked;
        });

        var inverted = this.addCheckBox("Inverted");
        inverted.addEventListener("change", e => {
            this.axis.inverted = inverted.checked;
            if (this.fig.heatmap) {
                this.fig.heatmap.recalculateImage();
            }
            this.fig.replot();
        });

        var axLabel = this.addTextInput("Label", this.axis.label);
        axLabel.addEventListener("change", e => {
            this.axis.label = axLabel.value ?? "";
            this.fig.replot();
        });

        var options = ["Linear", "Logarithmic", "Symmetric logarithmic", "Data bound"];
        
        // if (this.axis.axisType === AxisType.xAxis) {  // y axis cannot be data bound
        //     options.push("Data bound");
        // }

        var axisScale = this.addSelect("Scale", ...options);
        axisScale.addEventListener("change", e => {
            this.axis.scale = this.getScaleFromText(axisScale.selectedOptions[0].text);
            this.fig.replot();
        });

        var linthresh = this.addNumberInput("Linthresh", 1, 0, undefined, 0.1);
        var linscale = this.addNumberInput("Linscale", 1, 0, undefined, 0.1);

        // TODO invalid value 
        linthresh.addEventListener("change", e => {
            var num = parseFloat(linthresh.value);
            var num = (num === 0) ? 1 : num;
            this.axis.symlogLinthresh = num;
            this.fig.replot();
        });

        linscale.addEventListener("change", e => {
            var num = parseFloat(linscale.value);
            var num = (num === 0) ? 1 : num;
            this.axis.symlogLinscale = num;
            this.fig.replot();
        });

        this.addUpdateUICallback(() => {
            autoscale.checked = this.axis.autoscale;
            inverted.checked = this.axis.inverted;
            axLabel.value = this.axis.label;
            axisScale.selectedIndex = options.indexOf(this.getTextFromScale(this.axis.scale));
            linthresh.value = this.axis.symlogLinthresh.toString();
            linscale.value = this.axis.symlogLinscale.toString();
            keepcentered.checked = this.axis.keepCentered;
        });

    }

}

export class FigureContextMenu extends ContextMenu {

    public fig: Figure;

    constructor(figure: Figure) {
        super();
        this.fig = figure;
    }

    protected constructMenu(): void {
        var viewAllAction = this.addAction("View all");
        viewAllAction.addEventListener("click", e => {
            this.fig.viewAll();
        });

        var copy = this.addAction("Copy this to clipboard");
        copy.addEventListener("click", e => {
            const cr = this.fig.canvasRect;

            const ofc = new OffscreenCanvas(cr.w, cr.h);
            const ctx = ofc.getContext("2d");
            if (!ctx || !this.fig.bottomCanvas) return;

            ctx.drawImage(this.fig.bottomCanvas, cr.x, cr.y, cr.w, cr.h, 0, 0, cr.w, cr.h);

            ofc.convertToBlob().then(blob => {
                navigator.clipboard.write([new ClipboardItem({"image/png": blob})]);
            });
        });

        var title = this.addTextInput("Title", this.fig.title);

        title.addEventListener("change", e => {
            this.fig.title = title.value;
            this.fig.replot();
        });

        var xAxisMenu = new AxisContextMenu(this.fig, this.fig.xAxis);
        var yAxisMenu = new AxisContextMenu(this.fig, this.fig.yAxis);

        this.addMenu("X axis", xAxisMenu);
        this.addMenu("Y axis", yAxisMenu);

        var axAlign = this.addSelect("Axis alignment", "Horizontal", "Vertical");
        axAlign.addEventListener("change", e => {
            const opt = axAlign.selectedOptions[0].text;
            this.fig.axisAlignment = opt == "Vertical" ? Orientation.Vertical : Orientation.Horizontal;
            this.fig.replot();
        });

        this.addUpdateUICallback(() => {
            axAlign.selectedIndex = this.fig.axisAlignment === Orientation.Vertical ? 1 : 0;
            title.value = this.fig.title;
        });
    }

}

class ColorbarAxisContextMenu extends AxisContextMenu {

    protected constructMenu() {
        // var autoscale = this.addCheckBox("Autoscale");
        // autoscale.addEventListener("change", e => {
        //     this.axis.autoscale = autoscale.checked;
        //     if (autoscale.checked) this.fig.repaint();
        // });

        // var inverted = this.addCheckBox("Inverted");
        // inverted.addEventListener("change", e => {
        //     this.axis.inverted = inverted.checked;
        //     if (this.fig.heatmap) {
        //         this.fig.heatmap.recalculateImage();
        //     }
        //     this.fig.repaint();
        // });

        var keepcentered = this.addCheckBox("Keep centered");
        keepcentered.addEventListener("change", e => {
            // keep the range centered
            this.axis.keepCentered = keepcentered.checked;
        });

        var axLabel = this.addTextInput("Label", this.axis.label);
        axLabel.addEventListener("change", e => {
            this.axis.label = axLabel.value ?? "";
            this.fig.replot();
        });

        var options = ["Linear", "Logarithmic", "Symmetric logarithmic"];

        var axisScale = this.addSelect("Scale", ...options);
        axisScale.addEventListener("change", e => {
            this.axis.scale = this.getScaleFromText(axisScale.selectedOptions[0].text);
            const cbar = this.fig as Colorbar;
            cbar.setHeatmapTransform();
            cbar.heatmap?.recalculateImage();
            cbar.repaintFigure();
        });

        var linthresh = this.addNumberInput("Linthresh", 1, 0, undefined, 0.1);
        var linscale = this.addNumberInput("Linscale", 1, 0, undefined, 0.1);

        linthresh.addEventListener("change", e => {
            var num = parseFloat(linthresh.value);
            var num = (num === 0) ? 1 : num;
            this.axis.symlogLinthresh = num;
            if (this.axis.scale === 'symlog') {
                const cbar = this.fig as Colorbar;
                cbar.heatmap?.recalculateImage();
                cbar.repaintFigure();
            }
        });

        linscale.addEventListener("change", e => {
            var num = parseFloat(linscale.value);
            var num = (num === 0) ? 1 : num;
            this.axis.symlogLinscale = num;
            if (this.axis.scale === 'symlog') {
                const cbar = this.fig as Colorbar;
                cbar.heatmap?.recalculateImage();
                cbar.repaintFigure();
            }
        });

        this.addUpdateUICallback(() => {
            // autoscale.checked = this.axis.autoscale;
            // inverted.checked = this.axis.inverted;
            axLabel.value = this.axis.label;
            axisScale.selectedIndex = options.indexOf(this.getTextFromScale(this.axis.scale));
            linthresh.value = this.axis.symlogLinthresh.toString();
            linscale.value = this.axis.symlogLinscale.toString();
            keepcentered.checked = this.axis.keepCentered;

        });

    }
}


export class ColorbarContextMenu extends ContextMenu {

    public colorbar: Colorbar;

    constructor(colorbar: Colorbar) {
        super();
        this.colorbar = colorbar;
    }

    protected constructMenu(): void {
        var viewAllAction = this.addAction("View all");
        viewAllAction.addEventListener("click", e => {
            this.colorbar.viewAll();
        });

        // var xAxisMenu = new AxisContextMenu(this.fig, this.fig.xAxis);
        var zAxisMenu = new ColorbarAxisContextMenu(this.colorbar, this.colorbar.yAxis);

        // this.addMenu("X axis", xAxisMenu);
        this.addMenu("Z axis", zAxisMenu);

        var options = Colormaps.getColormapsNames();
        var colormap = this.addSelect("Colormap", ...options);
        colormap.addEventListener("change", e => {

            var opt = colormap.selectedOptions[0].text;
            this.colorbar.colormap.lut = Colormaps.getLut(opt);
            this.colorbar.renderColorbar();
            this.colorbar.renderHeatmap();
            this.colorbar.repaintFigure();

        });

        var inverted = this.addCheckBox("Inverted");
        inverted.addEventListener("change", e => {
            // invert the colormap
            this.colorbar.colormap.inverted = inverted.checked;
            this.colorbar.renderColorbar();
            this.colorbar.renderHeatmap();
            this.colorbar.repaintFigure();
        });

        this.addUpdateUICallback(() => {
            inverted.checked = this.colorbar.colormap.inverted;
        });
    }

}