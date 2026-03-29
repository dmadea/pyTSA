<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import PlotPanel from "./components/PlotPanel.vue";
import { appState } from "./store/appState";

const plotPanel = shallowRef<InstanceType<typeof PlotPanel> | null>(null);

const sidebarNote = computed(
  () =>
    `Redraws: ${appState.plotRedraws} · points: ${appState.pointCount}`,
);

watch(
  () => appState.theme,
  (t) => {
    document.body.classList.toggle("theme-paper", t === "paper");
  },
  { immediate: true },
);

function randomize() {
  plotPanel.value?.pushToPlot();
}

function toggleTheme() {
  appState.theme = appState.theme === "dark" ? "paper" : "dark";
}
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <h1 class="title">pyTSA <span class="badge">Vue3 + tsgraph2</span></h1>
      <p class="muted">
        Plotting lives in TypeScript: WebGL line strip under SVG axes. Vue only
        hosts the surface and app chrome.
      </p>

      <div class="field">
        <label for="pts">Points</label>
        <input
          id="pts"
          v-model.number="appState.pointCount"
          type="range"
          min="32"
          max="2000"
          step="32"
        />
        <span class="val">{{ appState.pointCount }}</span>
      </div>

      <div class="field">
        <label for="nz">Noise</label>
        <input
          id="nz"
          v-model.number="appState.noise"
          type="range"
          min="0"
          max="0.8"
          step="0.02"
        />
        <span class="val">{{ appState.noise.toFixed(2) }}</span>
      </div>

      <div class="actions">
        <button type="button" class="btn primary" @click="randomize">
          Resample noise
        </button>
        <button type="button" class="btn" @click="toggleTheme">
          Toggle theme
        </button>
      </div>

      <p class="footnote muted">{{ sidebarNote }}</p>
    </aside>

    <main class="main">
      <PlotPanel ref="plotPanel" />
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100%;
  min-height: 100vh;
}

.sidebar {
  width: min(320px, 100%);
  padding: 1.25rem 1.25rem 1.5rem;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

:global(body.theme-paper) .sidebar {
  border-right-color: rgba(0, 0, 0, 0.08);
  background: #fafaf8;
}

.title {
  font-size: 1.15rem;
  font-weight: 650;
  margin: 0;
  letter-spacing: -0.02em;
}

.badge {
  display: inline-block;
  margin-left: 0.35rem;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.65;
  vertical-align: middle;
}

.muted {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  opacity: 0.78;
}

.field {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.35rem 0.5rem;
  align-items: center;
  font-size: 0.85rem;
}

.field label {
  grid-column: 1 / -1;
  font-weight: 500;
}

.field input[type="range"] {
  grid-column: 1;
  width: 100%;
}

.val {
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
  min-width: 2.5rem;
  text-align: right;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.btn {
  cursor: pointer;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: inherit;
  padding: 0.45rem 0.75rem;
  font-size: 0.85rem;
}

.btn.primary {
  border-color: rgba(100, 180, 255, 0.45);
  background: rgba(80, 140, 255, 0.15);
}

:global(body.theme-paper) .btn {
  border-color: rgba(0, 0, 0, 0.15);
}

:global(body.theme-paper) .btn.primary {
  border-color: rgba(30, 100, 200, 0.35);
  background: rgba(30, 100, 200, 0.08);
}

.footnote {
  margin-top: auto;
  font-size: 0.75rem;
}

.main {
  flex: 1;
  min-width: 0;
  padding: 1rem;
  display: flex;
  flex-direction: column;
}
</style>
