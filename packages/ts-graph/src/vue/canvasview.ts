import { v4 } from "uuid";
import { Scene } from "../scene";

// interface IConstructor<T> {
//     new (...args: any[]): T;

//     // Or enforce default constructor
//     // new (): T;
// }

// function activator<T extends Scene>(type: IConstructor<T>): T {
//     return new type();
// }

export class CanvasView<T extends Scene> {

    public id: string;
    public scene: T | null;

    constructor() {
        this.id = v4();
        this.scene = null;
    }

    public mount() {
        this.scene = new Scene(document.getElementById(this.id) as HTMLDivElement) as T;
    }
}