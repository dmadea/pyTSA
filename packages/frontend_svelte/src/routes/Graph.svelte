<script lang="ts">
  import GraphCanvas from '$lib/graphics/GraphCanvas.svelte';
  import { graphState } from '$lib/graphics/stores/graphState';
  
  let width = 800;
  let height = 600;
  let data = new Float32Array(1000 * 1000);
  let dataShape: [number, number] = [1000, 1000];
  
  // Fill data with some test values
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.sin(i * 0.01) * Math.cos(i * 0.005);
  }
  
  function handleDataUpdated(detail: { shape: [number, number] }) {
    const { shape } = detail;
    console.log('Data updated:', shape);
  }
  
  function handleResize(detail: { width: number; height: number }) {
    console.log('Resized:', detail);
  }
  
  function handleMouseMove(event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Convert coordinates to data space
    const dataX = Math.floor((x / width) * dataShape[1]);
    const dataY = Math.floor((y / height) * dataShape[0]);
    
    $graphState.hoveredCell = { x: dataX, y: dataY };
  }
  
  function handleMouseLeave() {
    $graphState.hoveredCell = null;
  }
</script>

<GraphCanvas
  {width}
  {height}
  {data}
  {dataShape}
  onDataUpdated={handleDataUpdated}
  onResize={handleResize}
>
  <svelte:fragment slot="overlay">
    <!-- Axes -->
    <g class="axes">
      <!-- Add axis lines and labels here -->
    </g>
    
    <!-- Hover overlay -->
    {#if $graphState.hoveredCell}
      <rect
        class="interactive hover-highlight"
        x={($graphState.hoveredCell.x / dataShape[1]) * width}
        y={($graphState.hoveredCell.y / dataShape[0]) * height}
        width={width / dataShape[1]}
        height={height / dataShape[0]}
        fill="rgba(255, 255, 255, 0.2)"
      />
      
      <text
        class="interactive tooltip"
        x={($graphState.hoveredCell.x / dataShape[1]) * width + 10}
        y={($graphState.hoveredCell.y / dataShape[0]) * height - 5}
      >
        Value: {data[$graphState.hoveredCell.y * dataShape[1] + $graphState.hoveredCell.x].toFixed(3)}
      </text>
    {/if}
  </svelte:fragment>
</GraphCanvas>

<style>
  .hover-highlight {
    stroke: white;
    stroke-width: 1px;
  }
  
  .tooltip {
    fill: white;
    font-size: 12px;
  }
</style> 