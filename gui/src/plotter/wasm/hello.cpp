#include <stdio.h>
#include <emscripten.h>
#include <string> 
#include <sstream>
#include <string.h>
// emcc -O3  hello.cpp -o hello.wasm  -s STANDALONE_WASM --no-entry

int main() {

    // printf("asidjoasd\n");
    return 0;
}



EMSCRIPTEN_KEEPALIVE
void hello(int * arr, size_t n) {

    for (size_t i = 0; i < n; i++)
    {
        arr[i] /= 10;
    }

    // printf("Oijasodi asidoa sijodiajsodi\n");
}

EMSCRIPTEN_KEEPALIVE
int abcde(char * buffer, size_t size) {

    std::string text(buffer, size);
    std::istringstream iss(text);

    // char * p = buffer;

    // int i = 0;
    // while(*p != ',') {
    //     ++i;
    //     ++p;
    // }
    // ++p;

    return text.length();

}

EMSCRIPTEN_KEEPALIVE
void * _malloc(size_t n) {
    return malloc(n);
}

EMSCRIPTEN_KEEPALIVE
void _free(void * ptr) {
    free(ptr);
}
