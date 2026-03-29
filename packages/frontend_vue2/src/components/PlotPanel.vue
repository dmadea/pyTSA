<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { F32Array, PlotHost } from "@pytsa/tsgraph2";
import { appState } from "../store/appState";
import { figureSettings } from "../store/figureSettings";
import PlotSettingsPanel from "./PlotSettingsPanel.vue";

const rootEl = ref<HTMLElement | null>(null);
const showSettings = ref(false);

const plotVars = computed(() =>
  appState.theme === "paper"
    ? {
        "--tg-axis-tick": "rgba(0,0,0,0.35)",
        "--tg-axis-text": "rgba(30,30,35,0.9)",
        "--tg-axis-frame": "rgba(0,0,0,0.2)",
      }
    : {},
);

let host: PlotHost | null = null;

function synthSeries(n: number, noise: number): { x: Float32Array; y: Float32Array } {
  const x = F32Array.linspace(0, 4 * Math.PI, n, true);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    y[i] = Math.sin(x[i]) + (Math.random() - 0.5) * 2 * noise;
  }
  return { x, y };
}

function pushToPlot(): void {
  if (!host) return;
  const { x, y } = synthSeries(appState.pointCount, appState.noise);
  host.setLineData(x, y);
  appState.plotRedraws += 1;
}

onMounted(() => {
  const el = rootEl.value;
  if (!el) return;
  figureSettings.title = "Demo series";
  figureSettings.xAxis.label = "phase";
  figureSettings.yAxis.label = "amplitude";
  host = new PlotHost(el, { settings: figureSettings });
  pushToPlot();
});

onUnmounted(() => {
  host?.dispose();
  host = null;
});

watch(
  () => [appState.pointCount, appState.noise] as const,
  () => pushToPlot(),
);

watch(
  figureSettings,
  () => {
    host?.notifySettingsChanged();
  },
  { deep: true },
);

defineExpose({ pushToPlot });
</script>

<template>
  <div class="plot-panel" :style="plotVars">
    <div class="plot-wrap">
      <button
        type="button"
        class="settings-btn"
        title="Plot settings"
        aria-label="Plot settings"
        @click="showSettings = true"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.52-.4-1.08-.73-1.69-.98l-.36-2.54a.484.484 0 0 0-.48-.42h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.61.25-1.17.59-1.69.98l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.52.4 1.08.73 1.69.98l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.61-.25 1.17-.59 1.69-.98l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
          />
        </svg>
      </button>
      <div ref="rootEl" class="plot-host" aria-label="Plot area" />
    </div>
    <p class="hint">
      Drag to pan · Right-drag or wheel to zoom · Double-click to reset view
    </p>
    <PlotSettingsPanel :open="showSettings" @close="showSettings = false" />
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
  display: flex;
  flex-direction: column;
}

.plot-host {
  flex: 1;
  min-height: 260px;
  width: 100%;
}

.settings-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 5;
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
