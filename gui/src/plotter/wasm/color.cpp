// #include <stdio.h>
#include <emscripten.h>
// #include <cstdint>
// #include <iostream>

int main() {

    // printf("asidjoasd\n");
    return 0;
}

// emcc -O3  color.cpp -o color.wasm  -s STANDALONE_WASM --no-entry -s ALLOW_MEMORY_GROWTH -s MAXIMUM_MEMORY=1GB

// if (this.inverted) position = 1 - position;


// for (var i = 0; i < colormap.length - 1; i++) {
//     if (colormap[i].pos === position) break;
//     if (colormap[i].pos < position && position <= colormap[i + 1].pos){
//         break;
//     }
// }

// const x = (position - colormap[i].pos) / (colormap[i+1].pos - colormap[i].pos);

// return [
//     x * colormap[i+1].r + (1 - x) * colormap[i].r,
//     x * colormap[i+1].g + (1 - x) * colormap[i].g,
//     x * colormap[i+1].b + (1 - x) * colormap[i].b,
//     x * colormap[i+1].a + (1 - x) * colormap[i].a
// ];

extern "C" {
 void recalculateImage(unsigned char * iData, float * matrix, size_t rows, size_t cols, float * pos, unsigned char * lut, size_t nlut,
                float zlim0, float zlim1);

void * _malloc(size_t n);
void _free(void * ptr);
}


// EMSCRIPTEN_KEEPALIVE
void getColor(float position, float * pos, unsigned char * lut, size_t nlut, unsigned char * result) {
    if (position <= 0.0f) {
        result[0] = lut[0];  // r
        result[1] = lut[1];  // g
        result[2] = lut[2];  // b
        result[3] = lut[3];  // a
        return;
    } else if (position >= 1.0f) {
        int k = 4 * (nlut - 1);
        result[0] = lut[k];  // r
        result[1] = lut[k + 1];  // g
        result[2] = lut[k + 2];  // b
        result[3] = lut[k + 3];  // a
        return;
    }

    int i = (int)(position * (nlut - 1));   // calculate estimate of the index
    if (pos[i] > position) { // decrement
        for (; i >= 0; i--) {
            if (pos[i] <= position && position <= pos[i + 1]) {
                break;
            }
        }
    } else if (pos[i + 1] < position) {  // increment
        for (; i < nlut - 1; i++) {
            if (pos[i] <= position && position <= pos[i + 1]) {
                break;
            }
        }
    }

    float x = (position - pos[i]) / (pos[i + 1] - pos[i]);

    result[0] = (unsigned char)(x * lut[4 * (i + 1)] +     (1 - x) * lut[4 * i]);  // r
    result[1] = (unsigned char)(x * lut[4 * (i + 1) + 1] + (1 - x) * lut[4 * i + 1]);  // g
    result[2] = (unsigned char)(x * lut[4 * (i + 1) + 2] + (1 - x) * lut[4 * i + 2]);  // b
    result[3] = (unsigned char)(x * lut[4 * (i + 1) + 3] + (1 - x) * lut[4 * i + 3]);  // a


    // return idx;
}



EMSCRIPTEN_KEEPALIVE
void recalculateImage(unsigned char * iData, float * matrix, size_t rows, size_t cols, float * pos, unsigned char * lut, size_t nlut,
                float zlim0, float zlim1) {
    
    float zdiff = zlim1 - zlim0;

    for(size_t row = 0; row < rows; row++) {
        for(size_t col = 0; col < cols; col++) {

            size_t i = row * cols + col;        // position in a C-contiguous data matrix
            
            // y axis is inverted in default because of different coordinate system
            // const rowIdx = this.figure.yAxis.inverted ? row : h - row - 1;
            // const colIdx = this.figure.xAxis.inverted ? w - col - 1 : col;
            float z = matrix[i];
            float zrel = (z - zlim0) / zdiff;

            unsigned char *iDataPos = iData + 4 * i; // position in a buffer
            getColor(zrel, pos, lut, nlut, iDataPos);


            // const z = m.get(rowIdx, colIdx);
            // // console.log('row', row, 'col', col, z, m.isCContiguous);
            // let zrel = (this.transform) ? this.transform(z) : (z - zlim0) / limdiff; 

            // interpolate the rgba values
            // console.log(zScaled);

            // void getColor(float position, float * pos, unsigned char * lut, size_t nlut, unsigned char * result) {


            // iData[pos] = color[0];              // some R value [0, 255]
            // iData[pos + 1] = color[1];              // some G value
            // iData[pos + 2] = color[2];              // some B value
            // iData[pos + 3] = color[3];                  // set alpha channel
        }
    }


    // printf("Oijasodi asidoa sijodiajsodi\n");
}


EMSCRIPTEN_KEEPALIVE
void * _malloc(size_t n) {
    return malloc(n);
}

EMSCRIPTEN_KEEPALIVE
void _free(void * ptr) {
    free(ptr);
}
