import { Colormap, Colormaps } from "./plotter/color";
import { Matrix, NumberArray } from "./plotter/types";
import { Dataset, loadData } from "./plotter/utils";
import { SceneUser } from "./sceneuser";
import { Splitter } from "./splitter";
import 'bootstrap/dist/css/bootstrap.min.css';  // https://getbootstrap.com/docs/4.0/getting-started/webpack/
// import styles from "./styles.css";
var styles = require("./styles.css");


function benchmark() {
    let n = 999;
    let m = 1000;
    
    let mat = new Matrix(n, m);
    mat.fill(10);
    console.time('Matrix flat');
    let row = mat.getRow(20);
    row[1] = 5
    let col = mat.getCol(500)
    // console.log(col); 

    console.timeEnd('Matrix flat');

    
    // let mat = new MatrixArray(n, m);
    // mat.fill(10);

    // console.time('Matrix arrays');
    // let row = mat.getRow(199);
    // row[1] = 5

    // console.timeEnd('Matrix arrays');
}

// function loadFiles(e: Event, input: HTMLInputElement) {

// }

function abc(): void {

    var leftPane = document.querySelector(".left") as HTMLDivElement;
    var splitbar = document.querySelector(".splitbar") as HTMLDivElement;
    var splitter = new Splitter(leftPane, splitbar);

    // window.addEventListener("load", () => {
        
    // });
    var canvasDiv = document.getElementById("canvas-div") as HTMLDivElement;
    var scene = new SceneUser(canvasDiv);
    // var fig = scene.addFigure();
    // scene.testAddGrid();
    // fig.paint();

    var testbtn = document.getElementById('btnTest') as HTMLInputElement;
    testbtn.addEventListener("click", (ev) => {

        let x = NumberArray.linspace(-1, 1, 10);  // wls
        let y = NumberArray.linspace(-1, 1, 10);  // time

        var arr = NumberArray.linspace(0, 10, x.length * y.length, true);
        var m = new Matrix(y.length, x.length, arr);

        let d = new Dataset(m, x, y);
        d.data.log();
        d.transpose();
        d.data.log();

        scene.fig?.plotHeatmap(d, new Colormap(Colormaps.symgrad));

    });

    var button = document.getElementById('openFile') as HTMLInputElement;
    button.addEventListener("change", (ev) => {
        if (!button.files) return;
        scene.loadFiles(button.files);
    });

}


abc()
