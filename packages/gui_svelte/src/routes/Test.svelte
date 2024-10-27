<script lang="ts">
    import { onMount } from "svelte";

    let count = $state<number>(0);


function clicked() {
    console.log("clicked")

}

let bottomAxis: HTMLDivElement;
let topAxis: HTMLDivElement;
let leftAxis: HTMLDivElement;
let gridDiv: HTMLDivElement;
let canvas: HTMLDivElement;






onMount(() => {

  console.log(gridDiv.offsetLeft, gridDiv.offsetTop)
});



// {bottomAxis.clientWidth} x {bottomAxis.clientHeight}



</script>

<button onclick={() => count++}>Push {count} a</button>

<div bind:this={gridDiv} class="grid">
 
  <div bind:this={leftAxis} class="left-axis">
    <svg version="1.2" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" class="graph" aria-labelledby="title" role="img">
      <title id="title">A line chart showing some information</title>
      <g class="labels x-labels">
        <text x="10" y="300">{leftAxis ? leftAxis.offsetLeft : ""} x {leftAxis ? leftAxis.offsetTop : ""}</text>
        <rect x="0" y="30" width="80" height="50"></rect>
      </g>
    </svg>
  </div>

  <div bind:this={bottomAxis} class="bottom-axis">
    Bottom axis {bottomAxis ? bottomAxis.offsetLeft : ""} x {bottomAxis ? bottomAxis.offsetTop : ""}
  </div>

  <div bind:this={topAxis} class="top-axis">
    Top axis {topAxis ? topAxis.offsetLeft : ""} x {topAxis ? topAxis.offsetTop : ""}
  </div>

  <div class="right-axis">
    R
  </div>

  <div bind:this={canvas} class="canvas">
    {canvas ? canvas.offsetLeft : ""} x {canvas ? canvas.offsetTop : ""}
    {canvas ? canvas.clientWidth : ""} x {canvas ? canvas.clientHeight : ""}

    <!-- <canvas>
    </canvas> -->
  </div>

</div>




<style>

.grid {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-rows: auto 1fr auto;
    width: 1000px;
    height: 600px;
    outline: black 1px solid;

    column-gap: 10px;
    row-gap: 10px;

}

.left-axis {
  grid-column-start: 1;
  grid-row-start: 1;
  grid-row-end: span 3;
}

.right-axis {
  grid-column-start: 3;
  grid-row-start: 1;
  grid-row-end: span 3;

}

.top-axis {
  grid-column-start: 2;
  grid-row-start: 1;
}

.bottom-axis {
  grid-column-start: 2;
  grid-row-start: 3;
}

.canvas {
  grid-column-start: 2;
  grid-row-start: 2;

  grid-column-end: span 1;
  grid-row-end: span 1;

  width: 100%;
  height: 100%;

  background-color: #d80000;
}

.graph {
  height: 100%;
  width: 80px;
  user-select: none;
  outline: rgb(14, 230, 43) 1px solid;
}

.graph .grid {
  stroke: #ccc;
  stroke-dasharray: 0;
  stroke-width: 1;
}

.line {
    stroke: #d80000;
  /* stroke-dasharray: 5; */
  stroke-width: 2;
}

.line:hover {
    stroke: black;
    cursor: move;
    stroke-width: 3;
}

.labels {
  font-size: 13px;
}

.label-title {
  font-weight: bold;
  text-transform: uppercase;
  font-size: 12px;
  fill: black;
}

.data {
  fill: red;
  stroke-width: 1; 
}

</style>
