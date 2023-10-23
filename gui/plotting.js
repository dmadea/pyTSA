


const canvas = document.getElementById("main-canvas");
const ctx = canvas.getContext("2d");

const margin = {left: 0.1, right: 0.1, top: 0.1, bottom: 0.1};  // in range of [0, 1]
const steps = [1, 2, 2.5, 5, 10];
const initRange = {
    x0: -1.3, x1: 1.3, y0: -1, y1: 1
};

let dragging = false;
let scaling = false;
let range = {...initRange};
let lastRange = {...initRange};
// let mousePos = {x: 0, y: 0};
let lastMousePos = {x: 0, y: 0};


const testData = {
    x: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    y: [9, 1, 5, 3, 8, -7, 4, 8,-2, 8, 0]
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
    if (e.button == 0){
        dragging = true;
    }

    if (e.button == 2){
        scaling = true;
    }

    lastMousePos.x = e.offsetX;
    lastMousePos.y = e.offsetY;
    lastRange = {...range};

    // button0 left mouse, button2 right mouse
});

canvas.addEventListener('mousemove', (e) => {
    drawtext(e.offsetX, e.offsetY);

    // if (dragging | scaling){    
    //     console.log(`mousemove, button${e.button}`);
    //     console.log(`x:${e.offsetX}, y:${e.offsetY}`)

    //     mousePos.x = e.offsetX;
    //     mousePos.y = e.offsetY;
    // }
    let sc = 2;
    let scalex = sc * (lastRange.x1 - lastRange.x0) / canvas.width * (1 - margin.left - margin.right);
    let scaley = sc * (lastRange.y1 - lastRange.y0) / canvas.height * (1 - margin.top - margin.bottom);
    
    let xdist = e.offsetX - lastMousePos.x;
    let ydist = e.offsetY - lastMousePos.y;

    if (dragging){
        range = {
            x0: lastRange.x0 - xdist * scalex,
            x1: lastRange.x1 - xdist * scalex,
            y0: lastRange.y0 - ydist * scaley,
            y1: lastRange.y1 - ydist * scaley
        }

        initFigure();
    }

    if (scaling){



        range = {
            x0: lastRange.x0 * xdist * scalex,
            x1: lastRange.x1 * xdist * scalex,
            y0: lastRange.y0 * ydist * scaley,
            y1: lastRange.y1 * ydist * scaley
        }

        initFigure();
    }


    // button0 left mouse, button2 right mouse
});

canvas.addEventListener('mouseup', (e) => {
    // console.log(`mouseup, button${e.button}`);

    if (e.button == 0)
        dragging = false;

    if (e.button == 2)
        scaling = false;
});




function draw() {
    ctx.fillStyle = "red";
    ctx.fillRect(10, 10, 70, 40);
}



function plot(x, y){

}

function mapx2canvas(x){
    const cw = canvas.width;

    let xscaled = (x - range.x0) / (range.x1 - range.x0);
    let figureWidth = cw * (1.0 - margin.left - margin.right)
    let x_t = xscaled * figureWidth;
    return cw * margin.left + x_t;
}

function mapy2canvas(y){
    const ch = canvas.height;

    let yscaled = (y - range.y0) / (range.y1 - range.y0);
    let figureHeight = ch * (1.0 - margin.top - margin.bottom)
    let y_t = yscaled * figureHeight;
    return ch * margin.top + y_t;
}


function t(x, y){
    return [x * canvas.width, y * canvas.height];
}

function r_t(x, y){
    return [x / canvas.width, y / canvas.height]
}

function initFigure(){
    const w = canvas.width;
    const h = canvas.height;
    // ctx.save();

    // ctx.scale(w, h);
    // Scaling will not work for stroked shapes including lines as the line thickness gets
    // scaled as well...

    ctx.clearRect(0, 0, w, h);

    // draw rectangle

    ctx.strokeRect(w * margin.left, h * margin.top,
    w * (1.0 - margin.left - margin.right), 
    h * (1.0 - margin.top - margin.bottom));

    // draw tics

    drawTicks();




    // ctx.restore();

}

// inspiration from matplotlib 
// https://github.com/matplotlib/matplotlib/blob/fcd5bb1a2b065e30acc530cb3e4a77fb99aea447/lib/matplotlib/ticker.py#L1962
function genMajorTicks(range, maxnbins=5){
    diff = range[1] - range[0];

    // calculate scale
    scale = Math.pow(10, Math.trunc(Math.log10(Math.abs(diff))));
    let scaledSteps = [...steps.slice(0, -1), ...steps];
    // console.log(scaledSteps);
    
    for (let i = 0; i < scaledSteps.length; i++) {
        scaledSteps[i] *= scale;
        if (i < steps.length - 1){
            scaledSteps[i] *= 0.1;
        }
    }

    // raw_step = diff / maxnbins;

    let ticks = [];

    for (let i = 0; i < scaledSteps.length; i++) {
        step = scaledSteps[scaledSteps.length - i];
        let best_min = (range[0] / step >> 0) * step;

        let nsteps = (range[1] - best_min) / step >> 0; // integer division
        if (nsteps > maxnbins + 1){
            break;
        }

        // generate tics
        for (let i = 0; i < nsteps + 1; i++) {
            ticks[i] = best_min + step * i;
        }
    }
    return ticks;
}

function drawTicks(nx = 5, ny = 5){
    // xdiff = range.x1 - range.x0;
    // ydiff = range.y1 - range.y0;

    let xticks = genMajorTicks([range.x0, range.x1]);
    let yticks = genMajorTicks([range.y0, range.y1]);

    // console.log(xticks);

    let tickSize = 8;
    let xtextOffset = 10;
    let ytextOffset = 10;

    // draw x ticks
    ctx.textAlign = 'center';
    ctx.beginPath();
    for (let i = 0; i < xticks.length; i++) {
        let x = mapx2canvas(xticks[i]);
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
        let y = mapy2canvas(yticks[i]);
        let x = (margin.left) * canvas.width;

        ctx.moveTo(x, y);
        ctx.lineTo(x - tickSize, y);
        ctx.fillText(`${yticks[i]}`, x - tickSize - ytextOffset, y + 3);

    }
    ctx.stroke();


    

}


window.addEventListener("load", () => {

    // draw();
    initFigure();
    drawTicks();

});
