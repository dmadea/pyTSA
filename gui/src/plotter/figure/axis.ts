import { NumberArray } from "../types";
import { Figure } from "./figure";

export enum AxisType {
    xAxis,
    yAxis
}

export class Axis {

    public label: string;
    public scale: string | NumberArray;  // lin, lo, symlog, data provided as NumberArray
    public viewBounds: [number, number];   // bounds of view or [x0, x1]
    public autoscale: boolean;
    public inverted: boolean;
    public symlogLinthresh: number; // Defines the range (-x, x), within which the plot is linear.
    public symlogLinscale: number;  // number of decades to use for each half of the linear range
    public displayedSignificantFigures: number = 2;
    private figure: Figure;
    
    public axisType: AxisType;

    constructor (figure: Figure, axisType: AxisType, label?: string, scale?: string | NumberArray, viewBounds?: [number, number],
        autoscale?: boolean, inverted?: boolean, symlogLinthresh?: number, symlogLinscale?: number) {
            this.figure = figure;
            this.axisType = axisType;
            this.label = label ?? '';
            this.scale = scale ?? 'lin';
            this.viewBounds = viewBounds ?? [-Number.MAX_VALUE, Number.MAX_VALUE];
            this.autoscale = autoscale ?? true;
            this.inverted = inverted ?? false;
            this.symlogLinscale = symlogLinscale ?? 1;
            this.symlogLinthresh = symlogLinthresh ?? 1;
    }

    public getInternalRange() {

    }

    // transforms from dummy axis value to real value
    public getTransform(): (num: number) => number {
        switch (this.scale) {
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
    public getInverseTransform(): (num: number) => number {
        switch (this.scale) {
            case 'lin': {
                return (num: number) => num;
            }
            case 'log': {
                return (num: number) => Math.log10(num);
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