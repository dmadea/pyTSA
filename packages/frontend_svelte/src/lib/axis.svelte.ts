import { F32Array } from "./array";

export type AxisType = 'xAxis' | 'yAxis' | 'zAxis'

// export type Scale = "lin" | "log" | "symlog" | F32Array;
export type Scale = "Linear" | "Logarithmic" | "Symmetric logarithmic" | "Data bound";


export class Axis {

    public label = $state<string>('');
    // private _scale: Scale;  // lin, log, symlog, data provided as NumberArray
    // private _internalViewBounds: [number, number];   // bounds of view or [x0, x1]
    private _viewBounds = $state<[number, number]>([-Number.MAX_VALUE, Number.MAX_VALUE]);
    public autoscale = $state<boolean>(true);
    public inverted = $state<boolean>(false);
    #scale = $state<Scale>("Linear");
    #scaleArray: F32Array | null = null; // used for data bound scale
    public symlogLinthresh = $state<number>(1); // Defines the range (-x, x), within which the plot is linear.
    public symlogLinscale = $state<number>(1);  // number of decades to use for each half of the linear range
    // public displayedSignificantFigures = $state<number>(2);
    
    public axisType: AxisType;
    public keepCentered = $state<boolean>(false);

    // public transform: (num: number) => number = num => num;
    // public invTransform: (num: number) => number = num => num; 
    // private _range: [number, number];

    constructor (axisType: AxisType) {
            this.axisType = axisType;
    }

    // set viewBounds(bounds: [number, number]) {
    //     this._viewBounds = bounds;
    //     this._internalViewBounds = [this.invTransform(bounds[0]), this.invTransform(bounds[1])];

    //     if (this.internalRange[0] < this._internalViewBounds[0] || this.internalRange[1] > (this._internalViewBounds[1] - this._internalViewBounds[0])) {
    //         this.internalRange = [this._internalViewBounds[0], this._internalViewBounds[1] - this._internalViewBounds[0]];
    //     }
    // }

    // get viewBounds() {
    //     return this._viewBounds;
    // }

    // get internalViewBounds(){
    //     return this._internalViewBounds;
    // }

    // // public setViewBounds(bounds: [number, number]) {
    // //     this._viewBounds = [this.invTransform(bounds[0]), this.invTransform(bounds[1])];
    // // }

    // get internalRange(): [number, number] {
    //     const rng = this.figure.internalRange;
    //     return (this.axisType === AxisType.xAxis) ? [rng.x, rng.w] : [rng.y, rng.h];
    // }

    // set internalRange(range: [number, number]) {
    //     if (this.axisType === AxisType.xAxis) {
    //         this.figure.internalRange.x = range[0];
    //         this.figure.internalRange.w = range[1];
    //     } else {    
    //         this.figure.internalRange.y = range[0];
    //         this.figure.internalRange.h = range[1];
    //     }
    // }

    // get range(): [number, number] {
    //     const rng = this.figure.internalRange;
    //     if (this.axisType === AxisType.xAxis) {
    //         const coordinate = this.transform(rng.x);
    //         return [coordinate, this.transform(rng.x + rng.w) - coordinate];
    //     } else {
    //         const coordinate = this.transform(rng.y);
    //         return [coordinate, this.transform(rng.y + rng.h) - coordinate];
    //     }
    // }

    // set range(range: [number, number]) {
    //     const t_coor = this.invTransform(range[0]);
    //     const t_size = this.invTransform(range[0] + range[1]) - t_coor;
    //     // const iRange = this.figure.getInternalRange();
    //     if (this.axisType === AxisType.xAxis) {
    //         this.figure.internalRange.x = t_coor;
    //         this.figure.internalRange.w = t_size;
    //     } else {
    //         this.figure.internalRange.y = t_coor;
    //         this.figure.internalRange.h = t_size;
    //     }
    // }

    get transform() {
        return this.getTransform();
    }

    get invTransform() {
        return this.getInverseTransform();
    }

    get scale() {
        return this.#scale;
    }

    get scaleArray() {
        return this.#scaleArray;
    }

    set scale(scale: Scale) {
        this.#scale = scale;
        // if (scale !== this._scale) {
        //     const prevRange = this.range;
        //     this._scale = scale;
        //     this.viewBounds = this.viewBounds; // TODO fix change of scale !!
        //     this.range = prevRange;
        //     // console.log(this.viewBounds);
        // }
    }

    // public getScaleText(): ScaleText {
    //     switch (this._scale) {
    //         case 'lin': {
    //             return "Linear";
    //         }
    //         case 'log': {
    //             return "Logarithmic";
    //         }                
    //         case 'symlog': {
    //             return "Symmetric logarithmic";
    //         }
    //         default: // for data bound scale
    //             if (!(this._scale instanceof F32Array)) {
    //                 throw new Error("Not implemented");
    //             }

    //             return "Data bound";
    //     }
    // }

    // public setScaleFromText(scale: ScaleText) {
    //     switch (scale) {
    //         case 'Linear': {
    //             this.scale = 'lin';
    //             return;
    //         }
    //         case 'Logarithmic': {
    //             this.scale = 'log';
    //             return;
    //         }                
    //         case 'Symmetric logarithmic': {
    //             this.scale = 'symlog';
    //             return;
    //         }
    //         default: {  // data bound
    //             var _scale: Scale;
    //             if (this.figure.heatmap) {
    //                 _scale =  (this.axisType === AxisType.xAxis) ? this.figure.heatmap.dataset.x : this.figure.heatmap.dataset.y;
    //             } else if (this.figure.linePlots.length > 0) {
    //                 _scale = this.figure.linePlots[0].x;
    //             } else {
    //                 _scale = "lin";
    //             }
    //             this.scale = _scale
    //         }
    //     }
    // }


    // set symlogLinthresh (val: number) {
    //     const prevRange = this.range;
    //     this._symlogLinthresh = val;
    //     this.range = prevRange;
    // }


    // set symlogLinscale (val: number) {
    //     const prevRange = this.range;
    //     this._symlogLinscale = val;
    //     this.range = prevRange;
    // }

    // // transforms from dummy axis value to real value
    private getTransform(): (num: number) => number {
        switch (this.scale) {
            case 'Linear': {
                return (num: number) => num;
            }
            case 'Logarithmic': {
                return (num: number) => 10 ** num;
            }                
            case 'Symmetric logarithmic': {
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
            case 'Data bound': {
                if (this.#scaleArray === null) {
                    throw new Error("#scaleArraty is null");
                }

                return (num: number) =>  {
                    const scaleArray = this.#scaleArray!;
                    return scaleArray[Math.min(scaleArray.length - 1, Math.max(0, Math.round(num)))];
                };
            }
        }
    }

    // transforms from real data to dummy axis value
    private getInverseTransform(): (num: number) => number {
        switch (this.scale) {
            case 'Linear': {
                return (num: number) => num;
            }
            case 'Logarithmic': {
                return (num: number) => (num <= 0) ? -5 : Math.log10(num);
            }                
            case 'Symmetric logarithmic': {
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
            case 'Data bound': {
                if (this.#scaleArray === null) {
                    throw new Error("#scaleArraty is null");
                }

                return (num: number) =>  {
                    return this.#scaleArray!.nearestIndex(num);
                };    
            }
        }
    }
}