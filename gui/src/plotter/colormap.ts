
interface IColorMapItem {
    pos: number,   // position
    r: number,
    g: number,
    b: number,
    a: number
};

export interface IColorMap extends Array<IColorMapItem> {};

export class Colormap {

    static seismic: IColorMap = [
        {pos: 0, r: 0, g: 0, b: 150, a: 255},
        {pos: 0.25, r: 0, g: 0, b: 255, a: 255},
        {pos: 0.5, r: 255, g: 255, b: 255, a: 255},
        {pos: 0.75, r: 255, g: 0, b: 0, a: 255},
        {pos: 1, r: 150, g: 0, b: 0, a: 255}
    ];
    
    static symgrad: IColorMap = [
        {pos: 0, r: 75, g: 0, b: 130, a: 255},
        {pos: 0.333, r: 0, g: 0, b: 255, a: 255},
        {pos: 0.5, r: 255, g: 255, b: 255, a: 255},
        {pos: 0.625, r: 255, g: 255, b: 0, a: 255},
        {pos: 0.75, r: 255, g: 165, b: 0, a: 255},
        {pos: 0.875, r: 255, g: 0, b: 0, a: 255},
        {pos: 1, r: 150, g: 0, b: 0, a: 255}
    ];
    
    static symgradTorquise: IColorMap = [
        {pos: 0, r: 75, g: 0, b: 130, a: 255},
        {pos: 0.29, r: 0, g: 0, b: 255, a: 255},
        {pos: 0.38, r: 0, g: 255, b: 255, a: 255},
        {pos: 0.5, r: 255, g: 255, b: 255, a: 255},
        {pos: 0.625, r: 255, g: 255, b: 0, a: 255},
        {pos: 0.75, r: 255, g: 165, b: 0, a: 255},
        {pos: 0.875, r: 255, g: 0, b: 0, a: 255},
        {pos: 1, r: 150, g: 0, b: 0, a: 255}
    ];

    static getColor(position: number, colormap: IColorMap): [number, number, number, number] {
        if (position <= 0) {
            return [colormap[0].r, colormap[0].g, colormap[0].b, colormap[0].a];
        } else if (position >= 1) {
            let i = colormap.length - 1;
            return [colormap[i].r, colormap[i].g, colormap[i].b, colormap[i].a];
        }
    
        for (var i = 0; i < colormap.length - 1; i++) {
            if (colormap[i].pos === position) break;
            if (colormap[i].pos < position && position <= colormap[i + 1].pos){
                break;
            }
        }
    
        let x = (position - colormap[i].pos) / (colormap[i+1].pos - colormap[i].pos);
        
        return [
            x * colormap[i+1].r + (1 - x) * colormap[i].r,
            x * colormap[i+1].g + (1 - x) * colormap[i].g,
            x * colormap[i+1].b + (1 - x) * colormap[i].b,
            x * colormap[i+1].a + (1 - x) * colormap[i].a
        ];
    }
}