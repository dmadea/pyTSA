import { NumberArray, Matrix } from "./types";

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

export function determineSigFigures(num: number): number {
    if (num === 0) {
        return 1;
    }

    const order = Math.floor(Math.log10(Math.abs(num)));
    const maxFigures = 10;
    const treshhold = 10 ** (-maxFigures);
    for (var i = 1; i <= maxFigures; i++) {
        const multiplier = 10 ** (i - 1 - order);
        const rNum = Math.round(num * multiplier) / multiplier;
        const rErr = Math.abs((num - rNum) / num);
        if (rErr <= treshhold) {
            break;
        }
    }
    return i;
}

export function generateRandomPassword(length: number): string {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        password += characters.charAt(randomIndex);
    }

    return password;
}

export function isclose (a: number, b: number, rtol: number = 1e-3){
    return Math.abs(a - b) <= rtol * Math.abs(b);
}


export function formatNumber(num: number, sigFigures?: number): string {

    if (num === undefined || Number.isNaN(num)) {
        return "";
    }

    if (!sigFigures) {
        sigFigures = determineSigFigures(num);
    }

    // sigFigures = (sigFigures === undefined || Number.isNaN(sigFigures)) ? 3 : sigFigures;

    // // Round the number to the desired significant figures
    // const roundedNumber: number = Number(num.toFixed(sigFigures));

    // // Convert the rounded number to a string and return

    // Calculate the order of magnitude
    let order = (num === 0) ? 0 : Math.floor(Math.log10(Math.abs(num)));

    // Calculate the multiplier to get the desired number of significant figures
    const multiplier = 10 ** (sigFigures - 1 - order);

    // Round the number to the desired significant figures
    const negative = num < 0;
    const rNum = (num === 0) ? 0 : Math.round(Math.abs(num) * multiplier) / multiplier;

    order = (rNum === 0) ? 0 : Math.floor(Math.log10(Math.abs(rNum)));
    let str;

    if ((order < -3 || order > 4) && order !== 0){
        str = rNum.toExponential(sigFigures < 1 ? 0 : sigFigures - 1);
    } else {
        const places = sigFigures - 1 - order;
        str = rNum.toFixed(Math.max(0, places));
    }
    return (negative) ? `\u2212${str}` : str;
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


// improve reading of file 
// https://stackoverflow.com/questions/23331546/how-to-use-javascript-to-read-local-text-file-and-read-line-by-line
export function loadData(text: string, delimiter: string = '\t', newLine = '\n'): Dataset | null {

    let rowData: NumberArray = new NumberArray();
    const colData = new NumberArray();
    const data = new NumberArray();

    // console.log(data);
    const lines = text.split(newLine);
    let ncols: number | null = null;

    for (let i = 0; i < lines.length; i++) {
        const entries = lines[i].split(delimiter);

        if (!ncols) {
            ncols = entries.length - 1;
            rowData = new NumberArray(ncols);
            for (let j = 1; j < ncols + 1; j++) {
                rowData[j - 1] = parseFloat(entries[j]);
            }
            continue;
        }

        if (entries.length !== ncols + 1){
            // console.log(i, lines.length);
            if (i > 1) break;
            throw TypeError("Number of entries does not match the number of columns.");
        }

        colData.push(parseFloat(entries[0]));

        for (let j = 1; j < ncols + 1; j++) {
            data.push(parseFloat(entries[j]));
        }
    }

    if (!ncols)
        return null;

        const dataset = new Dataset(new Matrix(colData.length, ncols, data), rowData, colData)
    // console.log(dataset)

    return dataset;
}

export function drawTextWithGlow(text: string, x: number, y: number, ctx: CanvasRenderingContext2D, font: string) {
    // ctx.globalCompositeOperation = "source-over";  // calculate the difference of the colors
    ctx.fillStyle = "black";
    ctx.font = font;
    ctx.textBaseline = 'middle'; // horizontal alignment
    ctx.strokeStyle = "white";
    ctx.lineWidth = 5;
    ctx.setLineDash([]);
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
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
