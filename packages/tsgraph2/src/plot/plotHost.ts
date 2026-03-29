import type { Margin, Point, Rect } from "../types.js";
import {
  axisForward,
  axisInverse,
  defaultAxisSettings,
  type AxisAlignment,
  type AxisSettings,
} from "./axisTransforms.js";
import {
  formatTickLabel,
  niceTicks,
  renderSvgAxesGroup,
  type SvgAxesModel,
} from "./svgAxes.js";
import { WebglLinePlot } from "./webglLine.js";

export interface PlotHostOptions {
  margins?: Partial<Margin>;
  /** Shared settings object (mutate from UI); if omitted, an internal default is used. */
  settings?: FigureSettings;
}

export interface FigureSettings {
  title: string;
  axisAlignment: AxisAlignment;
  xAxis: AxisSettings;
  yAxis: AxisSettings;
}

export function createDefaultFigureSettings(): FigureSettings {
  return {
    title: "",
    axisAlignment: "Horizontal",
    xAxis: defaultAxisSettings(""),
    yAxis: defaultAxisSettings(""),
  };
}

const DEFAULT_MARGIN: Margin = { left: 56, right: 14, top: 36, bottom: 44 };
const MIN_SPAN = 1e-12;

/**
 * WebGL line + SVG axes; pan (left drag), zoom (right drag), wheel zoom.
 * View rectangle is in axis **dummy** space (see frontend_svelte Axis transforms).
 */
export class PlotHost {
  readonly canvas: HTMLCanvasElement;
  readonly svg: SVGSVGElement;
  readonly settings: FigureSettings;
  private readonly container: HTMLElement;
  private readonly inner: HTMLDivElement;
  private readonly axesGroup: SVGGElement;
  private readonly hitRect: SVGRectElement;
  private readonly margins: Margin;
  private readonly ro: ResizeObserver;
  private readonly webgl: WebglLinePlot;
  private widthCss = 0;
  private heightCss = 0;
  private dpr = 1;
  private plotRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private xData = new Float32Array(0);
  private yData = new Float32Array(0);
  /** Dummy-space view: x,y = min corners, w,h = spans. */
  private internalRange: Rect = { x: 0, y: 0, w: 1, h: 1 };

  private panning = false;
  private scaling = false;
  private lastClient = { x: 0, y: 0 };
  private lastSvg = { x: 0, y: 0 };
  private lastRange = { ...this.internalRange };
  private lastCenterDummy = { x: 0, y: 0 };
  private cursor: "crosshair" | "grabbing" | "zoom-in" = "crosshair";

  constructor(container: HTMLElement, options?: PlotHostOptions) {
    this.container = container;
    this.margins = { ...DEFAULT_MARGIN, ...options?.margins };
    this.settings = options?.settings ?? createDefaultFigureSettings();

    container.style.position = container.style.position || "relative";
    container.style.overflow = "hidden";

    this.inner = document.createElement("div");
    this.inner.style.cssText =
      "position:absolute;inset:0;display:block;pointer-events:none;";
    container.appendChild(this.inner);

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText =
      "position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none;";
    this.inner.appendChild(this.canvas);

    this.svg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    this.svg.style.cssText =
      "position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:auto;";
    this.inner.appendChild(this.svg);

    this.axesGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    this.axesGroup.setAttribute("class", "tg-axes");
    this.svg.appendChild(this.axesGroup);

    this.hitRect = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    this.hitRect.setAttribute("fill", "transparent");
    this.hitRect.setAttribute("class", "tg-hit");
    this.svg.appendChild(this.hitRect);

    this.webgl = new WebglLinePlot(this.canvas);
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(container);

    this.bindInteraction();
    this.layout();
  }

  setLineData(x: Float32Array, y: Float32Array): void {
    if (x.length !== y.length) {
      throw new RangeError("x and y length mismatch");
    }
    this.xData = x;
    this.yData = y;
    if (this.settings.xAxis.autoscale || this.settings.yAxis.autoscale) {
      this.autoscaleFromData();
    }
    this.redraw();
  }

  /** Fit axes to current series (respects per-axis autoscale flags). */
  resetView(): void {
    const prevX = this.settings.xAxis.autoscale;
    const prevY = this.settings.yAxis.autoscale;
    this.settings.xAxis.autoscale = true;
    this.settings.yAxis.autoscale = true;
    this.autoscaleFromData();
    this.settings.xAxis.autoscale = prevX;
    this.settings.yAxis.autoscale = prevY;
    this.redraw();
  }

  private xScaleArr(): Float32Array | null {
    return this.settings.xAxis.scale === "Data bound" ? this.xData : null;
  }

  private yScaleArr(): Float32Array | null {
    return this.settings.yAxis.scale === "Data bound" ? this.yData : null;
  }

  private invX(): (v: number) => number {
    const a = this.settings.xAxis;
    return axisInverse(
      a.scale,
      a.symlogLinthresh,
      a.symlogLinscale,
      this.xScaleArr()
    );
  }

  private invY(): (v: number) => number {
    const a = this.settings.yAxis;
    return axisInverse(
      a.scale,
      a.symlogLinthresh,
      a.symlogLinscale,
      this.yScaleArr()
    );
  }

  private fwdX(): (v: number) => number {
    const a = this.settings.xAxis;
    return axisForward(
      a.scale,
      a.symlogLinthresh,
      a.symlogLinscale,
      this.xScaleArr()
    );
  }

  private fwdY(): (v: number) => number {
    const a = this.settings.yAxis;
    return axisForward(
      a.scale,
      a.symlogLinthresh,
      a.symlogLinscale,
      this.yScaleArr()
    );
  }

  private autoscaleFromData(): void {
    const n = this.xData.length;
    if (n === 0) return;
    const ix = this.invX();
    const iy = this.invY();
    let dx0 = Infinity;
    let dx1 = -Infinity;
    let dy0 = Infinity;
    let dy1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const xd = ix(this.xData[i]!);
      const yd = iy(this.yData[i]!);
      if (xd < dx0) dx0 = xd;
      if (xd > dx1) dx1 = xd;
      if (yd < dy0) dy0 = yd;
      if (yd > dy1) dy1 = yd;
    }
    const pad = 0.05;
    const expand = (a0: number, a1: number) => {
      const sp = Math.abs(a1 - a0) < MIN_SPAN ? 1 : a1 - a0;
      const p = sp * pad;
      return { lo: a0 - p, hi: a1 + p };
    };
    if (this.settings.xAxis.autoscale) {
      const e = expand(dx0, dx1);
      this.internalRange.x = e.lo;
      this.internalRange.w = Math.max(MIN_SPAN, e.hi - e.lo);
    }
    if (this.settings.yAxis.autoscale) {
      const e = expand(dy0, dy1);
      this.internalRange.y = e.lo;
      this.internalRange.h = Math.max(MIN_SPAN, e.hi - e.lo);
    }
  }

  private layout(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.widthCss = Math.max(1, w);
    this.heightCss = Math.max(1, h);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);

    const m = this.margins;
    this.plotRect = {
      x: m.left,
      y: m.top,
      w: Math.max(1, this.widthCss - m.left - m.right),
      h: Math.max(1, this.heightCss - m.top - m.bottom),
    };

    const bw = Math.floor(this.widthCss * this.dpr);
    const bh = Math.floor(this.heightCss * this.dpr);
    this.canvas.width = bw;
    this.canvas.height = bh;

    this.svg.setAttribute("width", String(this.widthCss));
    this.svg.setAttribute("height", String(this.heightCss));
    this.svg.setAttribute("viewBox", `0 0 ${this.widthCss} ${this.heightCss}`);

    this.syncHitRect();
    this.redraw();
  }

  private syncHitRect(): void {
    const r = this.plotRect;
    this.hitRect.setAttribute("x", String(r.x));
    this.hitRect.setAttribute("y", String(r.y));
    this.hitRect.setAttribute("width", String(r.w));
    this.hitRect.setAttribute("height", String(r.h));
    this.hitRect.style.cursor = this.cursor;
  }

  private clientToSvg(clientX: number, clientY: number): Point {
    const p = this.svg.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const t = p.matrixTransform(invertCtm(ctm));
    return { x: t.x, y: t.y };
  }

  private mapSvgToDummy(p: Point): Point {
    const r = this.plotRect;
    const va = this.settings.axisAlignment === "Vertical";
    const { xAxis, yAxis } = this.settings;
    let xrel = (p.x - r.x) / r.w;
    let yrel = (p.y - r.y) / r.h;
    if (va) {
      xrel = yAxis.inverted ? xrel : 1 - xrel;
      yrel = xAxis.inverted ? yrel : 1 - yrel;
      return {
        x: this.internalRange.x + yrel * this.internalRange.w,
        y: this.internalRange.y + xrel * this.internalRange.h,
      };
    }
    xrel = xAxis.inverted ? 1 - xrel : xrel;
    yrel = yAxis.inverted ? yrel : 1 - yrel;
    return {
      x: this.internalRange.x + xrel * this.internalRange.w,
      y: this.internalRange.y + yrel * this.internalRange.h,
    };
  }

  private mapDummyToSvg(d: Point): Point {
    const r = this.plotRect;
    const va = this.settings.axisAlignment === "Vertical";
    const { xAxis, yAxis } = this.settings;
    let xrel = (d.x - this.internalRange.x) / (this.internalRange.w || MIN_SPAN);
    let yrel = (d.y - this.internalRange.y) / (this.internalRange.h || MIN_SPAN);
    xrel = xAxis.inverted ? 1 - xrel : xrel;
    yrel = yAxis.inverted ? yrel : 1 - yrel;
    if (va) {
      return {
        x: r.x + yrel * r.w,
        y: r.y + (1 - xrel) * r.h,
      };
    }
    return {
      x: r.x + xrel * r.w,
      y: r.y + yrel * r.h,
    };
  }

  private bindInteraction(): void {
    this.hitRect.addEventListener("mousedown", (e) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      this.scaling = e.button === 2;
      this.panning = e.button === 0 || e.button === 1;
      this.lastClient = { x: e.clientX, y: e.clientY };
      this.lastSvg = this.clientToSvg(e.clientX, e.clientY);
      this.lastRange = { ...this.internalRange };
      this.lastCenterDummy = this.mapSvgToDummy(this.lastSvg);

      if (this.panning) this.cursor = "grabbing";
      else if (this.scaling) this.cursor = "zoom-in";
      this.syncHitRect();

      if (!this.panning && !this.scaling) return;

      const onMove = (ev: MouseEvent) => {
        const distClient = {
          x: ev.clientX - this.lastClient.x,
          y: ev.clientY - this.lastClient.y,
        };
        let dist = { ...distClient };
        const va = this.settings.axisAlignment === "Vertical";
        if (va) {
          dist = { x: dist.y, y: dist.x };
        }

        const pr = this.plotRect;
        const { xAxis, yAxis } = this.settings;

        if (this.panning) {
          const xRatio = this.lastRange.w / pr.w;
          const yRatio = this.lastRange.h / pr.h;
          let xSign = xAxis.inverted ? 1 : -1;
          const ySign = yAxis.inverted ? -1 : 1;
          let dx = xSign * dist.x * xRatio;
          let dy = ySign * dist.y * yRatio;
          if (xAxis.keepCentered) dx = 0;
          if (yAxis.keepCentered) dy = 0;
          this.internalRange = {
            x: this.lastRange.x + dx,
            y: this.lastRange.y + dy,
            w: this.lastRange.w,
            h: this.lastRange.h,
          };
        }

        if (this.scaling) {
          let xZoom = 1.01 ** dist.x;
          let yZoom = 1.01 ** dist.y;
          if (va) {
            xZoom = 1 / xZoom;
            yZoom = 1 / yZoom;
          }
          let newRect: Rect = {
            x:
              this.lastCenterDummy.x -
              (this.lastCenterDummy.x - this.lastRange.x) / xZoom,
            y:
              this.lastCenterDummy.y -
              (this.lastCenterDummy.y - this.lastRange.y) * yZoom,
            w: this.lastRange.w / xZoom,
            h: this.lastRange.h * yZoom,
          };
          if (xAxis.keepCentered) {
            const extreme = Math.max(
              Math.abs(this.lastRange.x),
              Math.abs(this.lastRange.x + this.lastRange.w)
            );
            newRect.x = -extreme / xZoom;
            newRect.w = -2 * newRect.x;
          }
          if (yAxis.keepCentered) {
            // Match non–keep-centered Y: there h *= yZoom (not /= like X). Using the same
            // “multiply by yZoom” convention here keeps zoom direction consistent.
            const extreme = Math.max(
              Math.abs(this.lastRange.y),
              Math.abs(this.lastRange.y + this.lastRange.h)
            );
            newRect.h = 2 * extreme * yZoom;
            newRect.y = -extreme * yZoom;
          }
          newRect.w = Math.max(MIN_SPAN, newRect.w);
          newRect.h = Math.max(MIN_SPAN, newRect.h);
          this.internalRange = newRect;
        }

        this.redraw();
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        this.panning = false;
        this.scaling = false;
        this.cursor = "crosshair";
        this.syncHitRect();
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });

    this.hitRect.addEventListener("contextmenu", (e) => {
      if (!e.ctrlKey) e.preventDefault();
    });

    this.hitRect.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const z = Math.exp(-e.deltaY * 0.002);
        const svgPt = this.clientToSvg(e.clientX, e.clientY);
        const c = this.mapSvgToDummy(svgPt);
        const lr = this.internalRange;
        const xZoom = z;
        const yZoom = z;
        let newRect: Rect = {
          x: c.x - (c.x - lr.x) / xZoom,
          y: c.y - (c.y - lr.y) / yZoom,
          w: lr.w / xZoom,
          h: lr.h / yZoom,
        };
        if (this.settings.xAxis.keepCentered) {
          const extreme = Math.max(
            Math.abs(lr.x),
            Math.abs(lr.x + lr.w)
          );
          newRect.x = -extreme / xZoom;
          newRect.w = -2 * newRect.x;
        }
        if (this.settings.yAxis.keepCentered) {
          const extreme = Math.max(
            Math.abs(lr.y),
            Math.abs(lr.y + lr.h)
          );
          newRect.y = -extreme / yZoom;
          newRect.h = -2 * newRect.y;
        }
        newRect.w = Math.max(MIN_SPAN, newRect.w);
        newRect.h = Math.max(MIN_SPAN, newRect.h);
        this.internalRange = newRect;
        this.redraw();
      },
      { passive: false }
    );

    this.hitRect.addEventListener("dblclick", () => {
      this.resetView();
    });
  }

  /** Call after UI changes settings (autoscale, scale mode, labels, …). */
  notifySettingsChanged(): void {
    this.autoscaleFromData();
    this.redraw();
  }

  redraw(): void {
    const glCanvas = this.canvas;
    const gl = glCanvas.getContext("webgl");
    if (!gl) return;
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    this.webgl.clear(0.07, 0.08, 0.1, 1);

    const n = this.xData.length;
    if (n >= 2) {
      const ix = this.invX();
      const iy = this.invY();
      const xy = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const d: Point = { x: ix(this.xData[i]!), y: iy(this.yData[i]!) };
        const sp = this.mapDummyToSvg(d);
        const nx = (sp.x / this.widthCss) * 2 - 1;
        const ny = 1 - (sp.y / this.heightCss) * 2;
        xy[i * 2] = nx;
        xy[i * 2 + 1] = ny;
      }
      this.webgl.setLineStrip(xy, n);
      this.webgl.drawLineStrip(2);
    }

    const fx = this.fwdX();
    const fy = this.fwdY();
    const xr0 = this.internalRange.x;
    const xr1 = this.internalRange.x + this.internalRange.w;
    const yr0 = this.internalRange.y;
    const yr1 = this.internalRange.y + this.internalRange.h;

    const xTicksDummy = niceTicks(xr0, xr1, 6);
    const yTicksDummy = niceTicks(yr0, yr1, 6);

    const xTicks = xTicksDummy.map((td) => {
      const real = fx(td);
      const sp = this.mapDummyToSvg({ x: td, y: yr0 });
      return { px: sp.x, label: formatTickLabel(real) };
    });

    const yTicks = yTicksDummy.map((td) => {
      const real = fy(td);
      const sp = this.mapDummyToSvg({ x: xr0, y: td });
      return { px: sp.y, label: formatTickLabel(real) };
    });

    const model: SvgAxesModel = {
      width: this.widthCss,
      height: this.heightCss,
      plot: this.plotRect,
      margins: this.margins,
      xTicks,
      yTicks,
      xLabel: this.settings.xAxis.label || undefined,
      yLabel: this.settings.yAxis.label || undefined,
      title: this.settings.title || undefined,
    };
    renderSvgAxesGroup(this.axesGroup, model);
    this.syncHitRect();
  }

  dispose(): void {
    this.ro.disconnect();
    this.webgl.dispose();
    this.inner.remove();
  }
}

function invertCtm(m: DOMMatrix): DOMMatrix {
  return m.inverse();
}
