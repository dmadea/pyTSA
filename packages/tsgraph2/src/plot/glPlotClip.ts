import type { Rect } from "../types.js";

/**
 * WebGL scissor box for a plot rectangle in **CSS pixel** coordinates (top-left
 * origin, matching SVG). WebGL uses bottom-left origin for `gl.scissor`.
 */
export function plotRectToGlScissor(
  framebufferHeightPx: number,
  plot: Rect,
  dpr: number
): { x: number; y: number; w: number; h: number } {
  const sx = Math.floor(plot.x * dpr);
  const sw = Math.max(0, Math.ceil(plot.w * dpr));
  const sh = Math.max(0, Math.ceil(plot.h * dpr));
  const topPx = plot.y * dpr;
  const hPx = plot.h * dpr;
  const sy = Math.floor(framebufferHeightPx - topPx - hPx);
  return { x: sx, y: sy, w: sw, h: sh };
}

/** Clamp scissor so it lies inside [0,W]×[0,H] (inclusive of zero-area → caller skips draw). */
export function clampScissorToFramebuffer(
  W: number,
  H: number,
  box: { x: number; y: number; w: number; h: number }
): { x: number; y: number; w: number; h: number } {
  let { x, y, w, h } = box;
  x = Math.max(0, Math.min(x, W));
  y = Math.max(0, Math.min(y, H));
  w = Math.max(0, Math.min(w, W - x));
  h = Math.max(0, Math.min(h, H - y));
  return { x, y, w, h };
}
