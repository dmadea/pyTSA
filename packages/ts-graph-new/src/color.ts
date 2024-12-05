

export interface Color {
    r: number,
    g: number,
    b: number,
    alpha: number
}



export const WEBGLColormaps = `
vec4 jet(float x) {
    vec3 a, b;
    float c;
    if (x < 0.34) {
        a = vec3(0, 0, 0.5);
        b = vec3(0, 0.8, 0.95);
        c = (x - 0.0) / (0.34 - 0.0);
    } else if (x < 0.64) {
        a = vec3(0, 0.8, 0.95);
        b = vec3(0.85, 1, 0.04);
        c = (x - 0.34) / (0.64 - 0.34);
    } else if (x < 0.89) {
        a = vec3(0.85, 1, 0.04);
        b = vec3(0.96, 0.7, 0);
        c = (x - 0.64) / (0.89 - 0.64);
    } else {
        a = vec3(0.96, 0.7, 0);
        b = vec3(0.5, 0, 0);
        c = (x - 0.89) / (1.0 - 0.89);
    }
    return vec4(mix(a, b, c), 1.0);
}

vec4 fire(float x) {
    vec3 a, b;
    float c;
    if (x < 0.040) {
        a = vec3(0.000, 0.000, 0.000);
        b = vec3(0.153, 0.001, 0.000);
        c = (x - 0.000) / (0.040 - 0.000);
    } else if (x < 0.400) {
        a = vec3(0.153, 0.001, 0.000);
        b = vec3(0.750, 0.028, 0.000);
        c = (x - 0.040) / (0.400 - 0.040);
    } else if (x < 0.450) {
        a = vec3(0.750, 0.028, 0.000);
        b = vec3(0.841, 0.043, 0.000);
        c = (x - 0.400) / (0.450 - 0.400);
    } else if (x < 0.510) {
        a = vec3(0.841, 0.043, 0.000);
        b = vec3(0.942, 0.097, 0.000);
        c = (x - 0.450) / (0.510 - 0.450);
    } else if (x < 0.600) {
        a = vec3(0.942, 0.097, 0.000);
        b = vec3(0.996, 0.347, 0.000);
        c = (x - 0.510) / (0.600 - 0.510);
    } else if (x < 0.750) {
        a = vec3(0.996, 0.347, 0.000);
        b = vec3(1.000, 0.653, 0.004);
        c = (x - 0.600) / (0.750 - 0.600);
    } else if (x < 0.850) {
        a = vec3(1.000, 0.653, 0.004);
        b = vec3(1.000, 0.814, 0.025);
        c = (x - 0.750) / (0.850 - 0.750);
    } else if (x < 0.920) {
        a = vec3(1.000, 0.814, 0.025);
        b = vec3(1.000, 0.924, 0.074);
        c = (x - 0.850) / (0.920 - 0.850);
    } else if (x < 0.945) {
        a = vec3(1.000, 0.924, 0.074);
        b = vec3(1.000, 0.959, 0.167);
        c = (x - 0.920) / (0.945 - 0.920);
    } else {
        a = vec3(1.000, 0.959, 0.167);
        b = vec3(1.000, 1.000, 1.000);
        c = (x - 0.945) / (1.000 - 0.945);
    } 
    return vec4(mix(a, b, c), 1.0);
}

vec4 fusion(float x) {
    vec3 a, b;
    float c;
    if (x < 0.060) {
        a = vec3(0.153, 0.016, 0.070);
        b = vec3(0.327, 0.024, 0.183);
        c = (x - 0.000) / (0.060 - 0.000);
    } else if (x < 0.130) {
        a = vec3(0.327, 0.024, 0.183);
        b = vec3(0.528, 0.071, 0.189);
        c = (x - 0.060) / (0.130 - 0.060);
    } else if (x < 0.200) {
        a = vec3(0.528, 0.071, 0.189);
        b = vec3(0.678, 0.228, 0.142);
        c = (x - 0.130) / (0.200 - 0.130);
    } else if (x < 0.280) {
        a = vec3(0.678, 0.228, 0.142);
        b = vec3(0.785, 0.437, 0.151);
        c = (x - 0.200) / (0.280 - 0.200);
    } else if (x < 0.400) {
        a = vec3(0.785, 0.437, 0.151);
        b = vec3(0.845, 0.763, 0.572);
        c = (x - 0.280) / (0.400 - 0.280);
    } else if (x < 0.500) {
        a = vec3(0.845, 0.763, 0.572);
        b = vec3(1.000, 1.000, 1.000);
        c = (x - 0.400) / (0.500 - 0.400);
    } else if (x < 0.600) {
        a = vec3(1.000, 1.000, 1.000);
        b = vec3(0.606, 0.819, 0.869);
        c = (x - 0.500) / (0.600 - 0.500);
    } else if (x < 0.710) {
        a = vec3(0.606, 0.819, 0.869);
        b = vec3(0.277, 0.597, 0.870);
        c = (x - 0.600) / (0.710 - 0.600);
    } else if (x < 0.850) {
        a = vec3(0.277, 0.597, 0.870);
        b = vec3(0.360, 0.193, 0.770);
        c = (x - 0.710) / (0.850 - 0.710);
    } else if (x < 0.900) {
        a = vec3(0.360, 0.193, 0.770);
        b = vec3(0.337, 0.045, 0.606);
        c = (x - 0.850) / (0.900 - 0.850);
    } else if (x < 0.950) {
        a = vec3(0.337, 0.045, 0.606);
        b = vec3(0.221, 0.068, 0.368);
        c = (x - 0.900) / (0.950 - 0.900);
    } else {
        a = vec3(0.221, 0.068, 0.368);
        b = vec3(0.095, 0.038, 0.195);
        c = (x - 0.950) / (1.000 - 0.950);
    }  
    return vec4(mix(a, b, c), 1.0);
}

vec4 viridis(float x) {
    vec3 a, b;
    float c;
    if (x < 0.100) {
        a = vec3(0.267, 0.005, 0.329);
        b = vec3(0.283, 0.141, 0.458);
        c = (x - 0.000) / (0.100 - 0.000);
    } else if (x < 0.200) {
        a = vec3(0.283, 0.141, 0.458);
        b = vec3(0.254, 0.265, 0.530);
        c = (x - 0.100) / (0.200 - 0.100);
    } else if (x < 0.400) {
        a = vec3(0.254, 0.265, 0.530);
        b = vec3(0.164, 0.471, 0.558);
        c = (x - 0.200) / (0.400 - 0.200);
    } else if (x < 0.550) {
        a = vec3(0.164, 0.471, 0.558);
        b = vec3(0.119, 0.611, 0.539);
        c = (x - 0.400) / (0.550 - 0.400);
    } else if (x < 0.600) {
        a = vec3(0.119, 0.611, 0.539);
        b = vec3(0.135, 0.659, 0.518);
        c = (x - 0.550) / (0.600 - 0.550);
    } else if (x < 0.650) {
        a = vec3(0.135, 0.659, 0.518);
        b = vec3(0.186, 0.705, 0.485);
        c = (x - 0.600) / (0.650 - 0.600);
    } else if (x < 0.750) {
        a = vec3(0.186, 0.705, 0.485);
        b = vec3(0.369, 0.789, 0.383);
        c = (x - 0.650) / (0.750 - 0.650);
    } else if (x < 0.900) {
        a = vec3(0.369, 0.789, 0.383);
        b = vec3(0.741, 0.873, 0.150);
        c = (x - 0.750) / (0.900 - 0.750);
    } else if (x < 0.950) {
        a = vec3(0.741, 0.873, 0.150);
        b = vec3(0.876, 0.891, 0.095);
        c = (x - 0.900) / (0.950 - 0.900);
    } else {
        a = vec3(0.876, 0.891, 0.095);
        b = vec3(0.993, 0.906, 0.144);
        c = (x - 0.950) / (1.000 - 0.950);
    } 
    return vec4(mix(a, b, c), 1.0);
}

vec4 symgradUniform(float x) {
    if (x <= 0.5) {
        return fusion(1.0 - x);
    } else {
        return fire(1.0 - (x - 0.5) * 1.8); 
    }
}

vec4 symgrad(float x) {
    vec3 a, b;
    float c;
    if (x < 0.34) {
        a = vec3(0, 0, 0.5);
        b = vec3(0, 0.8, 0.95);
        c = (x - 0.0) / (0.34 - 0.0);
    } else if (x < 0.64) {
        a = vec3(0, 0.8, 0.95);
        b = vec3(1.0, 1.0, 1.0);
        c = (x - 0.34) / (0.64 - 0.34);
    } else if (x < 0.89) {
        a = vec3(1.0, 1.0, 1.0);
        b = vec3(0.96, 0.7, 0);
        c = (x - 0.64) / (0.89 - 0.64);
    } else {
        a = vec3(0.96, 0.7, 0);
        b = vec3(0.5, 0, 0);
        c = (x - 0.89) / (1.0 - 0.89);
    }
    return vec4(mix(a, b, c), 1.0);
}

vec4 magma(float x) {
    vec3 a, b;
    float c;
    if (x < 0.060) {
        a = vec3(0.001, 0.000, 0.014);
        b = vec3(0.036, 0.028, 0.125);
        c = (x - 0.000) / (0.060 - 0.000);
    } else if (x < 0.130) {
        a = vec3(0.036, 0.028, 0.125);
        b = vec3(0.118, 0.066, 0.286);
        c = (x - 0.060) / (0.130 - 0.060);
    } else if (x < 0.200) {
        a = vec3(0.118, 0.066, 0.286);
        b = vec3(0.232, 0.060, 0.438);
        c = (x - 0.130) / (0.200 - 0.130);
    } else if (x < 0.280) {
        a = vec3(0.232, 0.060, 0.438);
        b = vec3(0.360, 0.088, 0.497);
        c = (x - 0.200) / (0.280 - 0.200);
    } else if (x < 0.400) {
        a = vec3(0.360, 0.088, 0.497);
        b = vec3(0.550, 0.161, 0.506);
        c = (x - 0.280) / (0.400 - 0.280);
    } else if (x < 0.500) {
        a = vec3(0.550, 0.161, 0.506);
        b = vec3(0.716, 0.215, 0.475);
        c = (x - 0.400) / (0.500 - 0.400);
    } else if (x < 0.620) {
        a = vec3(0.716, 0.215, 0.475);
        b = vec3(0.895, 0.310, 0.394);
        c = (x - 0.500) / (0.620 - 0.500);
    } else if (x < 0.710) {
        a = vec3(0.895, 0.310, 0.394);
        b = vec3(0.972, 0.454, 0.361);
        c = (x - 0.620) / (0.710 - 0.620);
    } else if (x < 0.800) {
        a = vec3(0.972, 0.454, 0.361);
        b = vec3(0.995, 0.624, 0.427);
        c = (x - 0.710) / (0.800 - 0.710);
    } else {
        a = vec3(0.995, 0.624, 0.427);
        b = vec3(0.987, 0.991, 0.750);
        c = (x - 0.800) / (1.000 - 0.800);
    } 
    return vec4(mix(a, b, c), 1.0);
}


vec4 colormap(float x, int colormap) {

    if (colormap == 0) { 
        return jet(x);
    } else if (colormap == 1) {  
        return symgrad(x);
    } else if (colormap == 2) {  
        return fire(x);
    } else if (colormap == 3) {  
        return fusion(x);
    } else if (colormap == 4) {  
        return viridis(x);
    } else if (colormap == 5) {  
        return symgradUniform(x);
    } else if (colormap == 6) {  
        return magma(x);
    }
}
`

export const Colormaps: Colormap[] = [
    {
        index: 0,
        name: "Jet"
    },
    {
        index: 1,
        name: "Symgrad"
    },
    {
        index: 2,
        name: "U-Fire"
    },
    {
        index: 3,
        name: "U-Fusion"
    },
    {
        index: 4,
        name: "U-Viridis"
    },
    {
        index: 5,
        name: "U-Fusion/Fire"
    },
    {
        index: 6,
        name: "U-Magma"
    },
]

export interface Colormap {
    index: number,
    name: string
}




const defaultColors: string[] = [
    "rgb(255, 0, 0)",  // red
    "rgb(0, 255, 0)",  // green
    "rgb(0, 0, 255)",  // blue
    "rgb(0, 0, 0)",  // black
    "rgb(255, 255, 0)",  // yellow
    "rgb(255, 0, 255)",  // magenta
    "rgb(0, 255, 255)",  // cyan
    "rgb(155, 155, 155)",  // gray
    "rgb(155, 0, 0)",  // dark red
    "rgb(0, 155, 0)",  // dark green
    "rgb(0, 0, 155)",  // dark blue
    "rgb(155, 155, 0)",  // dark yellow
    "rgb(155, 0, 155)",  // dark magenta
    "rgb(0, 155, 155)"  // dark cyan
]

export function getDefaultColor(index: number): string {
    return defaultColors[index % defaultColors.length];
}

// from https://stackoverflow.com/questions/8022885/rgb-to-hsv-color-in-javascript
function rgb2hsv(r: number, g: number, b: number): [number, number, number] {
    let v = Math.max(r,g,b), c=v-Math.min(r,g,b);
    let h= c && ((v==r) ? (g-b)/c : ((v==g) ? 2+(b-r)/c : 4+(r-g)/c)); 
    return [60*(h<0?h+6:h), v&&c/v, v];
}

// from https://gist.github.com/mjackson/5311256
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    var r = 0;
    var g = 0;
    var b = 0;
  
    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);
  
    switch (i % 6) {
      case 0: r = v, g = t, b = p; break;
      case 1: r = q, g = v, b = p; break;
      case 2: r = p, g = v, b = t; break;
      case 3: r = p, g = q, b = v; break;
      case 4: r = t, g = p, b = v; break;
      case 5: r = v, g = p, b = q; break;
    }
  
    return [ r * 255, g * 255, b * 255 ];
}

export function hsvColor(index: number, hues: number = 10, values=1, maxValue=255,
       minValue=150, maxHue=360, minHue=0, sat=255, reversed=false): string {

    let ind = index % (hues * values);
    let indh = ind % hues
    let indv = ind // hues
    let v, h;
    if (values > 1) {
        v = minValue + indv * ((maxValue - minValue) / (values - 1));
    } else {
        v = maxValue;
    }

    if (reversed) {
        h = minHue + ((hues - indh - 1) * (maxHue - minHue)) / hues;
    } else {
        h = minHue + (indh * (maxHue - minHue)) / hues;
    }
    const [r, g, b] = hsvToRgb(h, sat, v);
    return `rgb(${r}, ${g}, ${b})`;
}

interface ILutEntry {
    pos: number,   // position
    r: number,
    g: number,
    b: number,
    a: number
};

export interface ILut extends Array<ILutEntry> {};



// export class Colormap {
//     // https://stackoverflow.com/questions/48468620/dynamically-get-class-members-names-and-values-using-typescript-or-javascript

//     // https://github.com/matplotlib/matplotlib/blob/v3.8.2/lib/matplotlib/_cm.py

//     // static seismic: ILut = [
//     //     {pos: 0, r: 0, g: 0, b: 150, a: 255},
//     //     {pos: 0.25, r: 0, g: 0, b: 255, a: 255},
//     //     {pos: 0.5, r: 255, g: 255, b: 255, a: 255},
//     //     {pos: 0.75, r: 255, g: 0, b: 0, a: 255},    
//     //     {pos: 1, r: 150, g: 0, b: 0, a: 255}
//     // ];

//     public lut: ILut;
//     public inverted: boolean = false;
//     public name: string

//     static fromName(name: string, inverted: boolean = false): Colormap {
//         return new Colormap(Colormaps.getLut(name), inverted, name)
//     }

//     constructor (lut: ILut, inverted: boolean = false, name: string) {
//         this.name = name
//         this.lut = lut
//         this.inverted = inverted;
//     }

//     public getColor(position: number): [number, number, number, number] {
//         const colormap = this.lut;
        
//         if (this.inverted) position = 1 - position;

//         if (position <= 0) {
//             return [colormap[0].r, colormap[0].g, colormap[0].b, colormap[0].a];
//         } else if (position >= 1) {
//             const i = colormap.length - 1;
//             return [colormap[i].r, colormap[i].g, colormap[i].b, colormap[i].a];
//         }
    
//         for (var i = 0; i < colormap.length - 1; i++) {
//             if (colormap[i].pos <= position && position <= colormap[i + 1].pos){
//                 break;
//             }
//         }
    
//         const x = (position - colormap[i].pos) / (colormap[i+1].pos - colormap[i].pos);
        
//         return [
//             x * colormap[i+1].r + (1 - x) * colormap[i].r,
//             x * colormap[i+1].g + (1 - x) * colormap[i].g,
//             x * colormap[i+1].b + (1 - x) * colormap[i].b,
//             x * colormap[i+1].a + (1 - x) * colormap[i].a
//         ];
//     }

//     // static getStringColor(position: number, lut: ILut): string {
//     //     const cmap = new Colormap(lut);
//     //     const rgba = cmap.getColor(position);
//     //     return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3]})`;
//     // }
// }

