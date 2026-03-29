import type { Margin } from "../types.js";
import type { AxisAlignment, AxisSettings } from "./axisTransforms.js";
import { defaultAxisSettings } from "./axisTransforms.js";

export interface FigureSettings {
  title: string;
  axisAlignment: AxisAlignment;
  xAxis: AxisSettings;
  yAxis: AxisSettings;
  showDraggableLines: boolean;
}

export function createDefaultFigureSettings(): FigureSettings {
  return {
    title: "",
    axisAlignment: "Horizontal",
    xAxis: defaultAxisSettings(""),
    yAxis: defaultAxisSettings(""),
    showDraggableLines: true,
  };
}

export const DEFAULT_FIGURE_MARGIN: Margin = {
  left: 56,
  right: 14,
  top: 36,
  bottom: 44,
};

/** WebGL clear outside plot (shared canvas). */
export const GL_MARGIN_BG: [number, number, number, number] = [
  0.04, 0.045, 0.055, 1,
];
/** WebGL clear inside plot. */
export const GL_PLOT_BG: [number, number, number, number] = [
  0.07, 0.08, 0.1, 1,
];
