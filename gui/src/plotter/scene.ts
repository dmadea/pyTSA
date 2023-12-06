import { DraggableLines, Orientation } from "./draggableLines";
import { Figure } from "./figure/figure";
import {  GraphicObject, IMouseEvent, IPaintEvent } from "./object";
// import { Rect } from "./types";


export class Scene extends GraphicObject {

    private canvasResizeObserver: ResizeObserver;
    public fig: Figure | null = null;
    public figy: Figure | null = null;
    public figx: Figure | null = null;
    public dLines: DraggableLines | null = null;

    constructor(parentElement: HTMLDivElement, canvasClass: string = "canvas") {
        super();

        this.mainCanvas = document.createElement("canvas");
        this.secCanvas = document.createElement("canvas");
        this.mainCanvas.classList.add(canvasClass);
        this.secCanvas.classList.add(canvasClass);

        this.mainCanvas.style.zIndex = "1";
        this.secCanvas.style.zIndex = "2";

        parentElement.appendChild(this.mainCanvas);
        parentElement.appendChild(this.secCanvas);

        this.mainCtx = this.mainCanvas.getContext('2d') as CanvasRenderingContext2D;
        this.secCtx = this.secCanvas.getContext('2d') as CanvasRenderingContext2D;

        // this.items = [];
        this.margin = {left: 10, right:10 , top: 10, bottom: 10};
        this.canvasRect = {x:0, y:0, w: this.mainCanvas.width, h: this.mainCanvas.height};
        this.canvasResizeObserver = new ResizeObserver((entries) => this.observerCallback(entries));
        this.canvasResizeObserver.observe(this.mainCanvas);

        const dpr = window.devicePixelRatio;
        
        

        var mousedown = (e: MouseEvent) => {
            this.mouseDown({
                e, mainCanvas: this.mainCanvas,

            })
        };

        this.mainCanvas.addEventListener('mousedown', e => this.mouseDown({e, mainCanvas: canvas, x: e.offsetX * dpr, y: e.offsetY * dpr}));
        this.mainCanvas.addEventListener('mouseup', e => this.mouseUp({e, mainCanvas: canvas, x: e.offsetX * dpr, y: e.offsetY * dpr}));
        this.mainCanvas.addEventListener('mousemove', e => this.mouseMove({e, mainCanvas: canvas, x: e.offsetX * dpr, y: e.offsetY * dpr}));
        this.mainCanvas.addEventListener("contextmenu", e => this.showContextMenu({e, mainCanvas: canvas, x: e.offsetX * dpr, y: e.offsetY * dpr}));
        this.mainCanvas.addEventListener("dblclick", e => this.doubleClick({e, mainCanvas: canvas, x: e.offsetX * dpr, y: e.offsetY *dpr}));

        this.mainCanvas.addEventListener("touchstart", e => this.touchStart(e));
        this.mainCanvas.addEventListener("touchmove", e => this.touchMove(e));
        this.mainCanvas.addEventListener("touchend", e => this.touchEnd(e));

    }

    private observerCallback(entries: ResizeObserverEntry[]) {
        window.requestAnimationFrame((): void | undefined => {
            if (!Array.isArray(entries) || !entries.length) {
              return;
            }

            if (this.mainCanvas && this.secCanvas){

                this.mainCanvas.width = this.mainCanvas.clientWidth * window.devicePixelRatio;
                this.mainCanvas.height = this.mainCanvas.clientHeight * window.devicePixelRatio;
                // console.log(window.devicePixelRatio, this.canvas.width, this.canvas.height);

                this.resize();
            }
          });
    }

    public resize(): void {
        // set new dimensions
        if (this.mainCanvas){
            this.canvasRect = {
                x: 0,
                y: 0,
                w: this.mainCanvas.width,
                h: this.mainCanvas.height
            }
        }
        super.resize();
        this.repaint();
    }

    public paint(e: IPaintEvent): void {
        // console.log(this.canvasRect);

        // clear plot

        e.mainCtx.restore();
        // this.ctx.fillStyle = backgroundColor;
        e.mainCtx.clearRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
        e.mainCtx.save();
        console.log('initial paint from scene');

        super.paint(e);

    }
}