import {  GraphicObject, IMouseEvent, IPaintEvent, ObjectType } from "./objects/object";
import { GLRenderer } from "./renderer";
// import { Rect } from "./types";


export class Scene extends GraphicObject {

    public glcanvas: HTMLCanvasElement
    public canvas2d: HTMLCanvasElement
    public glctx: WebGLRenderingContext
    public ctx: CanvasRenderingContext2D
    public renderer: GLRenderer

    constructor(glcanvas: HTMLCanvasElement, canvas2d: HTMLCanvasElement, glctx: WebGLRenderingContext, ctx: CanvasRenderingContext2D) {
        super();
        this.scene = this
        this.glcanvas = glcanvas
        this.canvas2d = canvas2d
        this.glctx = glctx
        this.ctx = ctx

        this.parent = null

        this.renderer = new GLRenderer(glctx)

        // this.objectType = ObjectType.root;
        
        // var mousedown = (e: MouseEvent) => {
        //     const dpr = window.devicePixelRatio;
        //     this.mouseDown({
        //         e, bottomCanvas: mainCanvas, topCanvas: secCanvas, x: e.offsetX * dpr, y: e.offsetY * dpr
        //     })
        // };

        // var mouseup = (e: MouseEvent) => {
        //     const dpr = window.devicePixelRatio;
        //     this.mouseUp({
        //         e, bottomCanvas: mainCanvas, topCanvas: secCanvas, x: e.offsetX * dpr, y: e.offsetY * dpr
        //     })
        // };

        // var mousemove = (e: MouseEvent) => {
        //     const dpr = window.devicePixelRatio;
        //     this.mouseMove({
        //         e, bottomCanvas: mainCanvas, topCanvas: secCanvas, x: e.offsetX * dpr, y: e.offsetY * dpr
        //     })
        // };

        // var contextmenu = (e: MouseEvent) => {
        //     const dpr = window.devicePixelRatio;
        //     this.showContextMenu({
        //         e, bottomCanvas: mainCanvas, topCanvas: secCanvas, x: e.offsetX * dpr, y: e.offsetY * dpr
        //     })
        // };

        // var dblclick = (e: MouseEvent) => {
        //     const dpr = window.devicePixelRatio;
        //     this.doubleClick({
        //         e, bottomCanvas: mainCanvas, topCanvas: secCanvas, x: e.offsetX * dpr, y: e.offsetY * dpr
        //     })
        // };

        // secCanvas.addEventListener('mousedown', mousedown);
        // secCanvas.addEventListener('mouseup', mouseup);
        // secCanvas.addEventListener('mousemove', mousemove);
        // secCanvas.addEventListener("contextmenu", contextmenu);
        // secCanvas.addEventListener("dblclick", dblclick);

    }

   
    public resize(): void {
        // set new dimensions
        // if (this.bottomCanvas){
        //     this.canvasRect = {
        //         x: 0,
        //         y: 0,
        //         w: this.bottomCanvas.width,
        //         h: this.bottomCanvas.height
        //     }
        // }
        // super.resize();
        // this.repaint();
    }

    public paint(e: IPaintEvent): void {
        // console.log(this.canvasRect);


        // clear plot
        e.glctx.viewport(0, 0, e.glcanvas.width, e.glcanvas.height);
        e.glctx.clearColor(1, 1, 1, 1);
        // e.glctx.enable(e.glctx.DEPTH_TEST); // Enable depth testing
        e.glctx.clear(e.glctx.COLOR_BUFFER_BIT);

        console.log("intial paint from scene")

        // e.ctx.clearRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
        // e.ctx.fillStyle = "blue";
        // e.ctx.fillRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
        // e.glctx.clearRect(this.canvasRect.x, this.canvasRect.y, this.canvasRect.w, this.canvasRect.h);
        // e.mainCtx.restore();
        // this.ctx.fillStyle = backgroundColor;
        // e.mainCtx.save();
        // console.log('initial paint from scene');

        super.paint(e);

    }
}

// export class SceneNavBarContextMenu extends ContextMenu {

//     public scene: Scene;

//     constructor(scene: Scene) {
//         super();
//         this.scene = scene;
//     }

//     protected constructMenu(): void {

//         var repaint = this.addAction("Replot");
//         repaint.addEventListener("click", e=> {
//             this.scene.replot();
//         });

//         var copy = this.addAction("Copy plot to clipboard");
//         copy.addEventListener("click", e => {
//             this.scene.bottomCanvas?.toBlob(blob => {
//                 if (blob) navigator.clipboard.write([new ClipboardItem({"image/png": blob})]);

//             });
//         });
//     }
// }


// export class SceneNavBar {

//     public scene: Scene;
//     public divElement: HTMLDivElement;
//     protected contextMenu?: ContextMenu;

//     constructor(scene: Scene) {
//         this.scene = scene;

//         this.divElement = document.createElement("div");
//         this.divElement.style.cssText = "width: 100%; height: 30px";
//         this.divElement.style.margin = "3px";
//         // this.divElement.style.backgroundColor = "rgb(100, 130, 130)";

//         this.setContextMenu();

//         var options = document.createElement('button');
//         options.classList.add("btn", "btn-dark", "btn-sm");
//         options.textContent = "...";
//         options.addEventListener('click', e => {
//             if (!this.contextMenu) return;

//             if (this.contextMenu.isVisible()) {
//                 this.contextMenu.hide();
//                 return;
//             }
//             var x = options.offsetLeft;
//             var y = options.offsetTop + options.offsetHeight;
//             this.contextMenu.show({x, y});
//         });

//         this.divElement.appendChild(options);
//     }

//     protected setContextMenu() {
//         this.contextMenu = new SceneNavBarContextMenu(this.scene);
//     }
// }