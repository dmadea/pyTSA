import { ContextMenu } from "./contextmenu";
import { Figure } from "./figure/figure";
import { Grid } from "./grid";
import {  GraphicObject, IMouseEvent, IPaintEvent } from "./object";
// import { Rect } from "./types";

// import wasmData from "./wasm/hello.wasm";
import wasmData from "./wasm/bin/color.wasm";
// import * as Module from "./wasm/hello";

// interface Hello extends CallableFunction {
//     (): number;
// }

export class Scene extends GraphicObject {

    private canvasResizeObserver: ResizeObserver;
    protected navBar?: SceneNavBar;

    protected setNavBar() {
        this.navBar = new SceneNavBar(this);
    }

    constructor(parentElement: HTMLDivElement) {
        super();
        
        var wrapper = document.createElement("div");
        wrapper.style.cssText = "position: relative; width: 100%; height: 1150px";

        this.setNavBar();

        var mainCanvas = document.createElement("canvas");
        var secCanvas = document.createElement("canvas");
        mainCanvas.style.position = "absolute";
        secCanvas.style.position = "absolute";

        mainCanvas.style.zIndex = "0";
        secCanvas.style.zIndex = "1";

        wrapper.appendChild(mainCanvas);
        wrapper.appendChild(secCanvas);
        if (this.navBar) parentElement.appendChild(this.navBar.divElement);
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
        this.initWasm();
    }

    public test() {
        if (!this.wasm) return;

        // var f = this.wasm.exports._Z5helloPim as CallableFunction;
        // var malloc = this.wasm.exports._Z7_mallocm as CallableFunction;
        // var free = this.wasm.exports._Z5_freePv as CallableFunction;


        // var len = 100;
        // var ptr = malloc(len);
        // console.log(ptr);

        // var arr = new Int32Array(this.wasm.memory.buffer, ptr, len);
        // for (let i = 0; i < len; i++) {
        //     arr[i] = i;
        // }
        // console.log(arr);
        // f(ptr, len);
        // console.log(arr);

        // free(ptr);


        // var ptr = f();
        // var arr = new Uint8Array(this.wasm.memory.buffer, ptr, 10);

        // var string = new TextDecoder()
        // console.log(arr);



    }

    public initWasm() {
        // WebAssembly.Instance

        var memory = new WebAssembly.Memory({
            initial: 1024,
            maximum: 1024
        })

        var opt = {
            js: {
                mem: memory
            },
            env: {
                emscripten_resize_heap: memory.grow,
                emscripten_notify_memory_growth: (delta: number) => console.log("memory has grown by ", delta)
                // wasi_snapshot_preview1:  {
                //     proc_exit: (a: number) => undefined,
                //     fd_close: (a: number) => 1,
                //     environ_sizes_get: (a: number, b: number) => 1,
                //     environ_get: (a: number, b: number) => 1
                // }
            }
        }   

        WebAssembly.instantiateStreaming(fetch(wasmData), opt).then(result => {
            const exports = result.instance.exports;

            this.setWasm({
                memory: exports.memory as WebAssembly.Memory,
                exports
            });

            console.log(this.wasm);

            this.test();

        });


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

export class SceneNavBarContextMenu extends ContextMenu {

    public scene: Scene;

    constructor(scene: Scene) {
        super();
        this.scene = scene;
    }

    protected constructMenu(): void {

        var repaint = this.addAction("Replot");
        repaint.addEventListener("click", e=> {
            this.scene.replot();
        });

        var copy = this.addAction("Copy plot to clipboard");
        copy.addEventListener("click", e => {
            this.scene.bottomCanvas?.toBlob(blob => {
                if (blob) navigator.clipboard.write([new ClipboardItem({"image/png": blob})]);

            });
        });
    }
}


export class SceneNavBar {

    public scene: Scene;
    public divElement: HTMLDivElement;
    protected contextMenu?: ContextMenu;

    constructor(scene: Scene) {
        this.scene = scene;

        this.divElement = document.createElement("div");
        this.divElement.style.cssText = "width: 100%; height: 30px";
        this.divElement.style.margin = "3px";
        // this.divElement.style.backgroundColor = "rgb(100, 130, 130)";

        this.setContextMenu();

        var options = document.createElement('button');
        options.classList.add("btn", "btn-dark", "btn-sm");
        options.textContent = "...";
        options.addEventListener('click', e => {
            if (!this.contextMenu) return;

            if (this.contextMenu.isVisible()) {
                this.contextMenu.hide();
                return;
            }
            var x = options.offsetLeft;
            var y = options.offsetTop + options.offsetHeight;
            this.contextMenu.show({x, y});
        });

        this.divElement.appendChild(options);
    }

    protected setContextMenu() {
        this.contextMenu = new SceneNavBarContextMenu(this.scene);
    }
}