

export class F32Array extends Float32Array {

    // static fromArray(array: number[] | F32Array | Array<number>): F32Array {
    //     let arr = new F32Array(array.length);
    //     Object.assign(arr, array);
    //     return arr;
    // }

    static fromArray(array: Float32Array | Float64Array | number[] | Array<number>): F32Array {
        const arr = new F32Array(array.length);
        for (let i = 0; i < array.length; i++) {
            arr[i] = array[i];
        }
        return arr;
    }

    static diff(array: number[] | F32Array): F32Array {
        if (array.length < 2) {
            throw TypeError("Array has to have at least 2 elements.");
        }
        let arr = new F32Array(array.length - 1);
        for (let i = 0; i < array.length - 1; i++) {
            arr[i] = array[i + 1] - array[i];
        }
        return arr;
    }

    static linspace(start: number, end: number, n: number, endpoint: boolean = false): F32Array {
        if (n < 2) {
            throw TypeError("At least 2 points are required.");
        }
        let nn = (endpoint) ? n - 1 : n;
        let diff = (end - start) / nn;
        let arr = new F32Array(n);
        for (let i = 0; i < n; i++) {
            arr[i] = start + i * diff;
        }
        return arr;
    }

    static logspace(start: number, end: number, n: number, endpoint: boolean = false): F32Array {
        if (n < 2) {
            throw TypeError("At least 2 points are required.");
        }
        let nn = (endpoint) ? n - 1 : n;
        let diff = (end - start) / nn;
        let arr = new F32Array(n);
        for (let i = 0; i < n; i++) {
            arr[i] = 10 ** (start + i * diff);
        }
        return arr;
    }

    static random(min: number, max: number, n: number, log?: boolean): F32Array {
        let diff = max - min;

        let arr = new F32Array(n);
        for (let i = 0; i < n; i++) {
            arr[i] = (log) ? 10 ** (Math.random() * diff + min) : Math.random() * diff + min;
        }
        return arr;
    }

    constructor(arrayLength?: number) {
        if (arrayLength) {
            super(arrayLength);
        } else {
            super();
        }
    }

    public toFloat64Array() {
        const arr = new Float64Array(this);
        return arr;
    }


    // handcrafted function, combination of argmin and abs. value calculation
    // in one cycle
    public nearestIndex(value: number): number {
        let minIndex = 0;
        let minval = Number.POSITIVE_INFINITY;
        for (let i = 0; i < this.length; i++) {
            let diff = Math.abs(this[i] - value);
            if (diff < minval) {
                minval = diff;
                minIndex = i;
            }
        }
        return minIndex;
    }

    public nearestValue(value: number): number {
        return this[this.nearestIndex(value)];
    }

    public copy(): F32Array {
        let arr = new F32Array(this.length);
        for (let i = 0; i < arr.length; i++) {
            arr[i] = this[i];
        }
        return arr;
    }

    static abs(array: F32Array | number[]): F32Array {
        let arr = new F32Array(array.length);
        for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.abs(array[i]);
        }
        return arr;
    }

    public abs(): F32Array {
        for (let i = 0; i < this.length; i++) {
            this[i] = Math.abs(this[i]);
        }
        return this;
    }

    static mul(array: F32Array | number[], value: number): F32Array {
        let arr = new F32Array(array.length);
        for (let i = 0; i < arr.length; i++) {
            arr[i] = array[i] * value;
        }
        return arr;
    }

    public mul(value: number): F32Array {
        for (let i = 0; i < this.length; i++) {
            this[i] *= value;
        }
        return this;
    }

    static add(array: F32Array | number[], value: number | F32Array | number[]): F32Array {
        let arr = new F32Array(array.length);
        if (typeof value === 'number') {
            for (let i = 0; i < arr.length; i++) {
                arr[i] = array[i] + value;
            }
        } else {
            if (array.length !== value.length) throw TypeError("Length of arrays does not match!");
            for (let i = 0; i < arr.length; i++) {
                arr[i] = array[i] + value[i];
            }
        }
        return arr;
    }

    public add(value: number): F32Array {
        for (let i = 0; i < this.length; i++) {
            this[i] += value;
        }
        return this;
    }

    public apply(fn: (num: number) => number): F32Array {
        for (let i = 0; i < this.length; i++) {
            this[i] = fn(this[i]);
        }
        return this;
    }

    public max(): number {
        var maxval = this[0];
        for (let i = 1; i < this.length; i++) {
            if (this[i] > maxval) {
                maxval = this[i];
            }
        }
        return maxval;
    }

    public min(): number {
        var minval = this[0];
        for (let i = 1; i < this.length; i++) {
            if (this[i] < minval) {
                minval = this[i];
            }
        }
        return minval;
    }

    public minmax(): [number, number] {
        var minval = this[0];
        var maxval = this[0];
        for (let i = 1; i < this.length; i++) {
            if (this[i] < minval) {
                minval = this[i];
            }
            if (this[i] > maxval) {
                maxval = this[i];
            }
        }
        return [minval, maxval];
    }

    public argMin(): number {
        var minIndex = 0;
        var minval = this[0];
        for (let i = 1; i < this.length; i++) {
            if (this[i] < minval) {
                minval = this[i];
                minIndex = i;
            }
        }
        return minIndex;
    }

    public sum(): number {
        let sum = 0;
        for (let i = 0; i < this.length; i++) {
            sum += this[i];
        }
        return sum;
    }

    public fillRandom(): F32Array {
        for (let i = 0; i < this.length; i++) {
            this[i] = Math.random();
        }
        return this;
    }

    // public slice(start?: number | undefined, end?: number | undefined): F32Array {
    //     return F32Array.fromArray(super.slice(start, end));
    // }

    // public clear() {
    //     this.length = 0;
    // }

    public log() {
        var str = "[";
        for (let i = 0; i < this.length; i++) {
            let nums = `${this[i].toPrecision(3)}`;
            str += (i === this.length - 1) ? nums : `${nums}, `;
        }
        str += "]";
        console.log(str);
    }
}

// https://stackoverflow.com/questions/26933365/how-to-write-an-interface-represents-a-tuple-type-in-typescript
// or type IData = [string, number, number];


export class Matrix extends F32Array {

    private _nrows: number;
    private _ncols: number;
    private _isCContiguous: boolean;

    // static fromArray(array: NumberArray | number[], nrows: number): Matrix {
    //     let arr = new Matrix(nrows, array.length / nrows);
    //     Object.assign(arr, array);
    //     return arr;
    // }

    constructor(nrows?: number, ncols?: number, arr?: number[] | F32Array) {
        if (nrows && ncols && !arr) {
            super(nrows * ncols);
            this._nrows = nrows;
            this._ncols = ncols;
        } else if (arr && nrows && ncols) {
            if (arr.length !== nrows * ncols) {
                throw TypeError("Number of entries in array does not match the dimension");
            }
            super();
            this._nrows = nrows;
            this._ncols = ncols;
            Object.assign(this, arr);
        } else {
            super();
            this._ncols = 0;
            this._nrows = 0;
        }
        this._isCContiguous = true;
    }

    get ncols() {
        return this._ncols;
    }

    get nrows() {
        return this._nrows;
    }

    get isCContiguous() {
        return this._isCContiguous;
    }

    set isCContiguous(value: boolean) {
        this._isCContiguous = value;
    }

    public get(row: number, column: number) {
        return (this._isCContiguous) ? this[row * this._ncols + column] : this[column * this._nrows + row];
    }

    public set(value: number, row: number, column: number) {
        if (this._isCContiguous) {
            this[row * this._ncols + column] = value;
        } else {
            this[column * this._nrows + row] = value;
        }
    }

    public getRow(index: number): F32Array {
        if (index >= this._nrows) {
            throw TypeError("Index is out of range.");
        }
        let arr = new F32Array(this._ncols);
        if (this._isCContiguous) {
            for (let i = 0; i < this._ncols; i++) {
                arr[i] = this[index * this._ncols + i];
            }
        } else {
            for (let i = 0; i < this._ncols; i++) {
                arr[i] = this[i * this._nrows + index];
            }
        }
        return arr;
    }

    public getCol(index: number): F32Array {
        if (index >= this._ncols) {
            throw TypeError("Index is out of range.");
        }
        let arr = new F32Array(this._nrows);
        if (this._isCContiguous) {
            for (let i = 0; i < this._nrows; i++) {
                arr[i] = this[i * this._ncols + index];
            }
        } else {
            for (let i = 0; i < this._nrows; i++) {
                arr[i] = this[index * this._nrows + i];
            }
        }
        return arr;
    }

    public transpose(): Matrix {
        this._isCContiguous = !this._isCContiguous;
        [this._nrows, this._ncols] = [this._ncols, this._nrows];
        return this;
    }

    static add(array: Matrix, value: number | F32Array | Matrix | number[]): Matrix {
        const arr = super.add(array, value);
        return new Matrix(array.nrows, array.ncols, arr);
    }

    static mSubtract(mat: Matrix, mat2: Matrix): Matrix {
        if (mat.length !== mat2.length) throw TypeError("Length of arrays does not match!");

        let arr = new Matrix(mat.nrows, mat.ncols);
        for (let i = 0; i < mat.nrows; i++) {
            for (let j = 0; j < mat.ncols; j++) {
                arr.set(mat.get(i, j) - mat2.get(i, j), i, j);
            }
        }
        return arr;
    }

    public log() {
        var str = `Matrix (${this.nrows} x ${this.ncols}):\n[`;
        for (let i = 0; i < this._nrows; i++) {
            str += "[";
            for (let j = 0; j < this._ncols; j++) {
                let nums = `${this.get(i, j).toPrecision(3)}`;
                str += (j === this._ncols - 1) ? nums : `${nums}, `;
            }
            str += (i === this._nrows - 1) ? "]" : "],\n";
        }
        str += "]";
        console.log(str);
    }

    public copy(): Matrix {
        const mat = new Matrix(this.nrows, this.ncols, super.copy());
        mat._isCContiguous = this._isCContiguous;
        return mat;
    }

}