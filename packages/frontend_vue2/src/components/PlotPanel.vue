<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { F32Array, Scene, type Figure, type FigureSettings } from "@pytsa/tsgraph2";
import { appState } from "../store/appState";
import {
  plotFigures,
  plotFiguresStructureKey,
} from "../store/plotSceneFigures";
import PlotSettingsPanel from "./PlotSettingsPanel.vue";

const sceneGridGap = "8px";

const rootEl = ref<HTMLElement | null>(null);
const settingsOpen = ref(false);
const panelSettings = ref<FigureSettings>(plotFigures[0]!.settings);

function openFigureSettings(target: FigureSettings): void {
  panelSettings.value = target;
  settingsOpen.value = true;
}

const plotVars = computed(() =>
  appState.theme === "paper"
    ? {
        "--tg-axis-tick": "rgba(0,0,0,0.35)",
        "--tg-axis-text": "rgba(30,30,35,0.9)",
        "--tg-axis-frame": "rgba(0,0,0,0.2)",
        "--tg-crosshair": "rgba(80,80,90,0.95)",
        "--tg-crosshair-hi": "rgba(20,20,25,0.95)",
      }
    : {
        "--tg-crosshair": "rgba(160,160,175,0.9)",
        "--tg-crosshair-hi": "rgba(230,230,240,0.95)",
      },
);

const gridRows = computed(() => {
  const n = plotFigures.length;
  return n > 0 ? `repeat(${n}, 1fr)` : "1fr";
});

const plotWrapGridStyle = computed(() => ({
  gap: sceneGridGap,
  gridTemplateRows: gridRows.value,
  gridTemplateColumns: "1fr",
}));

let scene: Scene | null = null;
const figureById = new Map<string, Figure>();
let lastStructure = "";

function synthSeries(
  n: number,
  noise: number,
): { x: Float32Array; y: Float32Array } {
  const x = F32Array.linspace(0, 4 * Math.PI, n, true);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    y[i] = Math.sin(x[i]!) + (Math.random() - 0.5) * 2 * noise;
  }
  return { x, y };
}

function synthCosineSeries(
  n: number,
  noise: number,
): { x: Float32Array; y: Float32Array } {
  const x = F32Array.linspace(0, 4 * Math.PI, n, true);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    y[i] = Math.cos(x[i]!) + (Math.random() - 0.5) * 2 * noise;
  }
  return { x, y };
}

function pushToPlot(): void {
  const n = appState.pointCount;
  const noise = appState.noise;
  plotFigures.forEach((slot, i) => {
    const fig = figureById.get(slot.id);
    if (!fig) return;
    const kind = slot.demoSeries ?? (i % 2 === 0 ? "sine" : "cosine");
    if (kind === "cosine") {
      const { x, y } = synthCosineSeries(n, noise);
      fig.setLineData(x, y);
    } else {
      const { x, y } = synthSeries(n, noise);
      fig.setLineData(x, y);
    }
  });
  appState.plotRedraws += 1;
}

function rebuildScene(): void {
  const el = rootEl.value;
  if (!el) return;

  lastStructure = plotFiguresStructureKey(plotFigures);
  scene?.dispose();
  figureById.clear();

  const count = plotFigures.length;
  const templateRows = count > 0 ? `repeat(${count}, 1fr)` : "1fr";

  scene = new Scene(el, {
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

onMounted(() => {
  const [a, b] = plotFigures;
  if (a) {
    a.settings.title = "Sine (top)";
    a.settings.xAxis.label = "phase";
    a.settings.yAxis.label = "amplitude";
  }
  if (b) {
    b.settings.title = "Cosine";
    b.settings.xAxis.label = "phase";
    b.settings.yAxis.label = "amplitude";
  }
  rebuildScene();
});

onUnmounted(() => {
  scene?.dispose();
  scene = null;
  figureById.clear();
});

watch(
  () => [appState.pointCount, appState.noise] as const,
  () => pushToPlot(),
);

watch(
  plotFigures,
  () => {
    if (!rootEl.value) return;
    const key = plotFiguresStructureKey(plotFigures);
    if (key !== lastStructure) {
      rebuildScene();
    } else {
      for (const fig of figureById.values()) {
        fig.notifySettingsChanged();
      }
    }
  },
  { deep: true, flush: "post" },
);

defineExpose({ pushToPlot });
</script>

<template>
  <div class="plot-panel" :style="plotVars">
    <div class="plot-wrap" :style="plotWrapGridStyle">
      <div ref="rootEl" class="plot-host" aria-label="Plot area" />
      <div class="figure-settings-overlay" :style="plotWrapGridStyle">
        <div
          v-for="slot in plotFigures"
          :key="slot.id"
          class="figure-settings-cell"
        >
          <button
            type="button"
            class="settings-btn"
            :title="`Settings: ${slot.settings.title || slot.id}`"
            :aria-label="`Figure settings: ${slot.settings.title || slot.id}`"
            @click="openFigureSettings(slot.settings)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.52-.4-1.08-.73-1.69-.98l-.36-2.54a.484.484 0 0 0-.48-.42h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.61.25-1.17.59-1.69.98l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.52.4 1.08.73 1.69.98l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.61-.25 1.17-.59 1.69-.98l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
    <p class="hint">
      Drag to pan · Right-drag or wheel to zoom · Double-click to reset view.
    </p>
    <PlotSettingsPanel
      :open="settingsOpen"
      :settings="panelSettings"
      @close="settingsOpen = false"
    />
  </div>
</template>

<style scoped>
.plot-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  overflow: hidden;
  background: #12141a;
}

:global(body.theme-paper) .plot-panel {
  border-color: rgba(0, 0, 0, 0.12);
  background: #fff;
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

:global(body.theme-paper) .settings-btn {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(0, 0, 0, 0.12);
  color: rgba(40, 40, 45, 0.85);
}

.hint {
  margin: 0;
  padding: 0.35rem 0.75rem 0.5rem;
  font-size: 0.72rem;
  opacity: 0.55;
  line-height: 1.35;
}
</style>
