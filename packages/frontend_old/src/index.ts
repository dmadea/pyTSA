import { Matrix,  Dataset, } from "@pytsa/ts-graph";

import { SceneUser } from "./sceneuser";
import { Splitter } from "./splitter";

import 'bootstrap/dist/css/bootstrap.min.css';  // https://getbootstrap.com/docs/4.0/getting-started/webpack/
// import styles from "./styles.css";
var styles = require("./styles.css");
import { arr2json, json2arr } from "./utils";


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

    const xhr: XMLHttpRequest = new XMLHttpRequest();;

    const leftPane = document.querySelector(".left") as HTMLDivElement;
    const splitbar = document.querySelector(".splitbar") as HTMLDivElement;
    const splitter = new Splitter(leftPane, splitbar);

    // window.addEventListener("load", () => {
        
    // });
    const canvasDiv = document.getElementById("canvas-div") as HTMLDivElement;
    const scene = new SceneUser(canvasDiv);
    // var fig = scene.addFigure();
    // scene.testAddGrid();
    // fig.paint();

    const btnPing = document.getElementById('btnPing') as HTMLInputElement;
    btnPing.addEventListener("click", (ev) => {

        const time = Date.now();

        xhr.onreadystatechange = () => {
            // console.log(xhr.responseText);
            if (xhr.readyState == 4 && xhr.status == 200) {  //  && xhr.responseText == "pong"
                console.log("ping: ", Date.now() - time, 'ms');
            }
        };
        // asynchronous requests
        xhr.open("GET", "/api/ping", true);
        // Send the request over the network
        xhr.send(null);

    });



    const testbtn = document.getElementById('btnTest') as HTMLInputElement;

    testbtn.addEventListener("click", (ev) => {



        // console.log("Get users...");

        // xhr.onreadystatechange = () => {
        //     if (xhr.readyState == 4 && xhr.status == 201) {
        //         var obj = JSON.parse(xhr.response);
        //         // console.log(obj);

        //         var t = b64decodeNumberArray(obj.data.matrix_data.times);
        //         var w = b64decodeNumberArray(obj.data.matrix_data.wls);
        //         var m = b64decodeNumberArray(obj.data.matrix_data.matrix.data);

        //         var mm =  new Matrix(t.length, w.length, m);
        //         mm.isCContiguous = obj.data.matrix_data.matrix.c_contiguous;

        //         console.log(t, w, m);

        //         var d = new Dataset(mm, w, t);
        //         scene.appendDataset(d);
        //     }
        // };
        // // asynchronous requests
        // // xhr.open("GET", "http://localhost:6969/api/ping", true);
        // xhr.open("POST", "/api/testpost", true);
        // xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

        // // Send the request over the network
        // xhr.send(JSON.stringify({"data": {test: "OK"}}));



        // let x = NumberArray.linspace(-1, 1, 10);  // wls
        // let y = NumberArray.linspace(-1, 1, 10);  // time

        // var arr = NumberArray.linspace(0, 10, x.length * y.length, true);
        // var m = new Matrix(y.length, x.length, arr);

        // let d = new Dataset(m, x, y);
        // d.data.log();
        // d.transpose();
        // d.data.log();

        // scene.fig?.plotHeatmap(d, new Colormap(Colormaps.symgrad));

    });

    const btnUpdate = document.getElementById('btnUpdate') as HTMLInputElement;
    btnUpdate.addEventListener("click", (ev) => {
        
        xhr.onreadystatechange = () => {
            if (xhr.readyState == 4 && xhr.status == 200) {
                var obj = JSON.parse(xhr.response);
                var ds = obj.data.datasets;
                let appended = false;

                for (let i = 0; i < ds.length; i++) {

                    var t = json2arr(ds[i].times);
                    var w = json2arr(ds[i].wavelengths);
                    var m = json2arr(ds[i].matrix.data);
                    var mat = new Matrix(t.length, w.length, m);
                    mat.isCContiguous = ds[i].matrix.c_contiguous;

                    if (i < scene.datasets.length) {  // update
                        scene.datasets[i].x = w;
                        scene.datasets[i].y = t;
                        scene.datasets[i].data = mat;
                        scene.datasets[i].name = ds[i].name;
                    } else { // append new
                        appended = true;
                        var d = new Dataset(mat, w, t, ds[i].name);
                        scene.datasets.push(d);
                    }
                }

                if (appended) {
                    scene.processDatasets();
                } else {
                    scene.replot();
                }
            }
        };
        // asynchronous requests
        xhr.open("GET", "/api/get_datasets", true);

        // Send the request over the network
        xhr.send(null);
    });

    
    const button = document.getElementById('openFile') as HTMLInputElement;
    button.addEventListener("change", (ev) => {
        if (!button.files) return;
        scene.loadFiles(button.files);
    });

}


abc()
