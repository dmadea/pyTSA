<script lang="ts">
  import type { AxisAlignment, AxisScale, FigureSettings } from "@pytsa/tsgraph2";

  let {
    open,
    settings,
    onClose,
    onChange,
  }: {
    open: boolean;
    settings: FigureSettings;
    onClose: () => void;
    onChange?: () => void;
  } = $props();

  const axisScales: AxisScale[] = [
    "Linear",
    "Logarithmic",
    "Symmetric logarithmic",
    "Data bound",
  ];

  const axisAlignments: AxisAlignment[] = ["Horizontal", "Vertical"];

  function onBackdropDown(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains("backdrop")) onClose();
  }

  // Call back into the plot immediately whenever any setting changes.
  $effect(() => {
    if (!open) return;
    if (!settings) return;
    // Touch all reactive fields used by the settings UI so this effect reruns.
    settings.title;
    settings.axisAlignment;
    settings.showDraggableLines;

    settings.xAxis.label;
    settings.yAxis.label;
    settings.xAxis.scale;
    settings.yAxis.scale;
    settings.xAxis.symlogLinthresh;
    settings.yAxis.symlogLinthresh;
    settings.xAxis.symlogLinscale;
    settings.yAxis.symlogLinscale;
    settings.xAxis.inverted;
    settings.yAxis.inverted;
    settings.xAxis.autoscale;
    settings.yAxis.autoscale;
    settings.xAxis.keepCentered;
    settings.yAxis.keepCentered;

    onChange?.();
  });
</script>

{#if open}
  <div class="backdrop" role="presentation" onmousedown={onBackdropDown}>
    <div
      class="panel card"
      role="dialog"
      aria-labelledby="plot-settings-title"
      tabindex="0"
      onmousedown={(e) => e.stopPropagation()}
    >
      <div class="card-body">
        <div class="header">
          <h2 id="plot-settings-title" class="title">
            Settings{#if settings?.title}<span class="title-figure">
                — {settings.title}</span
              >{/if}
          </h2>
          <button type="button" class="icon-btn" aria-label="Close" onclick={onClose}>
            ×
          </button>
        </div>
        <hr />

        <label class="row">
          <span class="label">Title</span>
          <input bind:value={settings.title} type="text" class="input" />
        </label>

        <label class="row">
          <span class="label">Axis alignment</span>
          <select bind:value={settings.axisAlignment} class="select">
            {#each axisAlignments as o (o)}
              <option value={o}>{o}</option>
            {/each}
          </select>
        </label>

        <div class="row check-row-inline">
          <span class="label">Draggable crosshair</span>
          <label class="check toggle">
            <input bind:checked={settings.showDraggableLines} type="checkbox" />
          </label>
        </div>

        <div class="axis-cols">
          <span></span>
          <span class="col-h">X axis</span>
          <span class="col-h">Y axis</span>
        </div>

        <label class="row grid-2">
          <span class="label">Axis label</span>
          <input bind:value={settings.xAxis.label} type="text" class="input" />
          <input bind:value={settings.yAxis.label} type="text" class="input" />
        </label>

        <label class="row grid-2">
          <span class="label">Axis scale</span>
          <select bind:value={settings.xAxis.scale} class="select">
            {#each axisScales as s (s)}
              <option value={s}>{s}</option>
            {/each}
          </select>
          <select bind:value={settings.yAxis.scale} class="select">
            {#each axisScales as s (s)}
              <option value={s}>{s}</option>
            {/each}
          </select>
        </label>

        <label class="row grid-2">
          <span class="label">Linthresh</span>
          <input
            bind:value={settings.xAxis.symlogLinthresh}
            type="number"
            step="any"
            class="input"
            disabled={settings.xAxis.scale !== "Symmetric logarithmic"}
          />
          <input
            bind:value={settings.yAxis.symlogLinthresh}
            type="number"
            step="any"
            class="input"
            disabled={settings.yAxis.scale !== "Symmetric logarithmic"}
          />
        </label>

        <label class="row grid-2">
          <span class="label">Linscale</span>
          <input
            bind:value={settings.xAxis.symlogLinscale}
            type="number"
            step="any"
            class="input"
            disabled={settings.xAxis.scale !== "Symmetric logarithmic"}
          />
          <input
            bind:value={settings.yAxis.symlogLinscale}
            type="number"
            step="any"
            class="input"
            disabled={settings.yAxis.scale !== "Symmetric logarithmic"}
          />
        </label>

        <div class="row grid-2 check-row">
          <span class="label">Inverted</span>
          <label class="check">
            <input bind:checked={settings.xAxis.inverted} type="checkbox" />
          </label>
          <label class="check">
            <input bind:checked={settings.yAxis.inverted} type="checkbox" />
          </label>
        </div>

        <div class="row grid-2 check-row">
          <span class="label">Autoscale</span>
          <label class="check">
            <input bind:checked={settings.xAxis.autoscale} type="checkbox" />
          </label>
          <label class="check">
            <input bind:checked={settings.yAxis.autoscale} type="checkbox" />
          </label>
        </div>

        <div class="row grid-2 check-row">
          <span class="label">Keep centered (0)</span>
          <label class="check">
            <input bind:checked={settings.xAxis.keepCentered} type="checkbox" />
          </label>
          <label class="check">
            <input bind:checked={settings.yAxis.keepCentered} type="checkbox" />
          </label>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
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

