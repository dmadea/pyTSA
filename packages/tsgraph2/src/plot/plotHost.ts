import type { Margin, Point } from "../types.js";
import { Scene, type Figure } from "./scene.js";
import {
  createDefaultFigureSettings,
  type FigureSettings,
} from "./figureTypes.js";

export type { FigureSettings };
export { createDefaultFigureSettings };

export interface PlotHostOptions {
  margins?: Partial<Margin>;
  /** Shared settings object (mutate from UI); if omitted, an internal default is used. */
  settings?: FigureSettings;
  /** Fired when the draggable crosshair moves (values in real data space). */
  onCrosshairChange?: (real: Point) => void;
}

/**
 * One full-size figure backed by {@link Scene} (shared WebGL canvas + grid cell).
 * For multiple plots, use {@link Scene} and {@link Figure} directly.
 */
export class PlotHost {
  private readonly scene: Scene;
  private readonly figure: Figure;

  readonly canvas: HTMLCanvasElement;
  readonly svg: SVGSVGElement;

  constructor(container: HTMLElement, options?: PlotHostOptions) {
    this.scene = new Scene(container);
    this.figure = this.scene.addFigure({
      margins: options?.margins,
      settings: options?.settings ?? createDefaultFigureSettings(),
      onCrosshairChange: options?.onCrosshairChange,
    });
    this.canvas = this.scene.canvas;
    this.svg = this.figure.svg;
  }

  get settings(): FigureSettings {
    return this.figure.settings;
  }

  setLineData(x: Float32Array, y: Float32Array): void {
    this.figure.setLineData(x, y);
  }

  resetView(): void {
    this.figure.resetView();
  }

  getCrosshairReal(): Point {
    return this.figure.getCrosshairReal();
  }

  notifySettingsChanged(): void {
    this.figure.notifySettingsChanged();
  }

  redraw(): void {
    this.scene.redraw();
  }

  dispose(): void {
    this.scene.dispose();
  }
}
