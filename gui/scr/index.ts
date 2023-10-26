import { Scene } from "./scene";
import { Figure } from "./figure";

function abc(): void {

    // window.addEventListener("load", () => {
        
    // });
    var scene = new Scene(document.getElementById("canvas") as HTMLCanvasElement);
    scene.init();
    scene.plotRect();



}

abc()