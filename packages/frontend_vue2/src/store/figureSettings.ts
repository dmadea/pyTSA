import { reactive } from "vue";
import { createDefaultFigureSettings } from "@pytsa/tsgraph2";

/** Shared with PlotHost — mutate fields and call host.redraw() (deep watch). */
export const figureSettings = reactive(createDefaultFigureSettings());
