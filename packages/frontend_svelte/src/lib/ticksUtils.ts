import { F32Array, NumberArray } from "./array";
import type { Axis } from "./axis.svelte";
import type { Orientation } from "./Figure.svelte";
import type { Rect } from "./Scene.svelte";

const steps = F32Array.fromArray([1, 2, 5]);


function genLinearTicks(coor: number, size: number, prefMajorBins: number): [Array<number>, Array<number>, Array<number>] {
    const scale = 10 ** Math.floor(Math.log10(Math.abs(size)));

    const extStepsScaled = F32Array.fromArray([
        ...F32Array.mul(steps, 0.01 * scale), 
        ...F32Array.mul(steps, 0.1 * scale), 
        ...F32Array.mul(steps, scale)]);

    const rawStep = size / prefMajorBins;

    //find the nearest value in the array
    const _idx = extStepsScaled.nearestIndex(rawStep);
    const step = extStepsScaled[_idx];
    const stepScale = 10 ** Math.floor(Math.log10(step));

    const k = (Math.round(step / stepScale) % 5 === 0) ? 2 : 1;

    const minorStep = extStepsScaled[_idx - k];

    const bestMin = Math.ceil(coor / step) * step;
    const bestMinMinor = Math.ceil(coor / minorStep) * minorStep;

    const nticks = 1 + (coor + size - bestMin) / step >> 0; // integer division
    const nticksMinors = 1 + (coor + size - bestMinMinor) / minorStep >> 0; // integer division

    const ticks = new Array<number>()

    // generate ticks
    for (let i = 0; i < nticks; i++) {
        ticks[i] = bestMin + step * i;
    }

    const minorTicks = new Array<number>()
    
    for (let i = 0; i < nticksMinors; i++) {
        const val = bestMinMinor + minorStep * i;
        if (ticks.includes(val)) continue;
        minorTicks.push(val);
    }

    return [ticks, ticks, minorTicks];
}

function genLogTicks(coor: number, size: number, prefMajorBins: number): [NumberArray, NumberArray, NumberArray] {
    const step = Math.max(1, Math.round(size / prefMajorBins));

    // make major ticks
    const bestMin = Math.ceil(coor / step) * step;
    const nticks = 1 + (coor + size - bestMin) / step >> 0; // integer division
    let majorTicks = new NumberArray(nticks);
    let majorTicksValues = new NumberArray(nticks);

    // generate ticks
    for (let i = 0; i < nticks; i++) {
        majorTicks[i] = bestMin + step * i;
        majorTicksValues[i] = 10 ** majorTicks[i];
    }

    let minorTicks = new NumberArray();
    const minorTicksPositions = [2, 3, 4, 5, 6, 7, 8, 9];

    if (step === 1) {
        // fill before first major tick
        
        let firstMajorTickValue = majorTicksValues[0];

        if (majorTicksValues.length === 0) {
            firstMajorTickValue = 10 ** Math.ceil(coor + size);
        }

        for (const v of minorTicksPositions) {
            const tick = Math.log10(0.1 * firstMajorTickValue * v);
            if (tick < coor) continue;
            minorTicks.push(tick);
        }

        for (const majorTickValue of majorTicksValues) {
            for (const v of minorTicksPositions) {
                const tick = Math.log10(majorTickValue * v);
                if (tick > coor + size) break;
                minorTicks.push(tick);
            }
        }

        if (majorTicksValues.length === 0) {
            majorTicks = minorTicks.copy();
            majorTicksValues = NumberArray.fromArray(majorTicks.map(num => 10 ** num));
            minorTicks.clear();
        }
    }

    return [majorTicks, majorTicksValues, minorTicks];
}


export function getTicks(axis: Axis, svgRect: Rect, axisAlignment: Orientation, internalRange: Rect): [Array<number>, Array<number>, Array<number>]{
    // calculate scale

    let coor: number, size: number, prefMajorBins: number, prefMinorBins: number;
    const f = 0.01;
    const fMinor = 0.05;
    const dpr = window.devicePixelRatio;
    let fx = f * 2;
    let fy = f * 3; // 2 times more preffered number of ticks on y axis then on x axis because of smaller text
    // const r = this.getEffectiveRect();
    const r = svgRect;
    let w = r.w; 
    let h = r.h;
    const va = axisAlignment == "Vertical";
    if (va) {
        [w, h] = [h, w];
        [fx, fy] = [fy, fx];
    }
    if (axis.axisType === "xAxis") {
        coor = internalRange.x;
        size = internalRange.w;
        prefMajorBins = Math.max(Math.round(fx * w / dpr), 2);
        prefMinorBins = Math.round(w * fMinor);
    } else {
        coor = internalRange.y;
        size = internalRange.h;
        prefMajorBins = Math.max(Math.round(fy * h / dpr), 2);
        prefMinorBins = Math.round(h * fMinor);
    }

    // console.log("get ticks")

    switch (axis.scale) {
        case 'Linear': {
            return genLinearTicks(coor, size, prefMajorBins);
        }
        case 'Logarithmic': {
            return genLogTicks(coor, size, prefMajorBins);
        }
        case 'Symmetric logarithmic': {
            // throw new Error("Not implemented");
            const linScale = !(coor > axis.symlogLinthresh || coor + size < -axis.symlogLinthresh);
            const logScale = !(coor > -axis.symlogLinthresh && coor + size < axis.symlogLinthresh);
            const ticks = new NumberArray();
            const ticksValues = new NumberArray();
            const minorTicks = new NumberArray();

            if (linScale) {
                const start = (coor < -axis.symlogLinthresh) ? -axis.symlogLinthresh : coor;
                // const end = (coor + size > ax.symlogLinthresh) ? ax.symlogLinthresh : coor + size;
                
                // const linSize = end - start;
                // const sizeRatio = linSize / size;
                // const linPrefMajorBins = (axis === 'x') ? Math.max(Math.round((va ? 1.5 : 1) * w * sizeRatio * f), 2) : Math.max(Math.round((va ? 1 : 1.5) * h * sizeRatio * f), 2);
                // console.log(linPrefMajorBins);

                let [linTicks, linValues, linMinors] = genLinearTicks(start, size, prefMajorBins);
                // remove ticks outside of the linear range
                for (var i = 0; i < linTicks.length; i++) {
                    if (linTicks[i] > axis.symlogLinthresh) break; 
                }
                linTicks = linTicks.slice(0, i);
                linValues = linValues.slice(0, i);

                for (var i = 0; i < linMinors.length; i++) {
                    if (linMinors[i] > axis.symlogLinthresh) break; 
                }
                linMinors = linMinors.slice(0, i);

                ticks.push(...linTicks);
                ticksValues.push(...linValues);
                minorTicks.push(...linMinors);
            }

            if (logScale) {
                const axT = axis.transform;

                var getTransformedTicks = (startValue: number, endValue: number): [NumberArray, NumberArray, NumberArray] => {

                    const start = Math.log10(axis.symlogLinthresh);
                    // const realStart = Math.max(ax.symlogLinthresh, coor);
                    // const start = Math.log10(axT(startValue));
                    const end = Math.log10(axT(endValue));
                    const logSize = end - start;
                    const factor = (endValue - axis.symlogLinthresh) / (endValue - startValue);

                    prefMajorBins = (axis.axisType === 'xAxis') ? Math.max(Math.round(fx * w * factor), 2) : Math.max(Math.round(fy * h  * factor), 2)
                    
                    let [logTicks, logValues, logMinors] = genLogTicks(start, logSize, prefMajorBins);
                    let tr = (num: number) => axis.symlogLinthresh + (num - start) * axis.symlogLinthresh / axis.symlogLinscale;

                    logTicks.apply(tr);
                    logMinors.apply(tr);

                    // remove ticks before and after visible range

                    let idx = logTicks.nearestIndex(startValue);
                    idx = (logTicks[idx] > startValue) ? idx : idx + 1;
                    let idx2 = logTicks.nearestIndex(endValue);
                    idx2 = (logTicks[idx2] > endValue) ? idx2 : idx2 + 1;
                    logTicks = logTicks.slice(idx, idx2);
                    logValues = logValues.slice(idx, idx2);

                    idx = logMinors.nearestIndex(startValue);
                    idx = (logMinors[idx] > startValue) ? idx : idx + 1;
                    idx2 = logMinors.nearestIndex(endValue);
                    idx2 = (logMinors[idx2] > endValue) ? idx2 : idx2 + 1;
                    logMinors = logMinors.slice(idx, idx2);

                    return [logTicks, logValues, logMinors];

                }

                

                // for positive vals
                if (coor + size > axis.symlogLinthresh) {
                    const [logTicks, logValues, logMinors] = getTransformedTicks(Math.max(coor, axis.symlogLinthresh), coor + size);
                    ticks.push(...logTicks);
                    ticksValues.push(...logValues);
                    minorTicks.push(...logMinors);
                //     console.log(ticksValues);
                }

                // for negative vals
                if (coor < -axis.symlogLinthresh) {
                    const [logTicks, logValues, logMinors] = getTransformedTicks(-Math.min(coor + size, -axis.symlogLinthresh), -coor);
                    ticks.push(...logTicks.mul(-1));
                    ticksValues.push(...logValues.mul(-1));
                    minorTicks.push(...logMinors.mul(-1));
                }
            }
    
            return [ticks, ticksValues, minorTicks];

        }

        case 'Data bound': {

            if (axis.scaleArray === null) {
                throw new Error("Not implemented");
            }
            // data bound

            const step = Math.max(1, Math.round(size / prefMajorBins));
            const minorStep = Math.max(1, Math.round(size / prefMinorBins));

            const bestMin = Math.ceil(coor / step) * step;
            const bestMinMinor = Math.ceil(coor / minorStep) * minorStep;

            const nticks = 1 + (coor + size - bestMin) / step >> 0; // integer division
            const nticksMinors = 1 + (coor + size - bestMinMinor) / minorStep >> 0; // integer division

            const ticks = new NumberArray(nticks);
            const ticksValues = new NumberArray(nticks);
            
            // generate ticks
            for (let i = 0; i < nticks; i++) {
                ticks[i] = bestMin + step * i;
                ticksValues[i] = axis.scaleArray[ticks[i]] ?? Number.NaN;
            }
            
            const minorTicks = new NumberArray();
            
            for (let i = 0; i < nticksMinors; i++) {
                const val = bestMinMinor + minorStep * i;
                if (ticks.includes(val)) continue;
                minorTicks.push(val);
            }
            // console.log(minorTicks.length, nticksMinors);

            return [ticks, ticksValues, minorTicks];
        }
    }
}



export function determineSigFigures(num: number): number {
    if (num === 0) {
        return 1;
    }

    const order = Math.floor(Math.log10(Math.abs(num)));
    const maxFigures = 7;
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


export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
}