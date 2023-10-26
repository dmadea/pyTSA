
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
        this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
        // console.log(this.ctx, this.canvas);
    }

    init(){
        this.ctx.restore();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
    }

    plotRect(){
        this.ctx.strokeRect(50, 50, 100, 50);

    }


}

// let message: string = 'Hello World';
// console.log(message);