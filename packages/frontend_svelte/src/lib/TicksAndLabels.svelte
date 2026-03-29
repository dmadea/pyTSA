<script module lang="ts">
    export const majorTickSize = 8
    export const minorTickSize = 4
    export const xtextOffset = 11
    export const ytextOffset = 5

    export const textHeight = 21.6
    export const textLiteralWidth = 70 / 7

    export interface TicksAndLabelsProps {
        title: string
        showTicks: string[]
        showTickNumbers: string[]
        leftAxisLabel: string
        rightAxisLabel: string,
        bottomAxisLabel: string,
        svgClientRect: Rect,
        axisAlignment: Orientation,
        internalRange: Rect,
        xAxis: Axis,
        yAxis: Axis,
        calcPlotRect?: (margin: Margin) => Rect,
        updatePlotRect?: (rect: Rect) => void,
        mapRange2Canvas: (p: Point, r?: Rect) => Point,
    }

    interface TickLabel {
        x: number,
        y: number,
        text: string
    }
        
    export type alignmentBaselineType =  "inherit" | "auto" | "alphabetic" | "hanging" | "ideographic" | "mathematical" | "baseline" | "before-edge" | "text-before-edge" | "middle" | "central" | "after-edge" | "text-after-edge" | null | undefined


</script>

<script lang="ts">
    import { getContext } from "svelte";
    import type { Margin, Rect } from "./Scene.svelte"
    import type { FigureContext, Orientation, Point } from "./Figure.svelte";
    import type { Axis } from "./axis.svelte";
    import { getTicks, determineSigFigures, formatNumber2String } from "./ticksUtils";


    // let { calcPlotRect, rightAxisLabel }: {calcPlotRect?: (margin: Margin) => Rect, rightAxisLabel?: string} = $props()


    let { title, showTicks, 
        showTickNumbers, 
        leftAxisLabel, 
        rightAxisLabel, 
        bottomAxisLabel,
        svgClientRect,
        axisAlignment,
        internalRange,
        xAxis,
        yAxis,
        calcPlotRect,
        updatePlotRect,
        mapRange2Canvas
      }: TicksAndLabelsProps = $props()


    // let figureContext: FigureContext = getContext('FigureContext')
    // let fc: FigureContext = getContext('FigureContext')
    // let sceneContext: SceneContext = getContext('SceneContext')

    const minMargin: Margin =  {
        left: 10,
        right: 5,
        top: 5,
        bottom: 5
    }
    
    interface Tick {
        x1: number,
        x2: number,
        y1: number,
        y2: number
    }

    let majorTicks = $state<Tick[]>([])
    let minorTicks = $state<Tick[]>([])
    let xTickLabels = $state<TickLabel[]>([])
    let leftTickLabels = $state<TickLabel[]>([])
    let rightTickLabels = $state<TickLabel[]>([])
    // let bottomAxisLabel = $state<string>("")
    // let leftAxisLabel = $state<string>("")
    // let title = $state<string>("")
    let _svgPlotRect = $state<Rect>({x: 100, y: 100, w: 100, h: 100})


    function repaint() {
        let [xticks, xticksVals, xMinors] = getTicks(xAxis, svgClientRect, axisAlignment, internalRange);
        let [yticks, yticksVals, yMinors] = getTicks(yAxis, svgClientRect, axisAlignment, internalRange);

        // Swap ticks if axis alignment is vertical
        if (axisAlignment === 'Vertical') {
            [xticks, yticks] = [yticks, xticks];
            [xticksVals, yticksVals] = [yticksVals, xticksVals];
            [xMinors, yMinors] = [yMinors, xMinors];
        }

        // calculate plot rect
        let xFigs = Math.max(2, ...xticksVals.map(num => determineSigFigures(num)))
        let yFigs = Math.max(2, ...yticksVals.map(num => determineSigFigures(num)))

        const xTexts = xticksVals.map(num => formatNumber2String(num, xFigs))
        const yTexts = yticksVals.map(num => formatNumber2String(num, yFigs))

        let bottomLongest = Math.max(...xTexts.map(s => s.length))
        let leftLongest = Math.max(...yTexts.map(s => s.length))

        let contTitle = title !== ""
        let contLeftLabel = leftAxisLabel !== ""
        let contBottomLabel = bottomAxisLabel !== ""

        let topMargin = showTickNumbers.includes('top') ? textHeight : 0
        topMargin += minMargin.top + (contTitle ? textHeight : 0)
        
        let bottomMargin = showTickNumbers.includes('bottom') ? textHeight : 0
        bottomMargin += minMargin.bottom + (contBottomLabel ? textHeight : 0)
        
        let leftMargin = contLeftLabel ? textHeight : 0
        leftMargin += showTickNumbers.includes('left') ? (leftLongest * textLiteralWidth + ytextOffset / 2 ) : 0
        leftMargin += minMargin.left
        
        let rightMargin = showTickNumbers.includes('right') ? (leftLongest * textLiteralWidth + ytextOffset / 2 ) : 0
        rightMargin += minMargin.right

        var r: Rect  // plot rect

        if (calcPlotRect) {
            r = calcPlotRect({
                left: leftMargin,
                right: rightMargin,
                top: topMargin,
                bottom: bottomMargin
            })
        } else {
            r = {
                x: leftMargin, y: topMargin,
                w: svgClientRect.w - leftMargin - rightMargin,
                h: svgClientRect.h - bottomMargin - topMargin
            }
        }

        if (!calcPlotRect) {
            updatePlotRect?.(r)
            _svgPlotRect = r
        }

        var _majorTicks: Tick[] = []
        var _minorTicks: Tick[] = []
        var _xTickLabels: TickLabel[] = []
        var _leftTickLabels: TickLabel[] = []
        var _rightTickLabels: TickLabel[] = []

        // bottom and top axis
        for (let i = 0; i < xticks.length; i++) {
            let p = mapRange2Canvas(
                axisAlignment === 'Vertical' 
                    ? {x: 0, y: xticks[i]} 
                    : {x: xticks[i], y: 0}, 
                r
            );
            const x = p.x

            if (showTicks.includes('bottom')){
                _majorTicks.push({
                    x1: x,
                    x2: x,
                    y1: r.y + r.h - majorTickSize,
                    y2: r.y + r.h
                })
            }

            if (showTicks.includes('top')){
                _majorTicks.push({
                    x1: x,
                    x2: x,
                    y1: r.y,
                    y2: r.y + majorTickSize
                })
            }

            let text = formatNumber2String(xticksVals[i], xFigs);
    
            if (showTickNumbers.includes('bottom')){
                _xTickLabels.push({
                    x: x,
                    y: r.y + r.h + xtextOffset,
                    text: text
                })
            }

            if (showTickNumbers.includes('top')){
                _xTickLabels.push({
                    x: x,
                    y: r.y - xtextOffset,
                    text: text
                })
            }
        }

        for (let i = 0; i < xMinors.length; i++) {
            let p = mapRange2Canvas(
                axisAlignment === 'Vertical' 
                    ? {x: 0, y: xMinors[i]} 
                    : {x: xMinors[i], y: 0}, 
                r
            );
            const x = p.x

            if (showTicks.includes('bottom')){
                _minorTicks.push({
                    x1: x,
                    x2: x,
                    y1: r.y + r.h - minorTickSize,
                    y2: r.y + r.h
                })
            }

            if (showTicks.includes('top')){
                _minorTicks.push({
                    x1: x,
                    x2: x,
                    y1: r.y,
                    y2: r.y + minorTickSize
                })
            }
        }

        // y axis
        for (let i = 0; i < yticks.length; i++) {
            let p = mapRange2Canvas(
                axisAlignment === 'Vertical' 
                    ? {x: yticks[i], y: 0} 
                    : {x: 0, y: yticks[i]}, 
                r
            );
            const y = p.y

            if (showTicks.includes('left')){
                _majorTicks.push({
                    x1: r.x,
                    x2: r.x + majorTickSize,
                    y1: y,
                    y2: y
                })
            }

            if (showTicks.includes('right')){
                _majorTicks.push({
                    x1: r.x + r.w - majorTickSize,
                    x2: r.x + r.w,
                    y1: y,
                    y2: y
                })
            }

            let text = formatNumber2String(yticksVals[i], yFigs);

            if (showTickNumbers.includes('left')){
                _leftTickLabels.push({
                    x: r.x - ytextOffset,
                    y: y,
                    text: text
                })
            }

            if (showTickNumbers.includes('right')){
                _rightTickLabels.push({
                    x: r.x + r.w + ytextOffset,
                    y: y,
                    text: text
                })
            }
        }

        for (let i = 0; i < yMinors.length; i++) {
            let p = mapRange2Canvas(
                axisAlignment === 'Vertical' 
                    ? {x: yMinors[i], y: 0} 
                    : {x: 0, y: yMinors[i]}, 
                r
            );
            const y = p.y

            if (showTicks.includes('left')){
                _minorTicks.push({
                    x1: r.x,
                    x2: r.x + minorTickSize,
                    y1: y,
                    y2: y
                })
            }

            if (showTicks.includes('right')){
                _minorTicks.push({
                    x1: r.x + r.w - minorTickSize,
                    x2: r.x + r.w,
                    y1: y,
                    y2: y
                })
            }
        }

        majorTicks = _majorTicks
        minorTicks = _minorTicks
        xTickLabels = _xTickLabels
        leftTickLabels = _leftTickLabels
        rightTickLabels = _rightTickLabels
    }

    $effect(() => {
        repaint()
    })

    // Add an event listener for the figure-resize event
    // $effect(() => {
    //     const handleResize = () => {
    //         // repaint()
    //         // console.log("figure-resize, repaint called")
    //     }
        
    //     window.addEventListener('figure-resize', handleResize)
        
    //     return () => {
    //         window.removeEventListener('figure-resize', handleResize)
    //     }
    // })

    // Initial repaint on mount
    // $effect(() => {
    //     // Ensure we have valid dimensions before repainting
    //     if (svgClientRect.w > 0 && svgClientRect.h > 0) {
    //         setTimeout(() => {
    //             repaint();
    //         }, 0);
    //     }
    // });

    // $effect(() => {
    //     const cr  = sceneContext.canvasBoundingRect;
    //     const svgRect  = fc.svgRect;

    //     setTimeout(() => repaint(), 1)
    // })

</script>

<g>
    {#each majorTicks as tick}
        <line class="line" x1={tick.x1.toFixed(1)} x2={tick.x2.toFixed(1)} y1={tick.y1.toFixed(1)} y2={tick.y2.toFixed(1)} />
    {/each}
    {#each minorTicks as tick}
        <line class="minor" x1={tick.x1.toFixed(1)} x2={tick.x2.toFixed(1)} y1={tick.y1.toFixed(1)} y2={tick.y2.toFixed(1)} />
    {/each}
</g>


{#snippet textSnippet(textAnchor: string, alignmentBaseline: alignmentBaselineType, labels: TickLabel[])}
    {#each labels as label}
        <!-- svelte-ignore component_name_lowercase -->
        <text alignment-baseline={alignmentBaseline} text-anchor={textAnchor} x={label.x.toFixed(1)} y={label.y.toFixed(1)}>
            {label.text}
        </text>
    {/each}
{/snippet} 

<g>
    {@render textSnippet("middle", "central", xTickLabels)}
    {@render textSnippet("end", "middle", leftTickLabels)}
    {@render textSnippet("start", "middle", rightTickLabels)}
</g>

<!-- title -->
{#if title !== ""}
    <text class="title" x={(_svgPlotRect.x + _svgPlotRect.w) / 2} y={minMargin.top}>
        {title}
    </text>
{/if}

<!-- bottom axis label -->
{#if bottomAxisLabel !== ""}
    <text class="bottom-label" x={(_svgPlotRect.x + _svgPlotRect.w) / 2} y={svgClientRect.h - minMargin.bottom}>
        {bottomAxisLabel}
    </text>
{/if}

<!-- left axis label -->
{#if leftAxisLabel !== ""}
    <text class="left-label" transform="translate({minMargin.left}, {(_svgPlotRect.y + _svgPlotRect.h) / 2}) rotate(-90)">
        {leftAxisLabel}
    </text>
{/if}

<!-- right axis label -->
{#if rightAxisLabel}
    <text class="right-label" transform="translate({svgClientRect.w - minMargin.left}, {(_svgPlotRect.y + _svgPlotRect.h) / 2}) rotate(-90)">
        {rightAxisLabel}
    </text>
{/if}


<style>

    .title {
        alignment-baseline: hanging;
        text-anchor: middle;
        font-weight: bold;
        font-size: large;
    }

    .bottom-label {
        alignment-baseline: after-edge;
        text-anchor: middle;
    }

    .left-label {
        alignment-baseline: hanging;
        text-anchor: middle;
    }

    .right-label {
        alignment-baseline: bottom;
        text-anchor: middle;
    }


    /* .text {
        alignment-baseline: middle;
        text-anchor: middle;
    }

    .text-left {
        alignment-baseline: middle;
        text-anchor: end;
    }

    .text-right {
        alignment-baseline: middle;
        text-anchor: start;
    } */

    .line {
        stroke: rgb(0, 0, 0);
        stroke-width: 1px;
    } 

    .minor {
        stroke: rgb(0, 0, 0);
        stroke-width: 1px;
    } 
    

</style>