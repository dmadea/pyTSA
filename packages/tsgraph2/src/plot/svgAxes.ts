import type { Margin, Rect } from "../types.js";

export interface LabeledTick {
  px: number;
  label: string;
}

export interface SvgAxesModel {
  width: number;
  height: number;
  plot: Rect;
  margins: Margin;
  xTicks: LabeledTick[];
  yTicks: LabeledTick[];
  xLabel?: string;
  yLabel?: string;
  title?: string;
}

function el<K extends keyof SVGElementTagNameMap>(
  doc: Document,
  name: K
): SVGElementTagNameMap[K] {
  return doc.createElementNS(
    "http://www.w3.org/2000/svg",
    name
  ) as SVGElementTagNameMap[K];
}

/** Clears `target` group and draws frame, ticks, axis names, optional title. */
export function renderSvgAxesGroup(target: SVGGElement, m: SvgAxesModel): void {
  const doc = target.ownerDocument!;
  while (target.firstChild) target.removeChild(target.firstChild);

  const tickStyle =
    "stroke:var(--tg-axis-tick, rgba(255,255,255,0.45));stroke-width:1;shape-rendering:crispEdges";
  const textStyle =
    "fill:var(--tg-axis-text, rgba(230,230,235,0.85));font:11px system-ui,sans-serif";
  const titleStyle =
    "fill:var(--tg-axis-text, rgba(230,230,235,0.92));font:600 13px system-ui,sans-serif";

  if (m.title) {
    const text = el(doc, "text");
    text.setAttribute("x", String(m.plot.x + m.plot.w / 2));
    text.setAttribute("y", String(Math.max(14, m.margins.top * 0.45 + 6)));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("style", titleStyle);
    text.textContent = m.title;
    target.appendChild(text);
  }

  const frame = el(doc, "rect");
  frame.setAttribute("x", String(m.plot.x));
  frame.setAttribute("y", String(m.plot.y));
  frame.setAttribute("width", String(m.plot.w));
  frame.setAttribute("height", String(m.plot.h));
  frame.setAttribute("fill", "none");
  frame.setAttribute("stroke", "var(--tg-axis-frame, rgba(255,255,255,0.35))");
  frame.setAttribute("stroke-width", "1");
  target.appendChild(frame);

  for (const t of m.xTicks) {
    const line = el(doc, "line");
    const y0 = m.plot.y + m.plot.h;
    line.setAttribute("x1", String(t.px));
    line.setAttribute("x2", String(t.px));
    line.setAttribute("y1", String(y0));
    line.setAttribute("y2", String(y0 + 5));
    line.setAttribute("style", tickStyle);
    target.appendChild(line);

    const text = el(doc, "text");
    text.setAttribute("x", String(t.px));
    text.setAttribute("y", String(y0 + 18));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("style", textStyle);
    text.textContent = t.label;
    target.appendChild(text);
  }

  for (const t of m.yTicks) {
    const line = el(doc, "line");
    const x0 = m.plot.x;
    line.setAttribute("x1", String(x0 - 5));
    line.setAttribute("x2", String(x0));
    line.setAttribute("y1", String(t.px));
    line.setAttribute("y2", String(t.px));
    line.setAttribute("style", tickStyle);
    target.appendChild(line);

    const text = el(doc, "text");
    text.setAttribute("x", String(x0 - 8));
    text.setAttribute("y", String(t.px));
    text.setAttribute("text-anchor", "end");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("style", textStyle);
    text.textContent = t.label;
    target.appendChild(text);
  }

  if (m.xLabel) {
    const text = el(doc, "text");
    text.setAttribute("x", String(m.plot.x + m.plot.w / 2));
    text.setAttribute("y", String(m.height - 6));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("style", textStyle);
    text.textContent = m.xLabel;
    target.appendChild(text);
  }

  if (m.yLabel) {
    const text = el(doc, "text");
    text.setAttribute("x", String(12));
    text.setAttribute("y", String(m.plot.y + m.plot.h / 2));
    text.setAttribute(
      "transform",
      `rotate(-90 12 ${m.plot.y + m.plot.h / 2})`
    );
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("style", textStyle);
    text.textContent = m.yLabel;
    target.appendChild(text);
  }
}

export function formatTickLabel(v: number): string {
  const a = Math.abs(v);
  if (!Number.isFinite(v)) return "";
  if (a >= 1e4 || (a > 0 && a < 1e-2)) return v.toExponential(1);
  return v.toPrecision(3).replace(/\.?0+$/, "");
}

export function niceTicks(
  min: number,
  max: number,
  count: number
): number[] {
  if (min === max) {
    return [min];
  }
  const span = max - min;
  const step0 = span / Math.max(1, count - 1);
  const pow10 = 10 ** Math.floor(Math.log10(step0));
  const err = step0 / pow10;
  let step =
    err >= 7.5 ? 10 * pow10 : err >= 3.5 ? 5 * pow10 : err >= 1.5 ? 2 * pow10 : pow10;
  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let x = start; x <= max + step * 0.5; x += step) {
    ticks.push(x);
  }
  if (ticks.length === 0) ticks.push(min, max);
  return ticks;
}
