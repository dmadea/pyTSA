import { GraphicObject, IMouseEvent, IPaintEvent } from "./object";
import { Figure } from "../figure/figure";
import { DraggableRegion } from "./draggable";


export class Legend extends DraggableRegion {

    public hoverDash = [];
    public dash = [8, 4];
    public paintBorder: boolean = false;

    constructor(parent: Figure) {
        super(parent, parent, false);
        this.resize();
    }

    public resize(): void {
        const r = this.figure.getEffectiveRect();

        this.regionRect = {
            x: r.x + r.w - 20 - 50,
            y: r.y + 50,
            w: 20,
            h: 20
        }
    }

    public paint(e: IPaintEvent): void {
        if (!this.figure.showLegend) return;

        e.ctx.save();

        const r = this.figure.getEffectiveRect();
        e.ctx.beginPath();
        e.ctx.rect(r.x, r.y, r.w, r.h);
        e.ctx.clip();

        if (this.paintBorder){
            e.ctx.setLineDash(this.hovering ? this.hoverDash : this.dash);
            e.ctx.strokeRect(this.regionRect.x, this.regionRect.y, this.regionRect.w, this.regionRect.h);
        }

        const plots = this.figure.linePlots.filter(p => p.label !== null);

        if (plots.length > 0) {

            var maxTextWidth = 0;
            var textHeight = 0;

            e.ctx.textAlign = 'left';  // vertical alignment
            e.ctx.textBaseline = 'middle'; // horizontal alignment
            e.ctx.font = this.figure.tickValuesFont;

            for (const plot of plots) {
                const text = plot.label === '' ? 'M' : plot.label as string;
                const _metrics = e.ctx.measureText(text);
                textHeight = _metrics.actualBoundingBoxAscent + _metrics.actualBoundingBoxDescent;
                if (_metrics.width > maxTextWidth) maxTextWidth = _metrics.width;
            }

            const newWidth = maxTextWidth + 50;
            const newHeight = plots.length * textHeight * 1.5;
    
            if (!this.dragging && newWidth !== this.regionRect.w && newHeight !== this.regionRect.h) {
                // set up new position and size of regionRect
                const diffWidth = newWidth - this.regionRect.w;
                this.regionRect = { ...this.regionRect,
                    x: this.regionRect.x - diffWidth,
                    w: newWidth,
                    h: newHeight
                }
            }

            for (let i = 0; i < plots.length; i++) {
                e.ctx.beginPath();
                const plot = plots[i];
                
                e.ctx.strokeStyle = plot.color;
                e.ctx.lineWidth = plot.lw;
                e.ctx.setLineDash(plot.ld);

                const y = textHeight / 2 + this.regionRect.y + newHeight * i / plots.length;

                e.ctx.moveTo(this.regionRect.x, y);
                e.ctx.lineTo(this.regionRect.x + 30, y);
                e.ctx.stroke();

                // plot text
                e.ctx.fillText(plot.label as string, this.regionRect.x + 50, y);
            }
        }

        e.ctx.restore();
    }
}