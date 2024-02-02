// copied from https://github.com/niklasvh/base64-arraybuffer/blob/master/src/index.ts
// also help from https://stackoverflow.com/questions/21797299/convert-base64-string-to-arraybuffer

import { NumberArray, Matrix, Dataset } from "@pytsa/ts-graph";

const chars =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Use a lookup table to find the index.
const lookup = typeof Uint8Array === "undefined" ? [] : new Uint8Array(256);
for (let i = 0; i < chars.length; i++) {
  lookup[chars.charCodeAt(i)] = i;
}

export const b64encode = (arraybuffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(arraybuffer);
  let i,
    base64 = "";
  const len = bytes.length;

  for (i = 0; i < len; i += 3) {
    base64 += chars[bytes[i] >> 2];
    base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
    base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
    base64 += chars[bytes[i + 2] & 63];
  }

  if (len % 3 === 2) {
    base64 = base64.substring(0, base64.length - 1) + "=";
  } else if (len % 3 === 1) {
    base64 = base64.substring(0, base64.length - 2) + "==";
  }

  return base64;
};

export const b64decode = (base64: string): ArrayBuffer => {
  const len = base64.length;
  let bufferLength = base64.length * 0.75,
    i,
    p = 0,
    encoded1,
    encoded2,
    encoded3,
    encoded4;

  if (base64[base64.length - 1] === "=") {
    bufferLength--;
    if (base64[base64.length - 2] === "=") {
      bufferLength--;
    }
  }

  const arraybuffer = new ArrayBuffer(bufferLength),
    bytes = new Uint8Array(arraybuffer);

  for (i = 0; i < len; i += 4) {
    encoded1 = lookup[base64.charCodeAt(i)];
    encoded2 = lookup[base64.charCodeAt(i + 1)];
    encoded3 = lookup[base64.charCodeAt(i + 2)];
    encoded4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }

  return arraybuffer;
};

export function json2arr(base64: string): NumberArray {
  const buffer = b64decode(base64);
  return NumberArray.fromTypedArray(new Float64Array(buffer));
}

export function arr2json(arr: NumberArray): string {
  const f64arr = arr.toFloat64Array();
  return b64encode(f64arr.buffer);
}

// improve reading of file
// https://stackoverflow.com/questions/23331546/how-to-use-javascript-to-read-local-text-file-and-read-line-by-line
export function loadData(
  text: string,
  delimiter = "\t",
  newLine = "\n"
): Dataset | null {
  let rowData: NumberArray = new NumberArray();
  const colData = new NumberArray();
  const data = new NumberArray();

  // console.log(data);
  const lines = text.split(newLine);
  let ncols: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const entries = lines[i].split(delimiter);

    if (!ncols) {
      ncols = entries.length - 1;
      rowData = new NumberArray(ncols);
      for (let j = 1; j < ncols + 1; j++) {
        rowData[j - 1] = parseFloat(entries[j]);
      }
      continue;
    }

    if (entries.length !== ncols + 1) {
      // console.log(i, lines.length);
      if (i > 1) break;
      throw TypeError(
        "Number of entries does not match the number of columns."
      );
    }

    colData.push(parseFloat(entries[0]));

    for (let j = 1; j < ncols + 1; j++) {
      data.push(parseFloat(entries[j]));
    }
  }

  if (!ncols) return null;

  const dataset = new Dataset(
    new Matrix(colData.length, ncols, data),
    rowData,
    colData
  );
  // console.log(dataset)

  return dataset;
}

export async function loadFiles(
  files: FileList,
  callback: (datasets: Dataset[]) => void
) {
  if (!files) return [];

  const datasets: Dataset[] = [];
  const processed: boolean[] = new Array<boolean>(files.length);
  processed.fill(false);
  // var names: string[] = [];

  // console.log(processed);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const reader = new FileReader();
    const index = i;
    // console.time("start loading");
    reader.addEventListener("load", function (e) {
      if (!(typeof reader.result === "string")) return;

      const ext = file.name.split(".").pop()?.toLowerCase();

      const dataset = loadData(reader.result, ext === "csv" ? "," : "\t");
      // dataset?.transpose();
      // console.timeEnd("start loading");

      if (ext === "txt") {
        dataset?.transpose();
      }
      processed[index] = true;
      // names[index] = file.name;

      if (dataset) {
        dataset.name = file.name;
        datasets[index] = dataset;
      }

      // console.log(index, "processing", file);

      if (processed.every((entry) => entry)) {
        callback(datasets);
      }
    });
    reader.readAsBinaryString(file);
    // reader.readAsArrayBuffer(file);
  }
}

export interface IMatrixData {
  data: string,
  c_contiguous: boolean
}

export interface IDatasetData {
  data: {
    datasets: {
      times: string,
      wavelengths: string,
      matrix: IMatrixData,
      name: string
    }[]
  }
}

export function parseMatrixData(obj: IMatrixData, nrows: number, ncols: number): Matrix {
  const mat = new Matrix(nrows, ncols, json2arr(obj.data));
  mat.isCContiguous = obj.c_contiguous;
  return mat;
}

export function parseDatasets(obj: IDatasetData): Dataset[] {
  const datasets: Dataset[] = [];

  for (const d of obj.data.datasets) {
    var t = json2arr(d.times);
    var w = json2arr(d.wavelengths);
    var mat = parseMatrixData(d.matrix, t.length, w.length);

    datasets.push(new Dataset(mat, w, t, d.name));
  }

  return datasets
}

export function APICall(apicall: string, method: string, data2send?: any | null, callback?: (obj: any) => void) {
  const xhr = new XMLHttpRequest();
  const backendUrl: string = "http://localhost:6969/";

  xhr.onreadystatechange = () => {
    if (xhr.readyState == 4 && xhr.status == 201) {
      if (xhr.response) {
        var obj = JSON.parse(xhr.response);
        if (callback) callback(obj);
      }
      // console.log("Success");
    }
  };
  // asynchronous requests
  xhr.open(method, `${backendUrl}/api/${apicall}`, true);
  if (data2send) {
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhr.send(JSON.stringify(data2send));
  } else {
    // Send the request over the network
    xhr.send(null);
  }
}

export function APICallPOST(apicall: string, data2send?: any | null, callback?: (obj: any) => void) {
  APICall(apicall, 'POST', data2send, callback);
}

export function APICallGET(apicall: string, data2send?: any | null, callback?: (obj: any) => void) {
  APICall(apicall, 'GET', data2send, callback);
}

