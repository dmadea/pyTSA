import { NumberArray } from "../array";
import { Figure } from "./figure";

export enum AxisType {
    xAxis,
    yAxis
}

export class Axis {

    public label: string;
    private _scale: string | NumberArray;  // lin, lo, symlog, data provided as NumberArray
    private _viewBounds: [number, number];   // bounds of view or [x0, x1]
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

    constructor (figure: Figure, axisType: AxisType, label?: string, scale?: string | NumberArray, viewBounds?: [number, number],
        autoscale?: boolean, inverted?: boolean, symlogLinthresh?: number, symlogLinscale?: number, keepCentered?: boolean) {
            this.figure = figure;
            this.axisType = axisType;
            this.label = label ?? '';
            this._scale = scale ?? 'lin';
            this._viewBounds = viewBounds ?? [-Number.MAX_VALUE, Number.MAX_VALUE];  // in internal range coordinates
            this.autoscale = autoscale ?? true;
            this.inverted = inverted ?? false;
            this._symlogLinscale = symlogLinscale ?? 1;
            this._symlogLinthresh = symlogLinthresh ?? 1;
            this.keepCentered = keepCentered ?? false;
            // this._range = this.axisType === AxisType.xAxis ?
    }

    set viewBounds(bounds: [number, number]) {
        this._viewBounds = [this.invTransform(bounds[0]), this.invTransform(bounds[1])];

        if (this.internalRange[0] < this._viewBounds[0] || this.internalRange[1] > this._viewBounds[1]) {
            this.internalRange = this._viewBounds;
        }
    }

    get viewBounds() {
        return [this.transform(this._viewBounds[0]), this.transform(this._viewBounds[1])]
        // return this._viewBounds;
    }

    get internalViewBounds(){
        return this._viewBounds;
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

    set scale(scale: string | NumberArray) {
        if (scale !== this._scale) {
            const prevRange = this.range;
            const prevBounds = this.viewBounds;
            this._scale = scale;
            this.viewBounds = prevBounds;
            this.range = prevRange;
            // console.log(this.viewBounds);
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
                if (!(scale instanceof NumberArray)) {
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
                if (!(scale instanceof NumberArray)) {
                    throw new Error("Not implemented");
                }

                return (num: number) =>  {
                    return scale.nearestIndex(num);
                };    
        }
    }
}