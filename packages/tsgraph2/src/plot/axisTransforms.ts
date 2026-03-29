import { F32Array } from "../array.js";

export type AxisScale =
  | "Linear"
  | "Logarithmic"
  | "Symmetric logarithmic"
  | "Data bound";

export type AxisAlignment = "Horizontal" | "Vertical";

export interface AxisSettings {
  label: string;
  scale: AxisScale;
  symlogLinthresh: number;
  symlogLinscale: number;
  inverted: boolean;
  autoscale: boolean;
  keepCentered: boolean;
}

export function defaultAxisSettings(label = ""): AxisSettings {
  return {
    label,
    scale: "Linear",
    symlogLinthresh: 1,
    symlogLinscale: 1,
    inverted: false,
    autoscale: true,
    keepCentered: false,
  };
}

/** Dummy axis value → real data value (matches frontend_svelte axis.svelte). */
export function axisForward(
  scale: AxisScale,
  linthresh: number,
  linscale: number,
  scaleArray: Float32Array | null
): (n: number) => number {
  switch (scale) {
    case "Linear":
      return (n: number) => n;
    case "Logarithmic":
      return (n: number) => 10 ** n;
    case "Symmetric logarithmic":
      return (n: number) => {
        if (Math.abs(n) <= linthresh) {
          return n;
        }
        const sign = n >= 0 ? 1 : -1;
        return (
          sign * linthresh * 10 ** (linscale * (Math.abs(n) / linthresh - 1))
        );
      };
    case "Data bound": {
      if (!scaleArray?.length) {
        return (n: number) => n;
      }
      const arr = scaleArray;
      return (n: number) => {
        const i = Math.min(arr.length - 1, Math.max(0, Math.round(n)));
        return arr[i]!;
      };
    }
  }
}

/** Real data value → dummy axis value. */
export function axisInverse(
  scale: AxisScale,
  linthresh: number,
  linscale: number,
  scaleArray: Float32Array | null
): (n: number) => number {
  switch (scale) {
    case "Linear":
      return (n: number) => n;
    case "Logarithmic":
      return (n: number) => (n <= 0 ? -5 : Math.log10(n));
    case "Symmetric logarithmic":
      return (n: number) => {
        if (Math.abs(n) <= linthresh) {
          return n;
        }
        const sign = n >= 0 ? 1 : -1;
        return (
          sign * linthresh * (1 + Math.log10(Math.abs(n) / linthresh) / linscale)
        );
      };
    case "Data bound": {
      if (!scaleArray?.length) {
        return (n: number) => n;
      }
      const fa = F32Array.fromArray(scaleArray);
      return (n: number) => fa.nearestIndex(n);
    }
  }
}
