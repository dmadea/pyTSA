import { Matrix, NumberArray } from "@pytsa/ts-graph";
import { APICallPOST } from "./utils";
import { reactive } from "vue";

export interface Param {
  name: string,
  min: string,
  value: number,
  max: string,
  error: number,
  fixed: boolean
}

export interface Option {
  name: string,
  backendName: string,
  type: string,
  value: string | number | boolean,
  options?: string[], // for type select
  min?: number,
  max?: number,
  step?: number
}

export interface OptionAPI {
  name: string,
  value: string | number | boolean
}

// export interface FitResults {
//   Cfit:  
// }

export class FitModel {

  public Cfit: Matrix | null = null;
  public STfit: Matrix | null = null;
  public Dfit: Matrix | null = null;

  public backendUrl: string;
  public tabIndex: number;
  public isFitting: boolean = false;
  public params: Param[] = reactive<Param[]>([]);
  public options: Option[] = reactive<Option[]>([]);

  constructor(backendUrl: string, tabIndex: number) {
    this.backendUrl = backendUrl;
    this.tabIndex = tabIndex;
    this.setOptions();
  }

  public fit() {
    APICallPOST(`${this.backendUrl}/api/fit_model/${this.tabIndex}`, null, (obj) => {
      this.isFitting = false;
    });
    this.isFitting = true;
  }

  public simulateModel() {
    APICallPOST(`${this.backendUrl}/api/simulate_model/${this.tabIndex}`, null, (obj) => {
    });
  }
  
  public updateModelOptions(optionIndex?: number) {
    var data = {};
    if (optionIndex) {
      data = {[this.options[optionIndex].backendName]: this.options[optionIndex].value}
    } else {
      for (const op of this.options) {
        data = {...data, [op.backendName]: op.value};
      }
    }
    console.log(data);
    APICallPOST(`${this.backendUrl}/api/update_model_options/${this.tabIndex}`, JSON.stringify(data), (obj) => {
      this.params = [...this.params, ...obj as Param[]];
    });
  }

  public updateModelParams(paramIndex: number) {
    const data = JSON.stringify(this.params[paramIndex]);
    APICallPOST(`${this.backendUrl}/api/update_model_param/${this.tabIndex}`, data);
  }

  public setOptions() {
    this.options = [...this.options,
      {
        name: "Fitting algorithm",
        backendName: "fit_algorithm",
        type: "select",
        value: "least_squares",
        options: ["leastsq", "least_squares", "differential_evolution", "brute", "basinhopping", "ampgo", "nelder", "lbfgsb", 
                "powell", "cg", "newton", "cobyla", "bfgs"]
      },
    ];
  }

}

export class FirstOrderModel extends FitModel {


public setOptions(): void {
  super.setOptions();
  this.options = [ ...this.options,
    {
      name: "Number of species",
      backendName: "n_species",
      type: "number",
      value: 1,
      step: 1,
      min: 1,
      max: 20
    },
    {
      name: "Central wavelength",
      backendName: "central_wave",
      type: "number",
      value: 500,
      step: 1
    },
    {
      name: "Include chirp",
      backendName: "include_chirp",
      type: "checkbox",
      value: false,
    },
    {
      name: "Chirp type",
      backendName: "chirp_type",
      type: "select",
      value: 'exp',
      options: ['poly', 'exp']
    },
    {
      name: "Number of polynomials (for poly chirp type)",
      backendName: "num_of_poly_chirp_params",
      type: "number",
      value: 5,
      min: 1,
      step: 1
    },
    {
      name: "Number of exponentials (for exp chirp type)",
      backendName: "num_of_exp_chirp_params",
      type: "number",
      value: 2,
      min: 1,
      step: 1
    },
    {
      name: "Include IRF",
      backendName: "include_irf",
      type: "checkbox",
      value: false,
    },
    {
      name: "IRF type",
      backendName: "irf_type",
      type: "select",
      value: 'Gaussian',
      options: ['Gaussian']
    },
    {
      name: "Include variable FWHM",
      backendName: "include_variable_fwhm",
      type: "checkbox",
      value: false,
    },
    {
      name: "Number of polynomials (for variable FWHM)",
      backendName: "num_of_poly_varfwhm_params",
      type: "number",
      value: 3,
      min: 1,
      step: 1
    },
    {
      name: "Include coherent artifacts",
      backendName: "include_artifacts",
      type: "checkbox",
      value: false,
    },
    {
      name: "Number of artifacts",
      backendName: "artifact_order",
      type: "number",
      value: 2,
      min: 0,
      max: 3,
      step: 1
    },
    {
      name: "Ridge regularization alpha",
      backendName: "ridge_alpha",
      type: "number",
      value: 0.0001,
      min: 0,
      step: 0.0001
    },
    
  ]
}

}

