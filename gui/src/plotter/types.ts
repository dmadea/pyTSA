

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

    static fromArray(array: Array<number>) {
        let a = new NumberArray(array.length)
        for (let i = 0; i < array.length; i++) {
            a[i] = array[i];            
        }
        return a;
    }

    constructor(arrayLength: number | null = null) {
        if (arrayLength){
            super(arrayLength);
        } else {
            super();
        }
    }

    static linspace(start: number, end: number, n: number): NumberArray {
        let diff = (end - start) / n;
        let arr = new NumberArray(n);
        for (let i = 0; i < n; i++) {
            arr[i] = start + i * diff;
        }
        return arr;
    }

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

    public sum() {
        let sum = 0;
        for (let i = 0; i < this.length; i++) {
            sum += this[i];
        }
        return sum;
    }

    public fillRandom() {
        for (let i = 0; i < this.length; i++) {
            this[i] = Math.random();
        }
    }
}

// https://stackoverflow.com/questions/26933365/how-to-write-an-interface-represents-a-tuple-type-in-typescript
// or type IData = [string, number, number];


export class Matrix extends NumberArray {

    public readonly nrows: number;
    public readonly ncols: number;

    constructor (nrows: number, ncols: number, arr: NumberArray | null = null) {
        super(nrows * ncols);
        this.nrows = nrows;
        this.ncols = ncols;

        if (arr) {
            if (arr.length !== nrows * ncols) {
                throw TypeError("Number of entries in array does not match the dimension");
            }
            for (let i = 0; i < arr.length; i++) {
                this[i] = arr[i];            
            }
        }
        // rows will be added in the flat array: [...row1, ...row2, etc.]
    }

    public get(row: number, column: number) {
        return this[row * this.ncols + column];
    }

    getRow(index: number) {
        if (index >= this.nrows) {
            throw TypeError("Index is out of range.");
        }
        let arr = new NumberArray(this.ncols);
        for (let i = 0; i < this.ncols; i++) {
            arr[i] = this[index * this.ncols + i];
        }
        return arr;
    }

    getCol(index: number) {
        if (index >= this.ncols) {
            throw TypeError("Index is out of range.");
        }
        let arr = new NumberArray(this.nrows);
        for (let i = 0; i < this.ncols; i++) {
            arr[i] = this[i * this.ncols + index];
        }
        return arr;
    }


}

// export class MatrixArray {

//     public data: Array<Array<number>>;
//     public nrows: number;
//     public ncols: number;

//     constructor (nrows: number, ncols: number) {
//         this.data = new Array<Array<number>>(nrows);
//         for (let i = 0; i < nrows; i++) {
//             this.data[i] = new Array<number>(ncols);
//         }
//         this.nrows = nrows;
//         this.ncols = ncols;
//     }

//     public fill(value: number) {
//         for (let i = 0; i < this.nrows; i++) {
//             for (let j = 0; j < this.ncols; j++) {
//                 this.data[i][j] = value;
//             }
//         }
//     }

//     getRow(index: number) {
//         return this.data[index];
//     }



// }