import { Scene } from "./plotter/scene";
import { Matrix, NumberArray } from "./plotter/types";
import { Dataset, loadData } from "./plotter/utils";
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

    // window.addEventListener("load", () => {
        
    // });
    var scene = new Scene(document.getElementById("canvas") as HTMLCanvasElement);
    // var fig = scene.addFigure();
    scene.testAddGrid();
    // fig.paint();

    var testbtn = document.getElementById('btnTest') as HTMLInputElement;
    testbtn.addEventListener("click", (ev) => {

        let x = NumberArray.linspace(-1, 1, 2);  // wls
        let y = NumberArray.linspace(-1, 1, 3);  // time

        var arr = NumberArray.linspace(0, 5, x.length * y.length);
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
                let dataset = loadData(reader.result, ',');

                if (dataset){
                    // dataset.data.log();
                    // dataset.transpose(); 
                    // dataset.data.log();

                    // console.log(dataset);
                    scene.fig?.plotHeatmap(dataset);
                }
                console.timeEnd('load');


            }

        });

        if (file) {

            reader.readAsBinaryString(file);
        }
          
          

        // var fname = 'file:///Users/dominikmadea/Library/CloudStorage/OneDrive-OIST/Projects/Test%20files/Femto/2023_08_07_3Z_MeOH_387_01-avrg.txt'
        // // loadData();


    });

    // for (let i = 0; i < 100; i++) {
    //     benchmark();
        
    // }

    // scene.plotRect();
}

abc()