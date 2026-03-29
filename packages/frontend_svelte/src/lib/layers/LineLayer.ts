import type { Layer, GLContext, FigureFrame } from './types';
import type { Color } from '../color';
import { F32Array } from '../array';

// Lightweight wrapper that uses GLRenderer if present in the context

export interface LineLayerOptions {
  id?: string;
  x: number[] | Float32Array | F32Array;
  y: number[] | Float32Array | F32Array;
  color: Color;
  label?: string | null;
}

type GLRendererLike = {
  createThinLine: (x: F32Array | number[], y: F32Array | number[], color: Color, label?: string | null) => unknown;
  drawThinLine: (
    line: any,
    uMatrix: Float32Array,
    xScale: any,
    yScale: any,
    xLinthresh?: number,
    yLinthresh?: number,
    xLinscale?: number,
    yLinscale?: number,
  ) => void;
};

export class LineLayer implements Layer {
  public id: string;
  private options: LineLayerOptions;
  private renderer: GLRendererLike | null = null;
  private gl: WebGLRenderingContext | null = null;
  private handle: any = null; // renderer-specific line handle

  constructor(options: LineLayerOptions) {
    this.options = options;
    this.id = options.id ?? `line-${Math.random().toString(36).slice(2)}`;
  }

  mount(ctx: GLContext) {
    this.gl = ctx.gl;
    this.renderer = (ctx.renderer as GLRendererLike) ?? null;
    if (!this.renderer) return;
    this.handle = this.renderer.createThinLine(this.options.x as any, this.options.y as any, this.options.color, this.options.label ?? null);
  }

  draw(frame: FigureFrame) {
    if (!this.gl || !this.renderer || !this.handle) return;

    // Set viewport and scissor to the figure area (already DPR-scaled)
    const { x, y, w, h } = frame.canvasRect;
    this.gl.enable(this.gl.SCISSOR_TEST);
    this.gl.viewport(x, y, w, h);
    this.gl.scissor(x, y, w, h);

    // Draw using the provided transform and axes
    const { axes, uMatrix } = frame;
    this.renderer.drawThinLine(
      this.handle,
      uMatrix,
      axes.xScale as any,
      axes.yScale as any,
      axes.xLinthresh,
      axes.yLinthresh,
      axes.xLinscale,
      axes.yLinscale,
    );
  }

  destroy() {
    // nothing specific yet; add buffer cleanup API on renderer if needed
    this.handle = null;
    this.gl = null;
    this.renderer = null;
  }

  setData(data: { x?: LineLayerOptions['x']; y?: LineLayerOptions['y']; color?: Color }) {
    if (data.x) this.options.x = data.x;
    if (data.y) this.options.y = data.y;
    if (data.color) this.options.color = data.color;
    // Recreate buffers for now (simple approach). In future, add an update API to renderer
    if (this.renderer && this.gl) {
      this.handle = this.renderer.createThinLine(this.options.x as any, this.options.y as any, this.options.color, this.options.label ?? null);
    }
  }
}


