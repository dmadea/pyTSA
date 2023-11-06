

export function formatNumber(num: number, sigFigures: number): string {

    var scale = 10 ** Math.trunc(Math.log10(Math.abs(num)));
    console.log(scale)

    if ((scale < 1e-5 || scale > 1e5) && scale > 0){
        return num.toExponential(sigFigures < 1 ? 0 : sigFigures - 1);
    } else {
        return num.toPrecision(sigFigures);  // TODO change to some default method, because toPrecision will change to exponential format for small signifiacnt values.
    }
}