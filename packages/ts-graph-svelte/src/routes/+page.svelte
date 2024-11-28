<script lang="ts">
  import Figure from "$lib/Figure.svelte";
  import Input from "$lib/Input.svelte";
  import Scene from "$lib/Scene.svelte";

  import { Figure as Fig } from "@pytsa/ts-graph-new";
    import { F32Array, Matrix } from "@pytsa/ts-graph-new/src/array.js";
  import { Orientation } from "@pytsa/ts-graph-new/src/objects/draggableLines.js";
    import { Dataset } from "@pytsa/ts-graph-new/src/utils.js";
    import { onMount } from "svelte";

    // import 'bootstrap/dist/css/bootstrap.min.css';
    // import 'bootstrap/dist/js/bootstrap.min.js';

  const fig = new Fig()
  // fig.showTicks = ['left', 'bottom']
  fig.showTickNumbers = ['left', 'bottom']
  fig.xAxis.label = "X axis"
  fig.yAxis.label = "Y axis"
  fig.title = "Title"
  fig.axisAlignment = Orientation.Horizontal
  fig.xAxis.scale = 'lin'

  const fig2 = new Fig()
  const fig3 = new Fig()
  fig3.addColorbar()

  const fig4 = new Fig()
  fig4.addColorbar()

  const heatmap = new Matrix(3, 4, new F32Array([
    0, 1, 2, 4,
    5, 6, 7, 8,
    9, 10, 11, 12
  ]))

  const d = new Dataset(heatmap, new F32Array([0, 1, 2, 3]), new F32Array([0, 1, 2]))




  const x = F32Array.linspace(-10, 5, 1000)
  const y = F32Array.random(-1, 1, x.length)

  // const x = [-1, -1, 1, 1, -1]
  // const y = [1, -1, -1, 1, 1]

  // fig.plotLine(x, y, {r: 0, g: 0, b: 0, alpha: 0})

  // console.log(x, y)

  function onSceneInit(scene: Scene) {

    setTimeout(() => {
      fig.plotLine(x, y, {r: 1.0, g: 0.0, b: 0.0, alpha: 1.0})
      fig2.plotLine(x, y, {r: 0.0, g: 1, b: 0.0, alpha: 1.0})

      fig3.plotLine(x, F32Array.random(-Math.random(), Math.random(), x.length), {r: 1.0, g: 0, b: 0.0, alpha: 1.0})
      fig3.plotLine(x, F32Array.random(-Math.random(), Math.random(), x.length), {r: 0.0, g: 1, b: 0.0, alpha: 1.0})
      fig3.plotLine(x, F32Array.random(-Math.random(), Math.random(), x.length), {r: 0.0, g: 0, b: 1.0, alpha: 1.0})

      fig4.plotHeatmap(d)


    }, 10)

  }

</script>

<svelte:head>
  <style>
    html, body {
      /* background: AliceBlue; */
      height: 87%;
    }
  </style>
</svelte:head>

<h1>Welcome to your library project</h1>
<button class="btn btn-primary">Button</button>

<!-- <Input /> -->


<Scene templateCols="2fr 1fr 1fr" templateRows="1fr 1fr" onSceneInit={onSceneInit}>
  <Figure figure={fig} row=1 col=1 rowspan=1 colspan=1/>
  <Figure figure={fig4} row=1 col=2 colspan=2/> 
  <Figure figure={fig3} row=2 col=1/>
  <Figure figure={fig2} row=2 col=2 colspan=2/>
</Scene>




<style>


</style>