import type { Margin, Point, Rect } from "../types.js";
import { axisForward, axisInverse } from "./axisTransforms.js";
import {
  formatTickLabel,
  niceTicks,
  renderSvgAxesGroup,
  type SvgAxesModel,
} from "./svgAxes.js";
import { WebglLinePlot } from "./webglLine.js";
import { DraggableCrosshair } from "./draggableCrosshair.js";
import {
  clampScissorToFramebuffer,
  plotRectToGlScissor,
} from "./glPlotClip.js";
import {
  createDefaultFigureSettings,
  DEFAULT_FIGURE_MARGIN,
  GL_MARGIN_BG,
  GL_PLOT_BG,
  type FigureSettings,
} from "./figureTypes.js";

export interface FigureOptions {
  margins?: Partial<Margin>;
  settings?: FigureSettings;
  onCrosshairChange?: (real: Point) => void;
}

export interface FigureGridPlacement {
  /** 1-based grid row start (CSS `grid-row-start`). */
  row?: number;
  col?: number;
  colspan?: number;
  rowspan?: number;
}

export interface SceneOptions {
  templateRows?: string;
  templateCols?: string;
  columnGap?: string;
  rowGap?: string;
}

const MIN_SPAN = 1e-12;

// ——— Figure (one cell: SVG overlay + shared WebGL draw pass) ———

export class Figure {
  readonly svg: SVGSVGElement;
  readonly settings: FigureSettings;
  private readonly scene: Scene;
  readonly slot: HTMLElement;
  private readonly axesGroup: SVGGElement;
  private readonly hitRect: SVGRectElement;
  private readonly margins: Margin;
  private widthCss = 1;
  private heightCss = 1;
  private plotRect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private xData = new Float32Array(0);
  private yData = new Float32Array(0);
  private internalRange: Rect = { x: 0, y: 0, w: 1, h: 1 };

  private panning = false;
  private scaling = false;
  private lastClient = { x: 0, y: 0 };
  private lastSvg = { x: 0, y: 0 };
  private lastRange = { ...this.internalRange };
  private lastCenterDummy = { x: 0, y: 0 };
  private cursor: "crosshair" | "grabbing" | "zoom-in" = "crosshair";

  private crosshair: DraggableCrosshair | null = null;
  private crosshairDummy: Point = { x: 0.5, y: 0.5 };
  private crosshairInitialized = false;
  private readonly onCrosshairCb?: (real: Point) => void;

  constructor(
    scene: Scene,
    slot: HTMLElement,
    options?: FigureOptions
  ) {
    this.scene = scene;
    this.slot = slot;
    this.margins = { ...DEFAULT_FIGURE_MARGIN, ...options?.margins };
    this.settings = options?.settings ?? createDefaultFigureSettings();
    this.onCrosshairCb = options?.onCrosshairChange;

    slot.style.position = "relative";
    slot.style.minWidth = "0";
    slot.style.minHeight = "0";
    slot.style.width = "100%";
    slot.style.height = "100%";
    slot.style.pointerEvents = "auto";

    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.style.cssText =
      "position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:auto;";

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

    slot.appendChild(this.svg);
    this.bindInteraction();
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
    if (!this.crosshairInitialized) {
      this.centerCrosshairDummy();
      this.crosshairInitialized = true;
    } else {
      this.clampCrosshairIntoRange();
    }
    this.scene.scheduleRedraw();
    this.emitCrosshairReal();
  }

  resetView(): void {
    const prevX = this.settings.xAxis.autoscale;
    const prevY = this.settings.yAxis.autoscale;
    this.settings.xAxis.autoscale = true;
    this.settings.yAxis.autoscale = true;
    this.autoscaleFromData();
    this.settings.xAxis.autoscale = prevX;
    this.settings.yAxis.autoscale = prevY;
    this.centerCrosshairDummy();
    this.scene.scheduleRedraw();
    this.emitCrosshairReal();
  }

  getCrosshairReal(): Point {
    const d = this.crosshairDummy;
    return { x: this.fwdX()(d.x), y: this.fwdY()(d.y) };
  }

  notifySettingsChanged(): void {
    this.autoscaleFromData();
    this.clampCrosshairIntoRange();
    this.scene.scheduleRedraw();
    this.emitCrosshairReal();
  }

  /** Layout when the scene or cell size changes. */
  onSceneLayout(): void {
    const w = Math.max(1, this.slot.clientWidth);
    const h = Math.max(1, this.slot.clientHeight);
    this.widthCss = w;
    this.heightCss = h;
    const m = this.margins;
    this.plotRect = {
      x: m.left,
      y: m.top,
      w: Math.max(1, w - m.left - m.right),
      h: Math.max(1, h - m.top - m.bottom),
    };
    this.svg.setAttribute("width", String(w));
    this.svg.setAttribute("height", String(h));
    this.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    this.syncHitRect();
  }

  hasLineData(): boolean {
    return this.xData.length >= 2;
  }

  /** Plot rectangle in **canvas element client coordinates** (for scissor). */
  getPlotRectInCanvasCss(canvasRect: DOMRect): Rect {
    const fr = this.slot.getBoundingClientRect();
    const p = this.plotRect;
    return {
      x: fr.left - canvasRect.left + p.x,
      y: fr.top - canvasRect.top + p.y,
      w: p.w,
      h: p.h,
    };
  }

  uploadGlGeometry(
    webgl: WebglLinePlot,
    sceneCw: number,
    sceneCh: number,
    canvasRect: DOMRect
  ): void {
    const n = this.xData.length;
    if (n < 2) return;
    const fr = this.slot.getBoundingClientRect();
    const ix = this.invX();
    const iy = this.invY();
    const xy = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const d: Point = { x: ix(this.xData[i]!), y: iy(this.yData[i]!) };
      const sp = this.mapDummyToSvg(d);
      const cssX = fr.left - canvasRect.left + sp.x;
      const cssY = fr.top - canvasRect.top + sp.y;
      const nx = (cssX / sceneCw) * 2 - 1;
      const ny = 1 - (cssY / sceneCh) * 2;
      xy[i * 2] = nx;
      xy[i * 2 + 1] = ny;
    }
    webgl.setLineStrip(xy, n);
  }

  redrawSvg(): void {
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
    this.syncCrosshairOverlay();
  }

  dispose(): void {
    this.crosshair?.dispose();
    this.crosshair = null;
    this.scene.removeFigure(this);
    this.slot.remove();
  }

  private emitCrosshairReal(): void {
    if (!this.settings.showDraggableLines) return;
    this.onCrosshairCb?.(this.getCrosshairReal());
  }

  private centerCrosshairDummy(): void {
    const r = this.internalRange;
    this.crosshairDummy = {
      x: r.x + r.w / 2,
      y: r.y + r.h / 2,
    };
  }

  private clampCrosshairIntoRange(): void {
    const r = this.internalRange;
    this.crosshairDummy = {
      x: clamp(this.crosshairDummy.x, r.x, r.x + r.w),
      y: clamp(this.crosshairDummy.y, r.y, r.y + r.h),
    };
  }

  private syncCrosshairOverlay(): void {
    if (!this.settings.showDraggableLines) {
      this.crosshair?.dispose();
      this.crosshair = null;
      return;
    }
    if (!this.crosshair) {
      this.crosshair = new DraggableCrosshair(this.svg, {
        getPlotRect: () => this.plotRect,
        mapSvgToDummy: (p) => this.mapSvgToDummy(p),
        mapDummyToSvg: (p) => this.mapDummyToSvg(p),
        onChange: (d) => {
          this.crosshairDummy = d;
          this.emitCrosshairReal();
        },
      });
    }
    this.crosshair.setVisible(true);
    this.crosshair.paintFromDummy(this.crosshairDummy);
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
    const t = p.matrixTransform(ctm.inverse());
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
    let xrel =
      (d.x - this.internalRange.x) / (this.internalRange.w || MIN_SPAN);
    let yrel =
      (d.y - this.internalRange.y) / (this.internalRange.h || MIN_SPAN);
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

        this.scene.scheduleRedraw();
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
        this.scene.scheduleRedraw();
      },
      { passive: false }
    );

    this.hitRect.addEventListener("dblclick", () => {
      this.resetView();
    });
  }
}

// ——— Scene (shared WebGL canvas + CSS grid of figures) ———

export class Scene {
  readonly wrapper: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  readonly grid: HTMLDivElement;
  readonly webgl: WebglLinePlot;
  private readonly figures: Figure[] = [];
  private ro: ResizeObserver;
  clientWidth = 1;
  clientHeight = 1;
  dpr = 1;
  private raf: number | null = null;

  constructor(container: HTMLElement, options?: SceneOptions) {
    container.style.position = container.style.position || "relative";
    container.style.overflow = "hidden";

    this.wrapper = document.createElement("div");
    this.wrapper.style.cssText =
      "position:relative;width:100%;height:100%;min-height:200px;";

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText =
      "position:absolute;left:0;top:0;width:100%;height:100%;display:block;z-index:0;pointer-events:none;";

    this.grid = document.createElement("div");
    this.grid.className = "tg-scene-grid";
    this.grid.style.cssText = [
      "position:absolute",
      "inset:0",
      "z-index:2",
      "display:grid",
      "pointer-events:none",
      `grid-template-rows:${options?.templateRows ?? "1fr"}`,
      `grid-template-columns:${options?.templateCols ?? "1fr"}`,
      `column-gap:${options?.columnGap ?? "6px"}`,
      `row-gap:${options?.rowGap ?? "6px"}`,
      "box-sizing:border-box",
    ].join(";");

    this.wrapper.appendChild(this.canvas);
    this.wrapper.appendChild(this.grid);
    container.appendChild(this.wrapper);

    this.webgl = new WebglLinePlot(this.canvas);
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.wrapper);
    this.layout();
  }

  addFigure(
    options?: FigureOptions & FigureGridPlacement
  ): Figure {
    const slot = document.createElement("div");
    const row = options?.row ?? 1;
    const col = options?.col ?? 1;
    const colspan = options?.colspan ?? 1;
    const rowspan = options?.rowspan ?? 1;
    slot.style.gridRowStart = String(row);
    slot.style.gridColumnStart = String(col);
    slot.style.gridRowEnd = `span ${rowspan}`;
    slot.style.gridColumnEnd = `span ${colspan}`;

    this.grid.appendChild(slot);

    const { row: _r, col: _c, colspan: _cs, rowspan: _rs, ...figOpts } =
      options ?? {};
    const fig = new Figure(this, slot, figOpts);
    this.figures.push(fig);
    this.scheduleRedraw();
    return fig;
  }

  removeFigure(fig: Figure): void {
    const i = this.figures.indexOf(fig);
    if (i >= 0) this.figures.splice(i, 1);
  }

  scheduleRedraw(): void {
    if (this.raf !== null) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = null;
      this.redraw();
    });
  }

  private layout(): void {
    const w = Math.max(1, this.wrapper.clientWidth);
    const h = Math.max(1, this.wrapper.clientHeight);
    this.clientWidth = w;
    this.clientHeight = h;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    for (const f of this.figures) {
      f.onSceneLayout();
    }
    this.redraw();
  }

  redraw(): void {
    const glCanvas = this.canvas;
    const gl = glCanvas.getContext("webgl");
    if (!gl) return;

    const W = glCanvas.width;
    const H = glCanvas.height;
    const dpr = this.dpr;
    const cw = this.clientWidth;
    const ch = this.clientHeight;
    const cRect = glCanvas.getBoundingClientRect();

    gl.viewport(0, 0, W, H);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(...GL_MARGIN_BG);
    gl.clear(gl.COLOR_BUFFER_BIT);

    for (const fig of this.figures) {
      if (!fig.hasLineData()) continue;
      const plotCss = fig.getPlotRectInCanvasCss(cRect);
      const rawBox = plotRectToGlScissor(H, plotCss, dpr);
      const box = clampScissorToFramebuffer(W, H, rawBox);
      if (box.w <= 0 || box.h <= 0) continue;

      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(box.x, box.y, box.w, box.h);
      gl.clearColor(...GL_PLOT_BG);
      gl.clear(gl.COLOR_BUFFER_BIT);

      fig.uploadGlGeometry(this.webgl, cw, ch, cRect);
      this.webgl.drawLineStrip(2);
      gl.disable(gl.SCISSOR_TEST);
    }

    for (const fig of this.figures) {
      fig.redrawSvg();
    }
  }

  dispose(): void {
    this.ro.disconnect();
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
    for (const f of [...this.figures]) {
      f.dispose();
    }
    this.webgl.dispose();
    this.wrapper.remove();
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
