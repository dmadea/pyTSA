import { Scene } from "./plotter/scene";
import { Matrix, NumberArray } from "./plotter/types";
import { Dataset, loadData } from "./plotter/utils";
import { Splitter } from "./splitter";
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

function abc(): void {

    var leftPane = document.querySelector(".left") as HTMLDivElement;
    var splitbar = document.querySelector(".splitbar") as HTMLDivElement;
    var splitter = new Splitter(leftPane, splitbar);

    // window.addEventListener("load", () => {
        
    // });
    var scene = new Scene(document.getElementById("canvas") as HTMLCanvasElement);
    // var fig = scene.addFigure();
    scene.testAddGrid();
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

        scene.fig?.plotHeatmap(d);



    });

    var button = document.getElementById('openFile') as HTMLInputElement;
    button.addEventListener("change", (ev) => {

        if (!button.files) {
            return;
        }

        var file = button.files[0];

        var reader = new FileReader();

        reader.addEventListener('load', function (e) {

            if (typeof reader.result === 'string') {
                console.time('load');
                
                let ext = file.name.split('.').pop()?.toLowerCase();

                let dataset = loadData(reader.result, (ext === 'csv') ? ',' : '\t');
                // dataset?.transpose();

                if (dataset && scene.fig){
                    // dataset.data.log();
                    dataset.transpose(); 
                    // dataset.data.log();

                    // console.log(dataset);
                    let heatmap = scene.fig.plotHeatmap(dataset);

                    let xdiff, ydiff, xOffset, yOffset;
                    
                    if (!heatmap.isXRegular) {
                        xdiff = 1;
                        xOffset = 0;
                    } else {
                        xdiff = (dataset.x[dataset.x.length - 1] - dataset.x[0]) / (dataset.x.length - 1);
                        xOffset = dataset.x[0];
                    }
            
                    // y axis
            
                    if (!heatmap.isYRegular) {
                        ydiff = 1;
                        yOffset = 0;
                    } else {
                        ydiff = (dataset.y[dataset.y.length - 1] - dataset.y[0]) / (dataset.y.length - 1);
                        yOffset = dataset.y[0];
                    }

                    scene.dLines?.setStickGrid(xdiff, xOffset, ydiff, yOffset);

                    scene.fig.setViewBounds([dataset.x[0], dataset.x[dataset.x.length - 1]], [dataset.y[0], dataset.y[dataset.y.length - 1]]);
                    // scene.repaint();
                }
                console.timeEnd('load');
            }

        });

        if (file) {

            reader.readAsBinaryString(file);
        }
    });


}

abc()