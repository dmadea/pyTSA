
export class Scene {
    protected canvas: HTMLCanvasElement;
    protected ctx: CanvasRenderingContext2D;

    public width() {
        return this.canvas.width;
    }

    public height() {
        return this.canvas.height;
    }

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2D') as CanvasRenderingContext2D;
    }

    init(){
        this.ctx.restore()
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
    }


}

// let message: string = 'Hello World';
// console.log(message);