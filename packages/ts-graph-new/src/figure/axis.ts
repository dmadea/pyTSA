import { F32Array } from "../array";
import { Figure } from "./figure";

export enum AxisType {
    xAxis,
    yAxis
}

export type Scale = "lin" | "log" | "symlog" | F32Array;
export type ScaleText = "Linear" | "Logarithmic" | "Symmetric logarithmic" | "Data bound";


export class Axis {

    public label: string;
    private _scale: Scale;  // lin, log, symlog, data provided as NumberArray
    private _internalViewBounds: [number, number];   // bounds of view or [x0, x1]
    private _viewBounds: [number, number];
    public autoscale: boolean;
    public inverted: boolean;
    private _symlogLinthresh: number; // Defines the range (-x, x), within which the plot is linear.
    private _symlogLinscale: number;  // number of decades to use for each half of the linear range
    public displayedSignificantFigures: number = 2;
    private figure: Figure;
    
    public axisType: AxisType;
    public keepCentered: boolean;

    // public transform: (num: number) => number = num => num;
    // public invTransform: (num: number) => number = num => num; 
    // private _range: [number, number];

    constructor (figure: Figure, axisType: AxisType, label?: string, scale?: Scale, internalViewBounds?: [number, number],
        autoscale?: boolean, inverted?: boolean, symlogLinthresh?: number, symlogLinscale?: number, keepCentered?: boolean) {
            this.figure = figure;
            this.axisType = axisType;
            this.label = label ?? '';
            this._scale = scale ?? 'lin';
            this._internalViewBounds = internalViewBounds ?? [-Number.MAX_VALUE, Number.MAX_VALUE];  // in internal range coordinates
            this._viewBounds = [-Number.MAX_VALUE, Number.MAX_VALUE]; // TODO make it properly
            this.autoscale = autoscale ?? true;
            this.inverted = inverted ?? false;
            this._symlogLinscale = symlogLinscale ?? 1;
            this._symlogLinthresh = symlogLinthresh ?? 1;
            this.keepCentered = keepCentered ?? false;
            // this._range = this.axisType === AxisType.xAxis ?
    }

    set viewBounds(bounds: [number, number]) {
        this._viewBounds = bounds;
        this._internalViewBounds = [this.invTransform(bounds[0]), this.invTransform(bounds[1])];

        if (this.internalRange[0] < this._internalViewBounds[0] || this.internalRange[1] > (this._internalViewBounds[1] - this._internalViewBounds[0])) {
            this.internalRange = [this._internalViewBounds[0], this._internalViewBounds[1] - this._internalViewBounds[0]];
        }
    }

    get viewBounds() {
        return this._viewBounds;
    }

    get internalViewBounds(){
        return this._internalViewBounds;
    }

    // public setViewBounds(bounds: [number, number]) {
    //     this._viewBounds = [this.invTransform(bounds[0]), this.invTransform(bounds[1])];
    // }

    get internalRange(): [number, number] {
        const rng = this.figure.internalRange;
        return (this.axisType === AxisType.xAxis) ? [rng.x, rng.w] : [rng.y, rng.h];
    }

    set internalRange(range: [number, number]) {
        if (this.axisType === AxisType.xAxis) {
            this.figure.internalRange.x = range[0];
            this.figure.internalRange.w = range[1];
        } else {    
            this.figure.internalRange.y = range[0];
            this.figure.internalRange.h = range[1];
        }
    }

    get range(): [number, number] {
        const rng = this.figure.internalRange;
        if (this.axisType === AxisType.xAxis) {
            const coordinate = this.transform(rng.x);
            return [coordinate, this.transform(rng.x + rng.w) - coordinate];
        } else {
            const coordinate = this.transform(rng.y);
            return [coordinate, this.transform(rng.y + rng.h) - coordinate];
        }
    }

    set range(range: [number, number]) {
        const t_coor = this.invTransform(range[0]);
        const t_size = this.invTransform(range[0] + range[1]) - t_coor;
        // const iRange = this.figure.getInternalRange();
        if (this.axisType === AxisType.xAxis) {
            this.figure.internalRange.x = t_coor;
            this.figure.internalRange.w = t_size;
        } else {
            this.figure.internalRange.y = t_coor;
            this.figure.internalRange.h = t_size;
        }
    }

    get transform() {
        return this.getTransform();
    }

    get invTransform() {
        return this.getInverseTransform();
    }

    get scale() {
        return this._scale;
    }

    set scale(scale: Scale) {
        if (scale !== this._scale) {
            const prevRange = this.range;
            this._scale = scale;
            this.viewBounds = this.viewBounds; // TODO fix change of scale !!
            this.range = prevRange;
            // console.log(this.viewBounds);
        }
    }

    public getScaleText(): ScaleText {
        switch (this._scale) {
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
                if (!(this._scale instanceof F32Array)) {
                    throw new Error("Not implemented");
                }

                return "Data bound";
        }
    }

    public setScaleFromText(scale: ScaleText) {
        switch (scale) {
            case 'Linear': {
                this.scale = 'lin';
                return;
            }
            case 'Logarithmic': {
                this.scale = 'log';
                return;
            }                
            case 'Symmetric logarithmic': {
                this.scale = 'symlog';
                return;
            }
            default: {  // data bound
                var _scale: Scale;
                if (this.figure.heatmap) {
                    _scale =  (this.axisType === AxisType.xAxis) ? this.figure.heatmap.dataset.x : this.figure.heatmap.dataset.y;
                } else if (this.figure.linePlots.length > 0) {
                    _scale = this.figure.linePlots[0].x;
                } else {
                    _scale = "lin";
                }
                this.scale = _scale
            }
        }
    }


    get symlogLinthresh () {
        return this._symlogLinthresh;
    }

    set symlogLinthresh (val: number) {
        const prevRange = this.range;
        this._symlogLinthresh = val;
        this.range = prevRange;
    }

    get symlogLinscale () {
        return this._symlogLinscale;
    }

    set symlogLinscale (val: number) {
        const prevRange = this.range;
        this._symlogLinscale = val;
        this.range = prevRange;
    }

    // transforms from dummy axis value to real value
    private getTransform(): (num: number) => number {
        switch (this._scale) {
            case 'lin': {
                return (num: number) => num;
            }
            case 'log': {
                return (num: number) => 10 ** num;
            }                
            case 'symlog': {
                const linthresh = this.symlogLinthresh;
                const linscale = this.symlogLinscale;

                return (num: number) => {
                    // linear scale
                    if (Math.abs(num) <= linthresh) {
                        return num;
                    } else { // log scale
                        const sign = num >= 0 ? 1 : -1;
                        return sign * linthresh * 10 ** (linscale * (Math.abs(num) / linthresh - 1));
                    }
                };
            }
            default: // for data bound scale
                const scale = this.scale;
                if (!(scale instanceof F32Array)) {
                    throw new Error("Not implemented");
                }

                return (num: number) =>  {
                    return scale[Math.min(this.scale.length - 1, Math.max(0, Math.round(num)))];
                };
        }
    }

    // transforms from real data to dummy axis value
    private getInverseTransform(): (num: number) => number {
        switch (this._scale) {
            case 'lin': {
                return (num: number) => num;
            }
            case 'log': {
                return (num: number) => (num <= 0) ? -5 : Math.log10(num);
            }                
            case 'symlog': {
                const linthresh = this.symlogLinthresh;
                const linscale = this.symlogLinscale;

                return (num: number) => {
                    // linear scale
                    if (Math.abs(num) <= linthresh) {
                        return num;
                    } else {
                        const sign = num >= 0 ? 1 : -1;
                        return sign * linthresh * (1 + Math.log10(Math.abs(num) / linthresh) / linscale);
                    }
                };
            }
            default: // for data bound scale
                const scale = this.scale;
                if (!(scale instanceof F32Array)) {
                    throw new Error("Not implemented");
                }

                return (num: number) =>  {
                    return scale.nearestIndex(num);
                };    
        }
    }
}