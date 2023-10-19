


const canvas = document.getElementById("main-canvas");
const ctx = canvas.getContext("2d");

 const testData = {
    x: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    y: [9, 1, 5, 3, 8, -7, 4, 8,-2, 8, 0]
 }


function draw() {
    ctx.fillStyle = "red";
    ctx.fillRect(10, 10, 70, 40);
}

const margin = {left: 10, right: 10, top: 10, bottom: 10}  // in %
const initRange = {
    x0: -1, x1: 1, y0: -1, y1: 1
}

function plot(x, y){



}


function initFigure(){
    var width = canvas.width;
    var height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // make rectangle

    ctx.strokeRect(width * margin.left / 100, height * margin.top / 100,
    width * (100.0 - margin.left - margin.right) / 100, 
    height * (100.0 - margin.top - margin.bottom) / 100)

    ctx.fillText('X axis', 50, 50);



    // ctx.save();
    // ctx.fillRect(50, 50, 50, 50);
    // ctx.restore();

}

function drawTicks(){
    const nx = 5, ny = 5;



}


window.addEventListener("load", () => {

    // draw();
    initFigure();
    drawTicks();

})
