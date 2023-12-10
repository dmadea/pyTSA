
#include <vector>
// #include <cstdio>
#include <iostream>
// #include <string> 
#include <fstream>
#include <sstream>

#include <chrono>
using namespace std::chrono;
using namespace std;

// #include <string.h>
// #include <stdio.h>
// #include <memory>

#include <string.h>
// #include <stdlib.h>


// from https://github.com/ben-strasser/fast-cpp-csv-parser/blob/master/csv.h
void parse_unsigned_integer(const char *col, int &x) {
  x = 0;
  while (*col != '\0') {
    if ('0' <= *col && *col <= '9') {
      double y = *col - '0';
      if (x > ((std::numeric_limits<double>::max)() - y) / 10) {
        return;
      }
      x = 10 * x + y;
    } else
      throw std::exception();
    ++col;
  }
}

// from https://github.com/ben-strasser/fast-cpp-csv-parser/blob/master/csv.h
void parse_signed_integer(const char *col, int &x) {
  if (*col == '-') {
    ++col;

    x = 0;
    while (*col != '\0') {
      if ('0' <= *col && *col <= '9') {
        double y = *col - '0';
        if (x < ((std::numeric_limits<double>::min)() + y) / 10) {
          return;
        }
        x = 10 * x - y;
      } else
        throw std::exception();
      ++col;
    }
    return;
  } else if (*col == '+')
    ++col;
  parse_unsigned_integer(col, x);
}

// from https://github.com/ben-strasser/fast-cpp-csv-parser/blob/master/csv.h
void parse_double(const char *col, double &x) {
  bool is_neg = false;
  if (*col == '-') {
    is_neg = true;
    ++col;
  } else if (*col == '+')
    ++col;

  x = 0;
  while ('0' <= *col && *col <= '9') {
    int y = *col - '0';
    x *= 10;
    x += y;
    ++col;
  }

  if (*col == '.' || *col == ',') {
    ++col;
    double pos = 1;
    while ('0' <= *col && *col <= '9') {
      pos /= 10;
      int y = *col - '0';
      ++col;
      x += y * pos;
    }
  }

  if (*col == 'e' || *col == 'E') {
    ++col;
    int e;

    parse_signed_integer(col, e);

    if (e != 0) {
      double base;
      if (e < 0) {
        base = double(0.1);
        e = -e;
      } else {
        base = double(10);
      }

      while (e != 1) {
        if ((e & 1) == 0) {
          base = base * base;
          e >>= 1;
        } else {
          x *= base;
          --e;
        }
      }
      x *= base;
    }
  } else {
    if (*col != '\0')
      throw std::exception();
  }

  if (is_neg)
    x = -x;
}

int main() {
    char a = '\0';
    std::cout << "Hello Word" << a << std::endl;

    size_t n = 0;
    // std::string fname = "FLD_DMRK23-3E+MB in MeOH.csv";
    std::string fname = "UV_DMRK23-3E+MB in MeOH-b_corr.csv";

    std::ifstream file(fname);
    // std::stringstream buffer;
    // buffer << file.rdbuf();
    // string allText = buffer.str();
    // file.close();

    std::vector<double> rowData = std::vector<double>();
    std::vector<double> colData = std::vector<double>();
    std::vector<double> data = std::vector<double>();

    // cout << allText << endl;

    auto start = high_resolution_clock::now();

    // FILE * f;
    // f = fopen(fname.c_str(), "r");
    // if (f == NULL) return -1;

    // const size_t Size = 256;
    // char chunk[Size];
    std::string line;
    std::istringstream s;

    int ncols = -1;

    while(getline(file, line)) {

        if (ncols == -1) {
            ncols++;
            char * token;
            token = strtok(&line[0], ",");
            while (token != NULL) {
            // cout << token << endl;
                double num;
                try {
                    parse_double(token, num); // custom written parse double is essential for fast parsing
                    rowData.push_back(num);
                } catch (const std::exception& e) {
                    // cout << e.what() << endl;
                    token = strtok(NULL, ",");
                    continue;
                }
                // cout << num << endl;
                token = strtok(NULL, ",");
            }

            colData.reserve(ncols);
            data.reserve(ncols * ncols);
            continue;
        }

        char * token;
        token = strtok(&line[0], ",");
        int i = 0;
        while (token != NULL) {
        // cout << token << endl;

            double num;
            try {
                parse_double(token, num);
                // num = atof(token);

                if (i == 0) {
                    colData.push_back(num);
                } else {
                    // data[i - 1] = num;
                    data.push_back(num);
                }

                // rowData.push_back(num);
            } catch (const std::exception& e) {
                // cout << e.what() << endl;
                // token = strtok(NULL, ",");
                // continue;
            }
            // cout << num << endl;
            token = strtok(NULL, ",");
            i++;
        }
    }

    auto stop = high_resolution_clock::now();
    auto duration = duration_cast<microseconds>(stop - start);
    // cout << duration.count() / 1000 << " ms" << endl;
    cout << data.size() << " " << rowData.size() << " " << colData.size() << " dur: " <<  duration.count() / 1000 << "ms" << endl;


    // if (file.is_open()) {
    //     string line;
    //     // char ch;

    //     std::vector<double> rowData = std::vector<double>();
    //     std::vector<double> colData = std::vector<double>();
    //     std::vector<double> data = std::vector<double>();

    //     int ncols = 0;

    //     while(getline(file, line)) {

    //         std::istringstream ss(line);

    //         // parse line by delimiter
    //         // if (ncols == 0) {
    //         //     // ncols = entries.length - 1;
    //         //     std::string token;
    //         //     while (std::getline(ss, token, ',')) {
    //         //         // cout << token << endl;
    //         //         ncols++;
    //         //         try {
    //         //             double value;
    //         //             parse_double(token.c_str(), value);
    //         //             rowData.push_back(value);
    //         //             // cout << " " << value << endl;
    //         //         } catch (const std::invalid_argument& e) {
    //         //             continue;
    //         //         } catch (const std::exception& e) {
    //         //             cout << e.what() << endl;
    //         //         }
    //         //         // error
    //         //     }

    //         //     if (ncols != rowData.size() + 1) {
    //         //         cout << " fail" << endl;
    //         //        return -1; // TODO
    //         //     } 

    //         //     colData.reserve(ncols);
    //         //     data.reserve(ncols * ncols);
    //         //     continue;
    //         // }

    //         // int i = 0;
    //         // // char * tok;
    //         // // tok = strtok(line.c_str(), ",");
    //         // std::string token;


    //         // while (std::getline(ss, token, ',')) {   // std::getline(ss, token, ',')
    //         //     double value = strtod(token.c_str(), NULL);
    //         //     // tok = strtok(NULL, ",");
    //         //     // cout << value << endl;

    //         //     // try {
    //         //     //     double value = std::stod(token);
    //         //     //     if (i == 0) {
    //         //     //         colData.push_back(value);
    //         //     //     } else {
    //         //     //         data.push_back(value);
    //         //     //     }
    //         //     //     i++;
    //         //     // } catch (const std::invalid_argument& e) {
    //         //     //     return -1;
    //         //     // }
    //         // }
    //         // cout << line << endl;
    //     }
    //     auto stop = high_resolution_clock::now();
    //     auto duration = duration_cast<microseconds>(stop - start);
    //     cout << data.size() << " " << rowData.size() << " " << colData.size() << " dur: " <<  duration.count() / 1000 << "ms" << endl;

    //     // for (size_t i = 0; i < rowData.size(); i++)
    //     // {
    //     //     cout << rowData[i] << endl;
    //     // }
        
    // }


    // auto arr = std::vector<int>();
    // arr.reserve(100);
    // cout << &arr << endl;
    
    

    // for (size_t i = 0; i < 101; i++)
    // {
    //     // std::cout << std::to_string(arr[i]) << std::endl;
    //     // cout << 1 << endl;
    //     arr.push_back(i);
    //     cout << arr[i] << " " << std::to_string(arr.size()) << " " << arr.capacity() << endl;

    // }
    

    // printf("Hello Word");
    return 1;
}

