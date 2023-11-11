import { NumberArray, Matrix } from "./types";

// export interface Dataset {
//     data: Matrix,
//     x: NumberArray,
//     y: NumberArray
// }

export class Dataset {
    public data: Matrix;
    public x: NumberArray;
    public y: NumberArray;

    constructor(data: Matrix, x: NumberArray, y: NumberArray) {
        //usually first dimension is time (rows) and second is wavelength (columns)
        if (data.ncols !== x.length || data.nrows !== y.length) {
            throw TypeError("Dimensions are not aligned with x and y arrays.");
        }
        this.data = data;
        this.x = x;
        this.y = y;
    }

    public transpose(): Dataset {
        [this.x, this.y] = [this.y, this.x];
        this.data.transpose();
        return this;
    }
}


export function formatNumber(num: number, sigFigures: number): string {

    var scale = 10 ** Math.trunc(Math.log10(Math.abs(num)));
    // console.log(scale)

    if ((scale < 1e-3 || scale > 1e3) && scale > 0){
        return num.toExponential(sigFigures < 1 ? 0 : sigFigures - 1);
    } else {
        return num.toPrecision(sigFigures);  // TODO change to some default method, because toPrecision will change to exponential format for small signifiacnt values.
    }
}

export function genTestData(n=100){
    let x = new NumberArray(n);
    let y = new NumberArray(n);

    for (let i = 0; i < n; i++) {
        x[i] = i * 2 / n - 1;
        y[i] = Math.random() * 2 - 1;
    }

    return [x, y];

}


export function loadData(text: string, delimiter: string = '\t', newLine = '\n'): Dataset | null {

    let rowData: NumberArray = new NumberArray();
    let colData = new NumberArray();
    let data = new NumberArray();

    // console.log(data);
    const lines = text.split(newLine);
    let ncols: number | null = null;

    for (let i = 0; i < lines.length; i++) {
        let entries = lines[i].split(delimiter);

        if (!ncols) {
            ncols = entries.length - 1;
            rowData = new NumberArray(ncols);
            for (let j = 1; j < ncols + 1; j++) {
                rowData[j - 1] = parseFloat(entries[j]);
            }
            continue;
        }

        if (entries.length !== ncols + 1){
            throw TypeError("Number of entries does not match the number of columns.");
        }

        colData.push(parseFloat(entries[0]));

        for (let j = 1; j < ncols + 1; j++) {
            data.push(parseFloat(entries[j]));
        }
    }

    if (!ncols)
        return null;

    let dataset = new Dataset(new Matrix(colData.length, ncols, data), rowData, colData)
    // console.log(dataset)

    return dataset;


}


    // totally useless code, the same thing can be done elegantly with clipping

    // private paintPlots(){
    //     if (!this.ctx){
    //         return;
    //     }

    //     this.ctx.save()
    //     for (const plot of this.linePlots) {

    //         var pathStarted = false;

    //         var getYInterpolate = (i: number, iCheckRange: number) => {
    //             let p: Point;
    //             if (plot.y[iCheckRange] < this.range.y) {
    //                 // make linear interpolation
    //                 p = this.evalYPointOnLine({x: plot.x[i-1], y: plot.y[i-1]}, {x: plot.x[i], y: plot.y[i]}, this.range.y);
    //                 pathStarted = false;
    //             } else if (plot.y[iCheckRange] > this.range.y + this.range.h) {
    //                 p = this.evalYPointOnLine({x: plot.x[i-1], y: plot.y[i-1]}, {x: plot.x[i], y: plot.y[i]}, this.range.y + this.range.h);
    //                 pathStarted = false;
    //             } else {
    //                 p = {x: plot.x[iCheckRange], y: plot.y[iCheckRange]};
    //             }
    
    //             return p;
    //         }

    //         this.ctx.beginPath()
        
    //         for (let i = 1; i < plot.x.length; i++) {
    //             if (plot.x[i] < this.range.x)
    //                 continue;

    //             // console.log(i, pathStarted);
            
    //             if (!pathStarted) {
    //                 // if (plot.y[i] < this.range.y || plot.y[i] > this.range.y + this.range.h){
    //                 //     continue;
    //                 // }
    //                 // console.log('path started');

    //                 // if (plot.y[i] < this.range.y || plot.y[i] > this.range.y + this.range.h)
    //                 //     continue;

    //                 //  && plot.y[i] >= this.range.y && plot.y[i] <= this.range.y + this.range.h

    //                 // if the previous x point was outside of range
    //                 if (plot.x[i - 1] < this.range.x) {
    //                     // console.log('previous x outside of range');
    //                     // calculate the point that intersects with y axis
                        
    //                     var p0 = this.evalXPointOnLine({x: plot.x[i-1], y: plot.y[i-1]}, {x: plot.x[i], y: plot.y[i]}, this.range.x);

    //                     // if p0.y is outside of y range, calculate the point that intersects with x axis 
    //                     if (p0.y < this.range.y || p0.y > this.range.y + this.range.h)
    //                         p0 = getYInterpolate(i, i - 1);

    //                     if (p0.x < this.range.x)
    //                         continue;

    //                 } else {
    //                     var p0 = getYInterpolate(i, i - 1);
    //                 }
    //                 // console.log(p0, i, 'starting path');
    //                 p0 = this.mapRange2Canvas(p0);
    //                 this.ctx.moveTo(p0.x, p0.y);
    //                 pathStarted = true;
    //             }

    //             // if it is the last line
    //             if (plot.x[i] > this.range.x + this.range.w){
    //                 // console.log('last x outside of range');
    //                 let p = this.evalXPointOnLine({x: plot.x[i-1], y: plot.y[i-1]}, {x: plot.x[i], y: plot.y[i]}, this.range.x + this.range.w);
    //                 // if p0.y is outside of range, check y
    //                 if (p.y < this.range.y || p.y > this.range.y + this.range.h)
    //                     p = getYInterpolate(i, i);

    //                 if (p.x > this.range.x + this.range.w)
    //                     break;

    //                 p = this.mapRange2Canvas(p);
    //                 this.ctx.lineTo(p.x, p.y);
    //                 break;

    //             } else {
    //                 let p = getYInterpolate(i, i);
    //                 p = this.mapRange2Canvas(p);
    //                 this.ctx.lineTo(p.x, p.y);
    //             }
    //         }

    //         this.ctx.strokeStyle = plot.color;
    //         this.ctx.lineWidth = plot.lw;
    //         this.ctx.stroke();
    //     }
    //     this.ctx.restore();
        
    // }

        // private evalYPointOnLine(p1: Point, p2: Point, y: number): Point {
    //     // gets the point on the line determined by points p1 and p2 at y
    //     // returns {x: [calculated], y: y}

    //     let slope = (p2.y - p1.y) / (p2.x - p1.x)
    //     return {x: p1.x + (y - p1.y) / slope, y}  // y = slope * (x - p1.x) + p1.y
    // }

    // private evalXPointOnLine(p1: Point, p2: Point, x: number): Point {
    //     // gets the point on the line determined by points p1 and p2 at y
    //     // returns {x:x, y: [calculated]}

    //     let slope = (p2.y - p1.y) / (p2.x - p1.x)
    //     return {x, y: slope * (x - p1.x) + p1.y}  // y = slope * (x - p1.x) + p1.y
    // }
