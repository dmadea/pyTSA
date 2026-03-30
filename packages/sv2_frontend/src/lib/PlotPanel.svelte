<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { FigureSettings } from "@pytsa/tsgraph2";
  import PlotSettingsPanel from "$lib/PlotSettingsPanel.svelte";

  type PlotFigureSlot = {
    id: string;
    settings: FigureSettings;
    row: number;
    col: number;
    colspan: number;
    rowspan: number;
    demoSeries?: "sine" | "cosine";
  };

  const sceneGridGap = "8px";

  let rootEl: HTMLElement | null = null;
  let settingsOpen = $state(false);
  let panelSettings = $state<FigureSettings | null>(null);

  function openFigureSettings(target: FigureSettings) {
    panelSettings = target;
    settingsOpen = true;
  }

  let plotFigures = $state<PlotFigureSlot[]>([]);

  function newId() {
    return `fig-${Math.random().toString(36).slice(2, 10)}`;
  }

  function initDemoFigures(createDefaultFigureSettings: () => FigureSettings) {
    const a = createDefaultFigureSettings();
    a.title = "Sine (top)";
    a.xAxis.label = "phase";
    a.yAxis.label = "amplitude";

    const b = createDefaultFigureSettings();
    b.title = "Cosine";
    b.xAxis.label = "phase";
    b.yAxis.label = "amplitude";

    plotFigures = [
      {
        id: newId(),
        settings: a,
        row: 1,
        col: 1,
        colspan: 1,
        rowspan: 1,
        demoSeries: "sine",
      },
      {
        id: newId(),
        settings: b,
        row: 2,
        col: 1,
        colspan: 1,
        rowspan: 1,
        demoSeries: "cosine",
      },
    ];
    panelSettings = plotFigures[0]?.settings ?? null;
  }

  const figureById = new Map<string, any>();
  let scene: any = null;
  let lastStructure = "";
  let tsgraph: any = null;

  function notifyFigureForSettings(s: FigureSettings | null): void {
    if (!s) return;
    const slot = plotFigures.find((x) => x.settings === s);
    if (!slot) return;
    const fig = figureById.get(slot.id);
    fig?.notifySettingsChanged?.();
  }

  function structureKey(figs: PlotFigureSlot[]) {
    return figs.map((s) => `${s.id}:${s.row}:${s.col}:${s.colspan}:${s.rowspan}`).join("|");
  }

  function gridRows(figs: PlotFigureSlot[]) {
    const n = figs.length;
    return n > 0 ? `repeat(${n}, 1fr)` : "1fr";
  }

  async function rebuildScene() {
    if (!rootEl || !tsgraph) return;
    lastStructure = structureKey(plotFigures);

    scene?.dispose?.();
    figureById.clear();

    const { Scene } = tsgraph;
    const templateRows = gridRows(plotFigures);
    scene = new Scene(rootEl, {
      templateRows,
      templateCols: "1fr",
      rowGap: sceneGridGap,
      columnGap: sceneGridGap,
    });

    for (const slot of plotFigures) {
      const fig = scene.addFigure({
        row: slot.row,
        col: slot.col,
        colspan: slot.colspan,
        rowspan: slot.rowspan,
        settings: slot.settings,
      });
      figureById.set(slot.id, fig);
    }

    pushToPlot();
  }

  function synthSeries(n: number, noise: number) {
    const { F32Array } = tsgraph;
    const x = F32Array.linspace(0, 4 * Math.PI, n, true);
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      y[i] = Math.sin(x[i]) + (Math.random() - 0.5) * 2 * noise;
    }
    return { x, y };
  }

  function synthCosineSeries(n: number, noise: number) {
    const { F32Array } = tsgraph;
    const x = F32Array.linspace(0, 4 * Math.PI, n, true);
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      y[i] = Math.cos(x[i]) + (Math.random() - 0.5) * 2 * noise;
    }
    return { x, y };
  }

  function pushToPlot() {
    if (!tsgraph) return;
    const n = 1200;
    const noise = 0.06;
    plotFigures.forEach((slot, i) => {
      const fig = figureById.get(slot.id);
      if (!fig) return;
      const kind = slot.demoSeries ?? (i % 2 === 0 ? "sine" : "cosine");
      const data = kind === "cosine" ? synthCosineSeries(n, noise) : synthSeries(n, noise);
      fig.setLineData(data.x, data.y);
    });
  }

  onMount(async () => {
    tsgraph = await import("@pytsa/tsgraph2");
    initDemoFigures(tsgraph.createDefaultFigureSettings);
    await rebuildScene();
  });

  onDestroy(() => {
    scene?.dispose?.();
    scene = null;
    figureById.clear();
  });

  $effect(() => {
    if (!rootEl || !tsgraph) return;
    // If the number / placement of figures changes, rebuild the Scene.
    // Otherwise, only notify figures (e.g. axis label changes).
    const key = structureKey(plotFigures);
    if (key !== lastStructure) rebuildScene();
    else for (const fig of figureById.values()) fig.notifySettingsChanged?.();
  });
</script>

<div class="plot-panel">
  <div
    class="plot-wrap"
    style={`gap:${sceneGridGap};grid-template-rows:${gridRows(plotFigures)};grid-template-columns:1fr;`}
  >
    <div bind:this={rootEl} class="plot-host" aria-label="Plot area"></div>

    <div
      class="figure-settings-overlay"
      style={`gap:${sceneGridGap};grid-template-rows:${gridRows(plotFigures)};grid-template-columns:1fr;`}
    >
      {#each plotFigures as slot (slot.id)}
        <div class="figure-settings-cell">
          <button
            type="button"
            class="settings-btn"
            title={`Settings: ${slot.settings.title || slot.id}`}
            aria-label={`Figure settings: ${slot.settings.title || slot.id}`}
            onclick={() => openFigureSettings(slot.settings)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.52-.4-1.08-.73-1.69-.98l-.36-2.54a.484.484 0 0 0-.48-.42h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.61.25-1.17.59-1.69.98l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.52.4 1.08.73 1.69.98l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.61-.25 1.17-.59 1.69-.98l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
              />
            </svg>
          </button>
        </div>
      {/each}
    </div>
  </div>

  <p class="hint">Drag to pan · Right-drag or wheel to zoom · Double-click to reset view.</p>

  <PlotSettingsPanel
    open={settingsOpen}
    settings={panelSettings ?? plotFigures[0]?.settings}
    onChange={() => notifyFigureForSettings(panelSettings ?? plotFigures[0]?.settings)}
    onClose={() => (settingsOpen = false)}
  />
</div>

<style>
  .plot-panel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    overflow: hidden;
    background: #12141a;
    color: rgba(230, 230, 235, 0.9);
  }

  .plot-wrap {
    position: relative;
    flex: 1;
    min-height: 280px;
    display: grid;
    min-height: 0;
  }

  .plot-host {
    grid-row: 1 / -1;
    grid-column: 1;
    min-height: 0;
    width: 100%;
  }

  .figure-settings-overlay {
    grid-row: 1 / -1;
    grid-column: 1;
    z-index: 5;
    pointer-events: none;
    display: grid;
    min-height: 0;
  }

  .figure-settings-cell {
    position: relative;
    pointer-events: none;
    min-height: 0;
  }

  .settings-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 8px;
    background: rgba(20, 22, 30, 0.85);
    color: rgba(230, 230, 235, 0.85);
    cursor: pointer;
    backdrop-filter: blur(6px);
  }

  .settings-btn:hover {
    background: rgba(35, 38, 50, 0.95);
    color: #fff;
  }

  .hint {
    margin: 0;
    padding: 0.35rem 0.75rem 0.5rem;
    font-size: 0.72rem;
    opacity: 0.55;
    line-height: 1.35;
  }
</style>

