import { Dataset } from "@pytsa/ts-graph";
import { APICallPOST } from "./utils";
import { reactive, shallowReactive, ref, shallowRef } from "vue";
import { FirstOrderModel, FitModel, IParam, IOption, FirstOrderModelLPL } from "./dataview/fitmodel";
import { DataView, FitView } from "./dataview/dataviews";

export interface ITabData {
  selectedDatasets: number[],
  fitParams: IParam[],
  fitOptions: IOption[]
  selectedFitModel: number,
  activePanel: number,
  isFitting: boolean
}

export interface IData {
  activeTab: number,
  tabs: ITabData[],
}

export interface IView {
  dataview: DataView,
  fitview: FitView,
  fitmodel: FitModel
}

export class GlobalState  {

  public data = reactive<IData>({
    activeTab: 0,
    tabs: [],
  });

  public datasets = shallowRef<Dataset[]>([]);
  public views: IView[] = [];
  public kineticModels: (typeof FitModel)[] = [FirstOrderModel, FirstOrderModelLPL];

  constructor() {
    this.addNewTab();
  }

  get activeTabData(): ITabData {
    return this.data.tabs[this.data.activeTab]
  }

  get activeDataView(): DataView {
    return this.views[this.data.activeTab].dataview;
  }

  get activeFitView(): FitView {
    return this.views[this.data.activeTab].fitview;
  }

  get activeFitModel(): FitModel {
    return this.views[this.data.activeTab].fitmodel;
  }

  public addNewTab () {
    const index = this.data.tabs.length;
    this.data.tabs = [...this.data.tabs, {
      selectedDatasets: [],
      fitParams: [],
      fitOptions: [],
      selectedFitModel: 0,
      activePanel: 0,
      isFitting: false
    }];
    const fitmodel: typeof FitModel = this.kineticModels[this.data.tabs[index].selectedFitModel];
    this.views.push({
      dataview: new DataView(this, index),
      fitview: new FitView(this, index),
      fitmodel: new fitmodel(this, index),
    });
    this.data.activeTab = index;
    // TODO create a new model in backend
  };

  public tabIndexChanged(index: number) {
    this.data.activeTab = index;
  };

  public panelChanged(index: number) {
    this.activeTabData.activePanel = index;
  }

  public loadDatasets(datasets: Dataset[]) {
    this.datasets.value = [...this.datasets.value, ...datasets];
  }

  public updateDatasets(datasets: Dataset[]) {
    this.datasets.value = datasets;
  }

  public leftPanelCheckedChanged = (index: number) => {
    const selTab = this.activeTabData;
    if (selTab.selectedDatasets.includes(index)) {
      selTab.selectedDatasets = selTab.selectedDatasets.filter((entry: number) => entry !== index);
      // remove dataset from tab
      this.activeDataView.removeDataset(index);
    } else {
      selTab.selectedDatasets = [...selTab.selectedDatasets, index];
      // add dataset to tab and sync with backend
      this.activeDataView.addDataset(index);
    }
  };

  public clear () {
    APICallPOST('clear');
    for (let i = 0; i < this.data.tabs.length; i++) {
      this.views[i].dataview.clear();
      this.data.tabs[i].selectedDatasets = [];
    }
    this.datasets.value = [];
  };

  public kineticModelChanged(index: number) {
    const m = new this.kineticModels[index](this, this.data.activeTab);
    this.views[this.data.activeTab].fitmodel = m;
    this.activeTabData.selectedFitModel = index;
    APICallPOST(`set_model/${this.data.activeTab}/${this.kineticModels[index].backendName}`);
    // console.log(this.activeTab);
  };

}
