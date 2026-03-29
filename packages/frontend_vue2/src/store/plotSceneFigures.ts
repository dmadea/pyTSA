import { reactive } from "vue";
import {
  createDefaultFigureSettings,
  type FigureSettings,
} from "@pytsa/tsgraph2";

/** One logical subplot: settings for a Scene {@link Figure} plus grid placement. */
export interface PlotFigureSlot {
  id: string;
  /** Reactive; same object must be passed to `Scene.addFigure({ settings })`. */
  settings: FigureSettings;
  row: number;
  col: number;
  colspan?: number;
  rowspan?: number;
  /** Demo data only — replace with real series binding later. */
  demoSeries?: "sine" | "cosine";
}

let idSeq = 0;
function newId(): string {
  return `fig-${++idSeq}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makePlotFigureSlot(
  partial?: Partial<Omit<PlotFigureSlot, "id" | "settings">> & {
    id?: string;
  },
): PlotFigureSlot {
  const settings = reactive(createDefaultFigureSettings());
  return {
    id: partial?.id ?? newId(),
    settings,
    row: partial?.row ?? 1,
    col: partial?.col ?? 1,
    colspan: partial?.colspan ?? 1,
    rowspan: partial?.rowspan ?? 1,
    demoSeries: partial?.demoSeries,
  };
}

/**
 * Ordered list of figures in the shared Scene. Mutate (push/splice) to add or
 * remove plots; keep `row`/`col` in sync with `Scene` grid or call layout helpers.
 */
export const plotFigures = reactive<PlotFigureSlot[]>([
  makePlotFigureSlot({ row: 1, col: 1, demoSeries: "sine" }),
  makePlotFigureSlot({ row: 2, col: 1, demoSeries: "cosine" }),
]);

/** Append a subplot (default: next row in a single-column stack). */
export function addPlotFigure(
  partial?: Partial<Omit<PlotFigureSlot, "id" | "settings">>,
): PlotFigureSlot {
  const nextRow =
    partial?.row ??
    (plotFigures.length === 0
      ? 1
      : Math.max(...plotFigures.map((s) => s.row)) + 1);
  const slot = makePlotFigureSlot({
    row: nextRow,
    col: partial?.col ?? 1,
    colspan: partial?.colspan,
    rowspan: partial?.rowspan,
    demoSeries: partial?.demoSeries,
  });
  plotFigures.push(slot);
  return slot;
}

export function removePlotFigure(id: string): void {
  const i = plotFigures.findIndex((s) => s.id === id);
  if (i >= 0) plotFigures.splice(i, 1);
}

/** Snapshot used to detect grid membership / identity changes (triggers Scene rebuild). */
export function plotFiguresStructureKey(figs: PlotFigureSlot[]): string {
  return figs
    .map(
      (s) =>
        `${s.id}:${s.row}:${s.col}:${s.colspan ?? 1}:${s.rowspan ?? 1}`,
    )
    .join("|");
}
