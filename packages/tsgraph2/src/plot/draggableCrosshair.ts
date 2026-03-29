import type { Point, Rect } from "../types.js";

const NS = "http://www.w3.org/2000/svg";
const HIT_AREA = 5;
const INTERSECTION = 8;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export interface DraggableCrosshairOptions {
  getPlotRect: () => Rect;
  mapSvgToDummy: (p: Point) => Point;
  mapDummyToSvg: (p: Point) => Point;
  onChange?: (dummy: Point) => void;
}

/**
 * Vertical + horizontal dashed crosshair with drag handles (same behavior as
 * frontend_svelte DraggableLines.svelte).
 */
export class DraggableCrosshair {
  private readonly g: SVGGElement;
  private readonly vHit: SVGRectElement;
  private readonly vLine: SVGLineElement;
  private readonly hHit: SVGRectElement;
  private readonly hLine: SVGLineElement;
  private readonly iHit: SVGRectElement;
  private dummy: Point = { x: 0, y: 0 };
  private moveListener: ((e: MouseEvent) => void) | null = null;
  private upListener: ((e: MouseEvent) => void) | null = null;
  private hoverV = false;
  private hoverH = false;
  private hoverI = false;

  constructor(
    svg: SVGSVGElement,
    private readonly opts: DraggableCrosshairOptions
  ) {
    const doc = svg.ownerDocument!;
    this.g = doc.createElementNS(NS, "g");
    this.g.setAttribute("class", "tg-draggable-crosshair");

    this.vHit = doc.createElementNS(NS, "rect");
    this.vHit.setAttribute("fill", "transparent");
    this.vHit.style.cursor = "ew-resize";

    this.vLine = doc.createElementNS(NS, "line");
    this.vLine.setAttribute("fill", "none");
    this.vLine.setAttribute("pointer-events", "none");

    this.hHit = doc.createElementNS(NS, "rect");
    this.hHit.setAttribute("fill", "transparent");
    this.hHit.style.cursor = "ns-resize";

    this.hLine = doc.createElementNS(NS, "line");
    this.hLine.setAttribute("fill", "none");
    this.hLine.setAttribute("pointer-events", "none");

    this.iHit = doc.createElementNS(NS, "rect");
    this.iHit.setAttribute("fill", "transparent");
    this.iHit.style.cursor = "move";

    this.g.append(this.vHit, this.vLine, this.hHit, this.hLine, this.iHit);
    svg.appendChild(this.g);

    this.vHit.addEventListener("mousedown", (e) =>
      this.startDrag(e, "vertical")
    );
    this.hHit.addEventListener("mousedown", (e) =>
      this.startDrag(e, "horizontal")
    );
    this.iHit.addEventListener("mousedown", (e) =>
      this.startDrag(e, "both")
    );

    this.vHit.addEventListener("mouseenter", () => {
      this.hoverV = true;
      this.paintStroke();
    });
    this.vHit.addEventListener("mouseleave", () => {
      this.hoverV = false;
      this.paintStroke();
    });
    this.hHit.addEventListener("mouseenter", () => {
      this.hoverH = true;
      this.paintStroke();
    });
    this.hHit.addEventListener("mouseleave", () => {
      this.hoverH = false;
      this.paintStroke();
    });
    this.iHit.addEventListener("mouseenter", () => {
      this.hoverI = true;
      this.paintStroke();
    });
    this.iHit.addEventListener("mouseleave", () => {
      this.hoverI = false;
      this.paintStroke();
    });
  }

  setDummy(p: Point): void {
    this.dummy = { ...p };
    this.paintGeometry();
  }

  getDummy(): Point {
    return { ...this.dummy };
  }

  /** Reposition SVG elements from dummy coords (after pan/zoom / data). */
  paintFromDummy(dummy: Point): void {
    this.dummy = { ...dummy };
    this.paintGeometry();
  }

  setVisible(visible: boolean): void {
    this.g.style.display = visible ? "" : "none";
  }

  dispose(): void {
    this.cleanupDrag();
    this.g.remove();
  }

  private paintStroke(): void {
    const hi = this.hoverV || this.hoverH || this.hoverI;
    const stroke = hi
      ? "var(--tg-crosshair-hi, rgba(0,0,0,0.85))"
      : "var(--tg-crosshair, rgba(120,120,130,0.9))";
    const sw = hi ? "2" : "1";
    for (const line of [this.vLine, this.hLine]) {
      line.setAttribute("stroke", stroke);
      line.setAttribute("stroke-width", sw);
      line.setAttribute("stroke-dasharray", "4,4");
    }
  }

  private paintGeometry(): void {
    const pr = this.opts.getPlotRect();
    let sp = this.opts.mapDummyToSvg(this.dummy);
    sp = {
      x: clamp(sp.x, pr.x, pr.x + pr.w),
      y: clamp(sp.y, pr.y, pr.y + pr.h),
    };
    this.dummy = this.opts.mapSvgToDummy(sp);
    const { x, y } = sp;

    this.vHit.setAttribute("x", String(x - HIT_AREA / 2));
    this.vHit.setAttribute("y", String(pr.y));
    this.vHit.setAttribute("width", String(HIT_AREA));
    this.vHit.setAttribute("height", String(pr.h));

    this.vLine.setAttribute("x1", String(x));
    this.vLine.setAttribute("y1", String(pr.y));
    this.vLine.setAttribute("x2", String(x));
    this.vLine.setAttribute("y2", String(pr.y + pr.h));

    this.hHit.setAttribute("x", String(pr.x));
    this.hHit.setAttribute("y", String(y - HIT_AREA / 2));
    this.hHit.setAttribute("width", String(pr.w));
    this.hHit.setAttribute("height", String(HIT_AREA));

    this.hLine.setAttribute("x1", String(pr.x));
    this.hLine.setAttribute("y1", String(y));
    this.hLine.setAttribute("x2", String(pr.x + pr.w));
    this.hLine.setAttribute("y2", String(y));

    this.iHit.setAttribute("x", String(x - INTERSECTION / 2));
    this.iHit.setAttribute("y", String(y - INTERSECTION / 2));
    this.iHit.setAttribute("width", String(INTERSECTION));
    this.iHit.setAttribute("height", String(INTERSECTION));

    this.paintStroke();
  }

  private cleanupDrag(): void {
    if (this.moveListener) {
      window.removeEventListener("mousemove", this.moveListener, true);
      this.moveListener = null;
    }
    if (this.upListener) {
      window.removeEventListener("mouseup", this.upListener, true);
      this.upListener = null;
    }
  }

  private startDrag(
    e: MouseEvent,
    mode: "vertical" | "horizontal" | "both"
  ): void {
    e.preventDefault();
    e.stopPropagation();
    this.cleanupDrag();

    let last = { x: e.clientX, y: e.clientY };
    const pr = this.opts.getPlotRect();
    let sp = this.opts.mapDummyToSvg(this.dummy);
    sp = {
      x: clamp(sp.x, pr.x, pr.x + pr.w),
      y: clamp(sp.y, pr.y, pr.y + pr.h),
    };

    this.moveListener = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const dx = ev.clientX - last.x;
      const dy = ev.clientY - last.y;
      last = { x: ev.clientX, y: ev.clientY };

      if (mode === "vertical") sp.x += dx;
      else if (mode === "horizontal") sp.y += dy;
      else {
        sp.x += dx;
        sp.y += dy;
      }

      sp.x = clamp(sp.x, pr.x, pr.x + pr.w);
      sp.y = clamp(sp.y, pr.y, pr.y + pr.h);
      this.dummy = this.opts.mapSvgToDummy(sp);
      this.paintGeometry();
      this.opts.onChange?.({ ...this.dummy });
    };

    this.upListener = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.cleanupDrag();
    };

    window.addEventListener("mousemove", this.moveListener, true);
    window.addEventListener("mouseup", this.upListener, true);
  }
}
