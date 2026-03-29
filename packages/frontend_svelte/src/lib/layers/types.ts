// Minimal layer interfaces and shared types for the WebGL draw pipeline

// Avoid importing types from .svelte/.svelte.ts files here to keep this usable in plain TS

export type Scale = 'Linear' | 'Logarithmic' | 'Symmetric logarithmic' | 'Data bound';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  // Device-pixel viewport for this figure region (use DPR-scaled sizes)
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Matrix3 = Float32Array; // column-major 3x3 for clip-space transform

export interface AxesState {
  xScale: Scale;
  yScale: Scale;
  xLinthresh: number;
  yLinthresh: number;
  xLinscale: number;
  yLinscale: number;
}

export interface FigureFrame {
  // Current figure state needed to draw a layer
  canvasRect: Viewport; // DPR-scaled viewport/scissor rect
  internalRange: Rect;  // data coordinates range currently visible
  uMatrix: Matrix3;     // transform to clip space (-1..1) for current figure
  axes: AxesState;      // axis scales and params
}

export interface GLContext {
  gl: WebGLRenderingContext;
  // Expose your high-level renderer instance if available
  renderer: unknown; // typically GLRenderer, kept as unknown to avoid coupling
}

export interface Layer {
  // A unique identifier can help with debugging and registry ops
  id: string;

  // Called once when the layer is attached to the scene/figure
  mount(ctx: GLContext): void | Promise<void>;

  // Called on every frame or when the figure/scene requests a redraw
  draw(frame: FigureFrame): void;

  // Called when the layer is removed or the figure/scene is destroyed
  destroy(): void;

  // Optional helpers for updating data/visibility without recreating the layer
  setData?(data: unknown): void;
  setVisible?(visible: boolean): void;
}


