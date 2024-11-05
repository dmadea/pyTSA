<script lang="ts">
  import Figure from "$lib/Figure.svelte";
  import Scene from "$lib/Scene.svelte";

  import { Figure as Fig } from "@pytsa/ts-graph-new";
  import { Orientation } from "@pytsa/ts-graph-new/src/objects/draggableLines.js";

    // import 'bootstrap/dist/css/bootstrap.min.css';
    // import 'bootstrap/dist/js/bootstrap.min.js';

  const fig = new Fig()
  // fig.showTicks = ['left', 'bottom']
  fig.showTickNumbers = ['left', 'bottom']
  fig.xAxis.label = "X axis"
  fig.yAxis.label = "Y axis"
  fig.title = "Title"
  fig.axisAlignment = Orientation.Horizontal

  // const items: ContextMenuItem[] = [
  //       {
  //           type: "action",
  //           label: "Copy plot to clipboard",
  //           onClick: () => {return}
  //       },
  //       {
  //           type: "divider",
  //       },
  //       {
  //           type: "action",
  //           label: "Copy figure",
  //           onClick: () => {return}
  //       },
  //       {
  //           type: "action",
  //           label: "Copy copy copy copy",
  //           onClick: () => {return}
  //       }

  //   ]

  // let menu = $state()

  // $inspect(menu)


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


<Scene templateCols="2fr 1fr 2fr" templateRows="1fr 1fr">
  <Figure figure={fig} row=1 col=1 rowspan=1 colspan=1/>
  <Figure row=1 col=2/> 
  <Figure row=2 col=1/>
  <Figure row=2 col=2 colspan=2/>
</Scene>





<style>
  @import 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
</style>