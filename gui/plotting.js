

class F64Array extends Float64Array {

    mul(scalar, copy=false) {
        let arr = copy ? new F64Array(this) : this;
        for (let i = 0; i < arr.length; i++) {
            arr[i] *= scalar;
        }
        return arr;
    }

    add(scalar, copy=false) {
        let arr = copy ? new F64Array(this) : this;
        for (let i = 0; i < arr.length; i++) {
            arr[i] += scalar;
        }
        return arr;
    }

    abs(copy=false){
        let arr = copy ? new F64Array(this) : this;
        for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.abs(arr[i]);
        }
        return arr;
    }
    argmin(){
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
}

const canvas = document.getElementById("main-canvas");
const ctx = canvas.getContext("2d");

const margin = {left: 0.1, right: 0.1, top: 0.1, bottom: 0.1};  // in range of [0, 1]

// const initRange = {
//     x0: -1, x1: 1, y0: -1, y1: 1
// };

let panning = false;
let scaling = false;
var range = new Float64Array([-1, 100, -8, 9]);  // x0 x1, y0, y1
let lastRange = new Float64Array(4);
// let mousePos = {x: 0, y: 0};
let mouseDownPos = {x: 0, y: 0};


const testData = {
    x: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    y: [9, 1, 5, 3, 8, -7, 4, 8,-2, 8, 0]
 }

function genTestData(n=100){
    let x = new Float64Array(n);
    let y = new Float64Array(n);

    for (let i = 0; i < n; i++) {
        x[i] = i;
        y[i] = Math.random() * 10;
    }

    return [x, y];

}


function drawtext(x, y){
    initFigure();

    let text = `x: ${x}, y:${y}`;
    // ctx.fillText(text, 50, 200);

}


canvas.addEventListener('click', (e) => {
    console.log('left clicked');
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    console.log('right clicked');
});

canvas.addEventListener('mousedown', (e) => {
    // console.log(`mousedown, button${e.button}`);
    // console.log(`x:${e.offsetX}, y:${e.offsetY}`)
    if (e.button == 0 || e.button == 1){
        panning = true;
    }

    if (e.button == 2){
        scaling = true;
    }

    mouseDownPos.x = e.offsetX;
    mouseDownPos.y = e.offsetY;
    // lastRange = {...range};
    for (let i = 0; i < 4; i++) {
        lastRange[i] = range[i];
    }

    // button0 left mouse, button2 right mouse, button1 middle mouse
});

canvas.addEventListener('mousemove', (e) => {
    // drawtext(e.offsetX, e.offsetY);

    let xRatio = (lastRange[1] - lastRange[0]) / (canvas.width * (1 - margin.left - margin.right));
    let yRatio = (lastRange[3] - lastRange[2]) / (canvas.height * (1 - margin.top - margin.bottom));
    
    let xDist = e.offsetX - mouseDownPos.x;
    let yDist = e.offsetY - mouseDownPos.y;

    if (panning){
        let xPan = xDist * xRatio;
        let yPan = yDist * yRatio;

        range[0] = lastRange[0] - xPan;  // x0
        range[1] = lastRange[1] - xPan;  // x1
        range[2] = lastRange[2] + yPan;  // y0
        range[3] = lastRange[3] + yPan;  // y1
        initFigure();

    }
    // analogous as in pyqtgraph
    // https://github.com/pyqtgraph/pyqtgraph/blob/7ab6fa3d2fb6832b624541b58eefc52c0dfb4b08/pyqtgraph/widgets/GraphicsView.py
    if (scaling){
        // let xZoom = mouseDownPos.x / e.offsetX;
        // let yZoom = mouseDownPos.y / e.offsetY;
        // xZoom *= xZoom;
        // yZoom *= yZoom;

        let xZoom = Math.pow(1.01, xDist);
        let yZoom = Math.pow(1.01, yDist);

        let centerX = mapCanvas2SceneX(mouseDownPos.x);
        let centerY = mapCanvas2SceneY(mouseDownPos.y);

        // console.log(xZoom, yZoom);
        console.log(xZoom);

        range[0] = centerX - (centerX - lastRange[0]) / xZoom;  // x0
        range[1] = centerX + (lastRange[1] - centerX) / xZoom;  // x1
        range[2] = centerY - (centerY - lastRange[2]) * yZoom;  // y0
        range[3] = centerY + (lastRange[3] - centerY) * yZoom;  // y1

        initFigure();
    }


    // button0 left mouse, button2 right mouse
});

canvas.addEventListener('mouseup', (e) => {
    // console.log(`mouseup, button${e.button}`);

    if (e.button == 0)
        panning = false;

    if (e.button == 2)
        scaling = false;
});




function draw() {
    ctx.fillStyle = "red";
    ctx.fillRect(10, 10, 70, 40);
}

function plot(x, y, color='red'){


    ctx.strokeStyle = color;
    ctx.beginPath()
    ctx.moveTo(mapSceneX2Canvas(x[0]), mapSceneY2Canvas(y[0]));

    for (let i = 1; i < x.length; i++) {
        ctx.lineTo(mapSceneX2Canvas(x[i]), mapSceneY2Canvas(y[i]));
    }
    ctx.stroke();

}

function mapCanvas2SceneY(y){
    return range[3] - (y - margin.top * canvas.height) * (range[3] - range[2]) / (canvas.height * (1 - margin.top - margin.bottom));
}

function mapCanvas2SceneX(x){
    return range[0] + (x - margin.left * canvas.width) * (range[1] - range[0]) / (canvas.width * (1 - margin.left - margin.right));
}

function mapSceneX2Canvas(x){
    // const cw = canvas.width;

    // let xscaled = (x - range.x0) / (range.x1 - range.x0);
    // let figureWidth = cw * (1.0 - margin.left - margin.right)
    // let x_t = xscaled * figureWidth;
    // return cw * margin.left + x_t;
    return canvas.width * (margin.left + (x - range[0])* (1.0 - margin.left - margin.right) / (range[1] - range[0]))
}

function mapSceneY2Canvas(y){
    // the y axis is opposite compared to x, because it canvas 0,0 starts at top left corner
    return canvas.height * (margin.top + (range[3] - y) * (1.0 - margin.top - margin.bottom) / (range[3] - range[2]))
}

function init(){
    // scaling also makes text reverse to it is not a a good option
    // ctx.translate(0, canvas.height);
    // ctx.scale(1, -1);

    ctx.strokeStyle = 'black';
    ctx.save();
}

function initFigure(){
    const w = canvas.width;
    const h = canvas.height;

    // ctx.scale(w, h);
    // Scaling will not work for stroked shapes including lines as the line thickness gets
    // scaled as well...

    ctx.restore()

    ctx.clearRect(0, 0, w, h);

    // draw rectangle

    ctx.strokeRect(w * margin.left, h * margin.top,
    w * (1.0 - margin.left - margin.right), 
    h * (1.0 - margin.top - margin.bottom));

    // draw tics

    drawTicks();

    ctx.save()

    let [ x, y ] = genTestData(100);

    plot(x, y);



    // ctx.restore();

}

// inspiration from matplotlib 
// https://github.com/matplotlib/matplotlib/blob/fcd5bb1a2b065e30acc530cb3e4a77fb99aea447/lib/matplotlib/ticker.py#L1962
function genMajorTicks(range, prefferedNBins=5){
    var steps = new F64Array([1, 2, 2.5, 5]);
    diff = range[1] - range[0];

    // calculate scale
    scale = Math.pow(10, Math.trunc(Math.log10(Math.abs(diff))));

    var extStepsScaled = new F64Array([...steps.mul(0.01, true), ...steps.mul(0.1, true), ...steps]);
    extStepsScaled.mul(scale);

    var raw_step = diff / prefferedNBins;

    //find the nearest value in the array
    var diff = extStepsScaled.add(-raw_step, true);
    diff.abs(); // absolute value
    let minIndex = diff.argmin();

    let step = extStepsScaled[minIndex];
    let best_min = Math.ceil(range[0] / step) * step;

    let nticks = 1 + (range[1] - best_min) / step >> 0; // integer division
    var ticks = new F64Array(nticks);

    // generate tics
    for (let i = 0; i < nticks; i++) {
        ticks[i] = best_min + step * i;
    }
    return ticks;
}

function drawTicks(nx = 5, ny = 5){
    // xdiff = range.x1 - range.x0;
    // ydiff = range.y1 - range.y0;

    let xticks = genMajorTicks([range[0], range[1]]);
    let yticks = genMajorTicks([range[2], range[3]]);

    // console.log(xticks);

    let tickSize = 8;
    let xtextOffset = 10;
    let ytextOffset = 10;

    // draw x ticks
    ctx.textAlign = 'center';
    ctx.beginPath();
    for (let i = 0; i < xticks.length; i++) {
        let x = mapSceneX2Canvas(xticks[i]);
        let y = (1 - margin.bottom) * canvas.height;

        ctx.moveTo(x, y);
        ctx.lineTo(x, y + tickSize);
        
        ctx.fillText(`${xticks[i]}`, x, y + tickSize + xtextOffset);
    }
    ctx.stroke();

    // draw y ticks
    ctx.textAlign = 'right';

    ctx.beginPath();
    for (let i = 0; i < yticks.length; i++) {
        let y = mapSceneY2Canvas(yticks[i]);
        let x = (margin.left) * canvas.width;

        ctx.moveTo(x, y);
        ctx.lineTo(x - tickSize, y);
        ctx.fillText(`${yticks[i]}`, x - tickSize - ytextOffset, y + 3);

    }
    ctx.stroke();

}


window.addEventListener("load", () => {

    // draw();
    init();
    initFigure();

});
