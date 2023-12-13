#pragma once

typedef struct
{
    unsigned char * iData;  // pointer to Image Data
    float * matrix;    // pointer to matrix data in in C-contiguous
    unsigned int rows;
    unsigned int cols;
}
Data;


typedef struct
{
    bool inverted;
    float * positions;    // pointer to positions of lut
    unsigned char * lut;  // pointer to lut
    unsigned int n;
}
Lut;

enum transform
{
    LIN = 0,
    LOG = 1,
    SYMLOG = 2,
};

typedef struct
{
    bool xInverted;    // if x axis is inverted
    bool yInverted;    // if y axis is inverted
    float linthresh;
    float linscale;
    float zmin;   // range on the colorbar
    float zmax;   //
    // unsigned int scale;
}
Params;

typedef struct
{
    float a;
    float b;
    float c;   // range on the colorbar
}
Test;