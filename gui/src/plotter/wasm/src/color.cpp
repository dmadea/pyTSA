// #include <stdio.h>
#include <emscripten.h>
// #include <cstdint>
// #include <iostream>
#include "types.h"
#include "math.h"

int main() {

    // printf("asidjoasd\n");
    return 0;
}

// emcc -O3  color.cpp -o ../bin/color.wasm  -s STANDALONE_WASM --no-entry -s ALLOW_MEMORY_GROWTH -s MAXIMUM_MEMORY=1GB

extern "C" {
bool abc(bool a);
bool recalculateImage(unsigned char * iData, float * matrix, size_t rows, size_t cols, float * pos, unsigned char * lut, size_t nlut,
                float zlim0, float zlim1);

void * _malloc(size_t n);
void _free(void * ptr);

}

EMSCRIPTEN_KEEPALIVE
bool abc(bool a) {
    return a;
}


// EMSCRIPTEN_KEEPALIVE
void getColor(float pos, Lut * lut, unsigned char * result) {

    if (lut->inverted)
        pos = 1.0f - pos;

    if (pos <= 0.0f) {
        result[0] = lut->lut[0];  // r
        result[1] = lut->lut[1];  // g
        result[2] = lut->lut[2];  // b
        result[3] = lut->lut[3];  // a
        return;
    } else if (pos >= 1.0f) {
        int k = 4 * (lut->n - 1);
        result[0] = lut->lut[k];  // r
        result[1] = lut->lut[k + 1];  // g
        result[2] = lut->lut[k + 2];  // b
        result[3] = lut->lut[k + 3];  // a
        return;
    }

    int i = (int)(pos * (lut->n - 1));   // calculate estimate of the index
    if (lut->positions[i] > pos) { // decrement
        for (; i >= 0; i--) {
            if (lut->positions[i] <= pos && pos <= lut->positions[i + 1]) {
                break;
            }
        }
    } else if (lut->positions[i + 1] < pos) {  // increment
        for (; i < lut->n - 1; i++) {
            if (lut->positions[i] <= pos && pos <= lut->positions[i + 1]) {
                break;
            }
        }
    }

    float x = (pos - lut->positions[i]) / (lut->positions[i + 1] - lut->positions[i]);

    result[0] = (unsigned char)(x * lut->lut[4 * (i + 1)] +     (1 - x) * lut->lut[4 * i]);  // r
    result[1] = (unsigned char)(x * lut->lut[4 * (i + 1) + 1] + (1 - x) * lut->lut[4 * i + 1]);  // g
    result[2] = (unsigned char)(x * lut->lut[4 * (i + 1) + 2] + (1 - x) * lut->lut[4 * i + 2]);  // b
    result[3] = (unsigned char)(x * lut->lut[4 * (i + 1) + 3] + (1 - x) * lut->lut[4 * i + 3]);  // a
}

// inline float tr(float z, Params *params) {

//     switch (params->scale)
//     {
//     case LIN:
//         return z;
//     case LOG:
//         return (z <= 0) ? -5.0f : log10(z);
//     case SYMLOG:
//         float ztr;
//         if (abs(z) <= params->linthresh) {
//             ztr = z;
//         } else {
//             bool negative = z < 0;
//             ztr = params->linthresh * (1 + log10(abs(z) / params->linthresh) / params->linscale);
//             if (negative)
//                 ztr = -ztr;
//         }
//         return ztr;
//     }
// }


EMSCRIPTEN_KEEPALIVE
bool recalculateImage(Data * data, Lut * lut, Params * params, Test *test) {
    
    float zdiff = params->zmax - params->zmin;
    float a = test->a;
    float b = test->b;
    float c = test->c;


    for(size_t row = 0; row < data->rows; row++) {
        for(size_t col = 0; col < data->cols; col++) {

            // size_t i = row * data->cols + col;        // position in a C-contiguous data matrix
            
            // y axis is inverted in default because of different coordinate system
            int r = row; // params->yInverted ? row : data->rows - row - 1;
            int c = col; // params->xInverted ? data->cols - col - 1 : col;

            float z = data->matrix[r * data->cols + c];

            // transform
            // float zrel = (tr(z, params) - params->zmin) / zdiff;
            float zrel = (z - params->zmin) / zdiff;


            unsigned char *iDataPos = data->iData + 4 * (row * data->cols + col);  // position in a buffer
            getColor(zrel, lut, iDataPos); // fill color to the buffer
        }
    }
    return true;
}


EMSCRIPTEN_KEEPALIVE
void * _malloc(size_t n) {
    return malloc(n);
}

EMSCRIPTEN_KEEPALIVE
void _free(void * ptr) {
    free(ptr);
}
