<script lang="ts">
  import Figure from "$lib/Figure.svelte";
  import Input from "$lib/Input.svelte";
  import Scene from "$lib/Scene.svelte";

  import { Figure as Fig,  } from "@pytsa/ts-graph-new";
    import { F32Array, Matrix, NumberArray } from "@pytsa/ts-graph-new/src/array.js";
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

  // const xx = new F32Array([-10, -1, -0.5, 0, 4, 7, 8, 8.1, 9, 11, 12, 14, 14.5, 14.6, 17, 18, 18.01])
  // const yy = new F32Array([-3, -1, 0, 2, 4, 10, 11, 12, 15, 15.6, 17, 19, 35, 36, 37, 38])

  const xx = F32Array.linspace(-1, 5, 1000)
  const yy = F32Array.logspace(-1, 6, 1000)

  const z = F32Array.random(0, 1, xx.length * yy.length)
  
  const heatmap = new Matrix(yy.length, xx.length, z)

  const d = new Dataset(heatmap, xx, yy)

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

      // fig4.plotHeatmap(d)

      // heatmap.log()


    }, 10)

  }

  function input_onchange(payload: Event) {
    const files = (payload.target as HTMLInputElement).files;
    if (!files) return;
    loadFiles(files, (datasets) => {

      fig4.plotHeatmap(datasets[0])

      console.log(datasets[0].x.length, datasets[0].y.length)

    });
  }


   function loadData(
  text: string,
  delimiter = "\t",
  newLine = "\n"
): Dataset | null {
  let rowData: NumberArray = new NumberArray();
  const colData = new NumberArray();
  const data = new NumberArray();

  // console.log(data);
  const lines = text.split(newLine);
  let ncols: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const entries = lines[i].split(delimiter);

    if (!ncols) {
      ncols = entries.length - 1;
      rowData = new NumberArray(ncols);
      for (let j = 1; j < ncols + 1; j++) {
        rowData[j - 1] = parseFloat(entries[j]);
      }
      continue;
    }

    if (entries.length !== ncols + 1) {
      // console.log(i, lines.length);
      if (i > 1) break;
      throw TypeError(
        "Number of entries does not match the number of columns."
      );
    }

    colData.push(parseFloat(entries[0]));

    for (let j = 1; j < ncols + 1; j++) {
      data.push(parseFloat(entries[j]));
    }
  }

  if (!ncols) return null;

  const dataset = new Dataset(
    new Matrix(colData.length, ncols, data),
    new F32Array(rowData),
    new F32Array(colData)
  );
  // console.log(dataset)

  return dataset;
}


  async function loadFiles(
  files: FileList,
  callback: (datasets: Dataset[]) => void
    ) {
      if (!files) return [];

      const datasets: Dataset[] = [];
      const processed: boolean[] = new Array<boolean>(files.length);
      processed.fill(false);
      // var names: string[] = [];

      // console.log(processed);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        const index = i;
        // console.time("start loading");
        reader.addEventListener("load", function (e) {
          if (!(typeof reader.result === "string")) return;

          const ext = file.name.split(".").pop()?.toLowerCase();

          const dataset = loadData(reader.result, ext === "csv" ? "," : "\t");
          // dataset?.transpose();
          // console.timeEnd("start loading");

          if (ext === "txt") {
            dataset?.transpose();
          }
          processed[index] = true;
          // names[index] = file.name;

          if (dataset) {
            dataset.name = file.name;
            datasets[index] = dataset;
          }

          // console.log(index, "processing", file);

          if (processed.every((entry) => entry)) {
            callback(datasets);
          }
        });
        reader.readAsBinaryString(file);
        // reader.readAsArrayBuffer(file)
        // reader.readAsArrayBuffer(file);
      }
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

<input type="file" class="btn button" onchange={input_onchange} multiple />  

<!-- <Input /> -->


<Scene templateCols="2fr 1fr 1fr" templateRows="1fr 1fr" onSceneInit={onSceneInit}>
  <Figure figure={fig} row=1 col=1 rowspan=1 colspan=1/>
  <Figure figure={fig4} row=1 col=2 colspan=2/> 
  <Figure figure={fig3} row=2 col=1/>
  <Figure figure={fig2} row=2 col=2 colspan=2/>
</Scene>




<style>


</style>