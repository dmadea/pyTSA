import { NumberArray } from "./types";


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