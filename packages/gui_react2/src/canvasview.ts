import { Scene } from "@pytsa/ts-graph";
import { v4 } from "uuid";

export class CanvasView {

    public id: string;
    public scene: Scene | null;

    constructor() {
        this.id = v4();
        this.scene = null;
    }

    public mount() {
        // this.scene = new Scene(document.getElementById(this.id) as HTMLDivElement);
    }
}