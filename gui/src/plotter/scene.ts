import {  GraphicObject, IMouseEvent, IPaintEvent } from "./object";
// import { Rect } from "./types";


export class Scene extends GraphicObject {

    private canvasResizeObserver: ResizeObserver;

    constructor(parentElement: HTMLDivElement) {
        super();
        var wrapper = document.createElement("div");
        wrapper.style.cssText = "position: relative; width: 100%; height: 100%";

        var mainCanvas = document.createElement("canvas");
        var secCanvas = document.createElement("canvas");
        mainCanvas.style.position = "absolute";
        secCanvas.style.position = "absolute";

        mainCanvas.style.zIndex = "0";
        secCanvas.style.zIndex = "1";

        wrapper.appendChild(mainCanvas);
        wrapper.appendChild(secCanvas);
        parentElement.appendChild(wrapper);

        this.bottomCtx = mainCanvas.getContext('2d') as CanvasRenderingContext2D;
        this.topCtx = secCanvas.getContext('2d') as CanvasRenderingContext2D;

        this.bottomCanvas = mainCanvas;
        this.topCanvas = secCanvas;

        // this.items = [];
        this.margin = {left: 10, right:10 , top: 10, bottom: 10};
        this.canvasRect = {x:0, y:0, w: mainCanvas.width, h: mainCanvas.height};
        this.canvasResizeObserver = new ResizeObserver((entries) => {
            window.requestAnimationFrame(() => {
                if (!Array.isArray(entries) || !entries.length) {
                  return;
                }
    
                if (this.bottomCanvas && this.topCanvas){
    
                    const dpr = window.devicePixelRatio;
                    
                    this.bottomCanvas.style.width = `${wrapper.clientWidth}px`;
                    this.topCanvas.style.width = `${wrapper.clientWidth}px`;
                    this.bottomCanvas.style.height = `${wrapper.clientHeight}px`;
                    this.topCanvas.style.height = `${wrapper.clientHeight}px`;
    
                    const w = wrapper.clientWidth * dpr;
                    const h = wrapper.clientHeight * dpr;
    
                    this.bottomCanvas.width = w;
                    this.bottomCanvas.height = h;
                    this.topCanvas.width = w;
                    this.topCanvas.height = h;
    
                    this.resize();
                }
              });
        });
        this.canvasResizeObserver.observe(wrapper);

        var mousedown = (e: MouseEvent) => {
            const dpr = window.devicePixelRatio;
            this.mouseDown({
                e, bottomCanvas: mainCanvas, topCanvas: secCanvas, x: e.offsetX * dpr, y: e.offsetY * dpr
            })
        };

        var mouseup = (e: MouseEvent) => {
            const dpr = window.devicePixelRatio;
            this.mouseUp({
                e, bottomCanvas: mainCanvas, topCanvas: secCanvas, x: e.offsetX * dpr, y: e.offsetY * dpr
            })
        };

        var mousemove = (e: MouseEvent) => {
            const dpr = window.devicePixelRatio;
            this.mouseMove({
                e, bottomCanvas: mainCanvas, topCanvas: secCanvas, x: e.offsetX * dpr, y: e.offsetY * dpr
            })
        };

        var contextmenu = (e: MouseEvent) => {
            const dpr = window.devicePixelRatio;
            this.showContextMenu({
                e, bottomCanvas: mainCanvas, topCanvas: secCanvas, x: e.offsetX * dpr, y: e.offsetY * dpr
            })
        };

        var dblclick = (e: MouseEvent) => {
            const dpr = window.devicePixelRatio;
            this.doubleClick({
                e, bottomCanvas: mainCanvas, topCanvas: secCanvas, x: e.offsetX * dpr, y: e.offsetY * dpr
            })
        };

        secCanvas.addEventListener('mousedown', mousedown);
        secCanvas.addEventListener('mouseup', mouseup);
        secCanvas.addEventListener('mousemove', mousemove);
        secCanvas.addEventListener("contextmenu", contextmenu);
        secCanvas.addEventListener("dblclick", dblclick);

        secCanvas.addEventListener("touchstart", e => this.touchStart(e));
        secCanvas.addEventListener("touchmove", e => this.touchMove(e));
        secCanvas.addEventListener("touchend", e => this.touchEnd(e));
    }

    public resize(): void {
        // set new dimensions
        if (this.bottomCanvas){
            this.canvasRect = {
                x: 0,
                y: 0,
                w: this.bottomCanvas.width,
                h: this.bottomCanvas.height
            }
        }
        super.resize();
        this.repaint();
    }

    public paint(e: IPaintEvent): void {
        // console.log(this.canvasRect);

        // clear plot

        e.bottomCtx.clearRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
        e.topCtx.clearRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
        // e.mainCtx.restore();
        // this.ctx.fillStyle = backgroundColor;
        // e.mainCtx.save();
        console.log('initial paint from scene');

        super.paint(e);

    }
}