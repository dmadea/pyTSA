import type { Rect } from "@pytsa/ts-graph-new/src/types.js";
import { Figure } from "@pytsa/ts-graph-new";
import type { Cursor } from "@pytsa/ts-graph-new/src/objects/object.js";

export class FigureContext {

    public svgEl = $state<SVGSVGElement>()
    public svgRect = $state<Rect>({x: 0, y: 0, h: 1, w: 1})
    public cursor =  $state<Cursor>("crosshair")
    public fig: Figure
    public plotRect = $state({x: 100, y: 100, w: 500, h: 500})
    public colorbarWidth = $state<number>(0)

    constructor(figure: Figure) {
        this.fig = figure
    }



}