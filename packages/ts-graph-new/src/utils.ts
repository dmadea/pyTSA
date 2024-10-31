import { F32Array, Matrix } from "./array";

export class Dataset {
    public data: Matrix;
    public x: F32Array;
    public y: F32Array;
    public name: string;

    constructor(data: Matrix, x: F32Array, y: F32Array, name: string = "") {
        //usually first dimension is time (rows) and second is wavelength (columns)
        if (data.ncols !== x.length || data.nrows !== y.length) {
            throw TypeError("Dimensions are not aligned with x and y arrays.");
        }
        this.data = data;
        this.x = x;
        this.y = y;
        this.name = name;
    }

    public transpose(): Dataset {
        [this.x, this.y] = [this.y, this.x];
        this.data.transpose();
        return this;
    }

    public getNearestValue(x: number, y: number): number {
        const row = this.y.nearestIndex(y);
        const col = this.x.nearestIndex(x);

        return this.data.get(row, col);
    }

    public copy() {
        return new Dataset(this.data.copy(), this.x.copy(), this.y.copy(), this.name);
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

export function formatNumber(num: number, sigFigures: number): number {
    // Calculate the order of magnitude
    const order = (num === 0) ? 0 : Math.floor(Math.log10(Math.abs(num)));

    // Calculate the multiplier to get the desired number of significant figures
    const multiplier = 10 ** (sigFigures - 1 - order);

    // Round the number to the desired significant figures
    const rNum = (num === 0) ? 0 : Math.round(Math.abs(num) * multiplier) / multiplier;
    const negative = num < 0;

    return negative ? -rNum : rNum;
}


export function formatNumber2String(num: number, sigFigures?: number, minusSymbol: string = "\u2212"): string {

    if (num === undefined || Number.isNaN(num)) {
        return "";
    }

    if (!sigFigures) {
        sigFigures = determineSigFigures(num);
    }

    // sigFigures = (sigFigures === undefined || Number.isNaN(sigFigures)) ? 3 : sigFigures;

    // // Round the number to the desired significant figures
    // const roundedNumber: number = Number(num.toFixed(sigFigures));

    const rNum = Math.abs(formatNumber(num, sigFigures));

    const negative = num < 0;

    const order = (rNum === 0) ? 0 : Math.floor(Math.log10(Math.abs(rNum)));
    let str;

    if ((order < -3 || order > 4) && order !== 0){
        str = rNum.toExponential(sigFigures < 1 ? 0 : sigFigures - 1);
    } else {
        const places = sigFigures - 1 - order;
        str = rNum.toFixed(Math.max(0, places));
    }
    return (negative) ? `${minusSymbol}${str}` : str;
}

export function genTestData(n=100){
    let x = new F32Array(n);
    let y = new F32Array(n);

    for (let i = 0; i < n; i++) {
        x[i] = i * 2 / n - 1;
        y[i] = Math.random() * 2 - 1;
    }

    return [x, y];


    

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


export function combinations<T>(arr: T[]): [T, T][] {
    let res: [T, T][] = [];
    for (let i = 0; i < arr.length - 1; i++) {
        for (let j = 1; j < arr.length; j++) {
            res.push([arr[i], arr[j]]);
        }
    }
    return res;
}

