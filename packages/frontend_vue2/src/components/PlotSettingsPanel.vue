<script setup lang="ts">
import type { AxisAlignment, AxisScale, FigureSettings } from "@pytsa/tsgraph2";

defineProps<{
  open: boolean;
  /** Reactive figure settings object to edit (same reference as the Figure uses). */
  settings: FigureSettings;
}>();

const emit = defineEmits<{
  close: [];
}>();

const axisScales: AxisScale[] = [
  "Linear",
  "Logarithmic",
  "Symmetric logarithmic",
  "Data bound",
];

const axisOrientations: AxisAlignment[] = ["Horizontal", "Vertical"];

function onBackdrop(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains("backdrop")) emit("close");
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="backdrop"
      role="presentation"
      @mousedown="onBackdrop"
    >
      <div
        class="panel card"
        role="dialog"
        aria-labelledby="plot-settings-title"
        @mousedown.stop
      >
        <div class="card-body">
          <div class="header">
            <h2 id="plot-settings-title" class="title">
              Settings
              <span v-if="settings.title" class="title-figure"> — {{ settings.title }}</span>
            </h2>
            <button type="button" class="icon-btn" aria-label="Close" @click="emit('close')">
              ×
            </button>
          </div>
          <hr />

          <label class="row">
            <span class="label">Title</span>
            <input v-model="settings.title" type="text" class="input" />
          </label>

          <label class="row">
            <span class="label">Axis alignment</span>
            <select v-model="settings.axisAlignment" class="select">
              <option v-for="o in axisOrientations" :key="o" :value="o">
                {{ o }}
              </option>
            </select>
          </label>

          <div class="row check-row-inline">
            <span class="label">Draggable crosshair</span>
            <label class="check toggle">
              <input v-model="settings.showDraggableLines" type="checkbox" />
            </label>
          </div>

          <div class="axis-cols">
            <span />
            <span class="col-h">X axis</span>
            <span class="col-h">Y axis</span>
          </div>

          <label class="row grid-2">
            <span class="label">Axis label</span>
            <input v-model="settings.xAxis.label" type="text" class="input" />
            <input v-model="settings.yAxis.label" type="text" class="input" />
          </label>

          <label class="row grid-2">
            <span class="label">Axis scale</span>
            <select v-model="settings.xAxis.scale" class="select">
              <option v-for="s in axisScales" :key="'x' + s" :value="s">{{ s }}</option>
            </select>
            <select v-model="settings.yAxis.scale" class="select">
              <option v-for="s in axisScales" :key="'y' + s" :value="s">{{ s }}</option>
            </select>
          </label>

          <label class="row grid-2">
            <span class="label">Linthresh</span>
            <input
              v-model.number="settings.xAxis.symlogLinthresh"
              type="number"
              step="any"
              class="input"
              :disabled="settings.xAxis.scale !== 'Symmetric logarithmic'"
            />
            <input
              v-model.number="settings.yAxis.symlogLinthresh"
              type="number"
              step="any"
              class="input"
              :disabled="settings.yAxis.scale !== 'Symmetric logarithmic'"
            />
          </label>

          <label class="row grid-2">
            <span class="label">Linscale</span>
            <input
              v-model.number="settings.xAxis.symlogLinscale"
              type="number"
              step="any"
              class="input"
              :disabled="settings.xAxis.scale !== 'Symmetric logarithmic'"
            />
            <input
              v-model.number="settings.yAxis.symlogLinscale"
              type="number"
              step="any"
              class="input"
              :disabled="settings.yAxis.scale !== 'Symmetric logarithmic'"
            />
          </label>

          <div class="row grid-2 check-row">
            <span class="label">Inverted</span>
            <label class="check"><input v-model="settings.xAxis.inverted" type="checkbox" /></label>
            <label class="check"><input v-model="settings.yAxis.inverted" type="checkbox" /></label>
          </div>

          <div class="row grid-2 check-row">
            <span class="label">Autoscale</span>
            <label class="check"><input v-model="settings.xAxis.autoscale" type="checkbox" /></label>
            <label class="check"><input v-model="settings.yAxis.autoscale" type="checkbox" /></label>
          </div>

          <div class="row grid-2 check-row">
            <span class="label">Keep centered (0)</span>
            <label class="check"><input v-model="settings.xAxis.keepCentered" type="checkbox" /></label>
            <label class="check"><input v-model="settings.yAxis.keepCentered" type="checkbox" /></label>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 2rem 1rem;
}

.panel {
  width: min(420px, 100%);
  max-height: calc(100vh - 4rem);
  overflow: auto;
  border-radius: 10px;
  background: #1a1d24;
  color: #e8e8ec;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

:global(body.theme-paper) .panel {
  background: #fff;
  color: #1a1a1a;
  border-color: rgba(0, 0, 0, 0.12);
}

.card-body {
  padding: 0.75rem 1rem 1rem;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.title {
  margin: 0;
  font-size: 1rem;
  font-weight: 650;
}

.title-figure {
  font-weight: 500;
  opacity: 0.72;
}

.icon-btn {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0.75;
  padding: 0 0.25rem;
}

.icon-btn:hover {
  opacity: 1;
}

hr {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  margin: 0.5rem 0 0.75rem;
}

:global(body.theme-paper) hr {
  border-top-color: rgba(0, 0, 0, 0.1);
}

.row {
  display: grid;
  grid-template-columns: 7.5rem 1fr;
  gap: 0.35rem 0.5rem;
  align-items: center;
  margin-bottom: 0.45rem;
  font-size: 0.8rem;
}

.row.grid-2 {
  grid-template-columns: 7.5rem 1fr 1fr;
}

.label {
  font-weight: 500;
  opacity: 0.9;
}

.input,
.select {
  width: 100%;
  padding: 0.2rem 0.4rem;
  font-size: 0.78rem;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.2);
  color: inherit;
}

:global(body.theme-paper) .input,
:global(body.theme-paper) .select {
  border-color: rgba(0, 0, 0, 0.2);
  background: #fff;
}

.input:disabled {
  opacity: 0.45;
}

.axis-cols {
  display: grid;
  grid-template-columns: 7.5rem 1fr 1fr;
  gap: 0.5rem;
  margin: 0.5rem 0 0.15rem;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.65;
  text-align: center;
}

.col-h {
  text-align: center;
}

.check-row .check {
  display: flex;
  justify-content: center;
  align-items: center;
}

.check input {
  width: 1rem;
  height: 1rem;
}

.check-row-inline {
  grid-template-columns: 7.5rem auto;
}

.check.toggle {
  justify-content: flex-start;
}
</style>
