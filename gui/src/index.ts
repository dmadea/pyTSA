import { Scene } from "./plotter/scene";
// import styles from "./styles.css";
var styles = require("./styles.css");
// import { Figure } from "./plotter/figure";


function abc(): void {

    // window.addEventListener("load", () => {
        
    // });
    var scene = new Scene(document.getElementById("canvas") as HTMLCanvasElement);
    // var fig = scene.addFigure();
    scene.testAddGrid();
    // fig.paint();

    // scene.plotRect();
}

abc()