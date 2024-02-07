import { Dataset, Matrix, NumberArray, formatNumber } from "@pytsa/ts-graph";
import { APICallPOST, IMatrixData, json2arr, parseMatrixData } from "../utils";
import { GlobalState, ITabData } from "../state";

export interface IParam {
  name: string,
  min: string,
  value: string | number,
  max: string,
  error: number | null,
  fixed: boolean
}

export interface IOption {
  name: string,
  backendName: string,
  type: string,
  value: string | number | boolean,
  options?: string[], // for type select
  min?: number,
  max?: number,
  step?: number
}

export interface IFitData {
  matrices: {
    CfitDAS: IMatrixData,
    STfitDAS: IMatrixData,
    CfitEAS?: IMatrixData,
    STfitEAS?: IMatrixData,
    Dfit: IMatrixData,
    LDM?: IMatrixData
  },
  params: IParam[],
  chirpData?: string
}

function formatParams(params: IParam[]): IParam[] {
  // console.log(params);
  for (const param of params) {
    param.value = formatNumber(param.value as number, 4);
    param.error = formatNumber(param.error ?? 0, 4);
  }
  return params;
}


export class FitModel {

  public static modelName: string = "...";
  public static backendName: string = "...";

  public tabIndex: number;
  public state: GlobalState;

  constructor(state: GlobalState, tabIndex: number) {
    this.state = state;
    this.tabIndex = tabIndex;
    
    this.tabData.fitOptions = this.setOptions();
    this.updateModelOptions();
  }

  get tabData(): ITabData {
    return this.state.data.tabs[this.tabIndex];
  }

  private plotFitMatrices(obj: IFitData) {
    // fitted dataset
    const ds = this.state.views[this.tabIndex].dataview.getDataset(this.tabData.selectedDatasets[0]);

    const Cfit = parseMatrixData(obj.matrices.CfitDAS);
    const STfit = parseMatrixData(obj.matrices.STfitDAS);
    const Dfit = parseMatrixData(obj.matrices.Dfit);

    const CfitEAS: Matrix | undefined = obj.matrices.CfitEAS ? parseMatrixData(obj.matrices.CfitEAS) : undefined;
    const STfitEAS: Matrix | undefined = obj.matrices.STfitEAS ? parseMatrixData(obj.matrices.STfitEAS) : undefined;

    const chirp = obj.chirpData ? json2arr(obj.chirpData) : undefined;

    const resDataset = new Dataset(Matrix.mSubtract(ds.data, Dfit), ds.x.copy(), ds.y.copy());
    const fitDataset = new Dataset(Dfit, ds.x.copy(), ds.y.copy());
    this.state.activeDataView.updateFitData(fitDataset, chirp);
    this.state.activeFitView.updateData(ds.x, ds.y, Cfit, STfit, resDataset, CfitEAS, STfitEAS);
  }

  public fit() {
    if (this.tabData.selectedDatasets.length === 0) return;
    APICallPOST(`fit_model/${this.tabIndex}`, null, (obj: IFitData) => {
      this.state.activeTabData.isFitting = false;
      this.tabData.fitParams = formatParams(obj.params);
      this.plotFitMatrices(obj);
    });
    this.state.activeTabData.isFitting = true;
  }

  public simulateModel() {
    if (this.tabData.selectedDatasets.length === 0) return;
    APICallPOST(`simulate_model/${this.tabIndex}`, null, (obj: IFitData) => {
      console.log(obj);
      this.plotFitMatrices(obj);
    });
  }

  public estimateChirpParams() {
    const points = this.state.activeDataView.getChirpSelectionData();
    if (!points) return;

    const data = {
      x: points.map(p => p.x),
      y: points.map(p => p.y)
    }

    APICallPOST(`estimate_chirp_params/${this.tabIndex}`, data, (obj: IFitData) => {
      this.tabData.fitParams = formatParams(obj.params);
    });
  }

  public optionChanged(value: string | boolean | number, index: number) {
    this.tabData.fitOptions[index].value = value;
    this.updateModelOptions(index);
  }

  public paramMinChanged(value: string, index: number, invalid: boolean) {
    this.tabData.fitParams[index].min = value;
    if (!invalid)
      this.updateModelParams(index);
  }

  public paramMaxChanged(value: string, index: number, invalid: boolean) {
    this.tabData.fitParams[index].max = value;
    if (!invalid)
      this.updateModelParams(index);
  }

  public paramValueChanged(value: string, index: number, invalid: boolean) {
    this.tabData.fitParams[index].value = value;
    if (!invalid)
      this.updateModelParams(index);
  }

  public paramFixedChanged(value: boolean, index: number) {
    this.tabData.fitParams[index].fixed = value;
    this.updateModelParams(index);
  }

  public updateModelOptions(optionIndex?: number) {
    var data = {};
    if (optionIndex) {
      data = {[this.tabData.fitOptions[optionIndex].backendName]: this.tabData.fitOptions[optionIndex].value}
    } else {
    }
    for (const op of this.tabData.fitOptions) {
      data = {...data, [op.backendName]: op.value};
    }
    APICallPOST(`update_model_options/${this.tabIndex}`, data, (obj: IFitData) => {
      this.tabData.fitParams = formatParams(obj.params);
    });
  }

  public updateModelParams(paramIndex: number) {
    const data = this.tabData.fitParams[paramIndex];
    APICallPOST(`update_model_param/${this.tabIndex}`, data);
  }

  public setOptions(): IOption[] {
    return [
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

  public static modelName: string = "First order";
  public static backendName: string = "first_order";


public setOptions(): IOption[] {
  return [ ...super.setOptions(),
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
      max: 20,
      step: 1
    },
    {
      name: "Number of exponentials (for exp chirp type)",
      backendName: "num_of_exp_chirp_params",
      type: "number",
      value: 1,
      min: 1,
      max: 10,
      step: 1
    },
    {
      name: "Include IRF",
      backendName: "include_irf",
      type: "checkbox",
      value: true,
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


export class FirstOrderModelLPL extends FirstOrderModel {

  public static modelName: string = "First order with LPL";
  public static backendName: string = "first_order_lpl";

  public setOptions(): IOption[] {
    return [ ...super.setOptions(),
      {
        name: "Include LPL profile",
        backendName: "include_LPL",
        type: "checkbox",
        value: true,
      },
      
    ]
  }
  
  }