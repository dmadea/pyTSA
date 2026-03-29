export { F32Array, Matrix, NumberArray } from "./array.js";
export type { Margin, Point, Rect } from "./types.js";
export {
  PlotHost,
  type PlotHostOptions,
  type FigureSettings,
  createDefaultFigureSettings,
} from "./plot/plotHost.js";
export {
  Scene,
  Figure,
  type SceneOptions,
  type FigureOptions,
  type FigureGridPlacement,
} from "./plot/scene.js";
export {
  niceTicks,
  formatTickLabel,
  renderSvgAxesGroup,
  type SvgAxesModel,
  type LabeledTick,
} from "./plot/svgAxes.js";
export { WebglLinePlot } from "./plot/webglLine.js";
export {
  clampScissorToFramebuffer,
  plotRectToGlScissor,
} from "./plot/glPlotClip.js";
export {
  type AxisScale,
  type AxisSettings,
  type AxisAlignment,
  defaultAxisSettings,
  axisForward,
  axisInverse,
} from "./plot/axisTransforms.js";
