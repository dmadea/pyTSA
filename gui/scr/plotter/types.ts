

// export interface Rect {
//     0: number,
//     1: number,
//     2: number,
//     3: number
// }

// export type Rect = [number, number, number, number];

export interface Margin {
    left: number,
    right: number,
    top: number, 
    bottom: number
}

export interface Rect {
    x: number, 
    y: number,
    w: number, // width
    h: number  // height
}

export interface Point {
    x: number,
    y: number
}


export class NumberArray extends Array<number> {

    public nearestIndex(value: number) {
        let diffArray = new NumberArray(this.length);
        for (let i = 0; i < diffArray.length; i++) {
            diffArray[i] = Math.abs(this[i] - value);
        }
        return diffArray.argMin();
    }

    public nearestValue(value: number) {
        return this[this.nearestIndex(value)];
    }

    public copy(){
        let arr = new NumberArray(this.length);
        for (let i = 0; i < arr.length; i++) {
            arr[i] = this[i];
        }
        return arr;
    }

    public abs(copy: boolean = false) {
        let arr = copy ? this.copy() : this;
        for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.abs(arr[i]);
        }
        return arr;
    }

    public mul(value: number, copy: boolean = false) {
        let arr = copy ? this.copy() : this;
        for (let i = 0; i < arr.length; i++) {
            arr[i] *= value;
        }
        return arr;
    }

    public add(value: number, copy: boolean = false) {
        let arr = copy ? this.copy() : this;
        for (let i = 0; i < arr.length; i++) {
            arr[i] += value;
        }
        return arr;
    }

    public max(){
        var maxval = this[0];
        for (let i = 1; i < this.length; i++) {
            if (this[i] > maxval){
                maxval = this[i];
            }
        }
        return maxval;
    }

    public min(){
        var minval = this[0];
        for (let i = 1; i < this.length; i++) {
            if (this[i] < minval){
                minval = this[i];
            }
        }
        return minval;
    }

    public argMin(){
        var minIndex = 0;
        var minval = this[0];
        for (let i = 1; i < this.length; i++) {
            if (this[i] < minval){
                minval = this[i];
                minIndex = i;
            }
        }
        return minIndex;
    }
}

// https://stackoverflow.com/questions/26933365/how-to-write-an-interface-represents-a-tuple-type-in-typescript
// or type IData = [string, number, number];