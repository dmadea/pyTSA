import { Dataset, Matrix, NumberArray, Scene, formatNumber } from "@pytsa/ts-graph";
import { APICallPOST } from "./utils";
import { reactive, shallowReactive, ref, shallowRef } from "vue";
import { v4 } from "uuid";
import { FirstOrderModel, FitModel, IParam, IOption } from "./fitmodel";
import { DataView, FitView } from "./dataviews";

export interface TabData {
  selectedDatasets: number[],
  fitParams: IParam[],
  fitOptions: IOption[]
}

export interface Data {
  activeTab: number,
  tabs: TabData[],
}

export interface IView {
  dataview: DataView,
  fitview: FitView,
  fitmodel: FitModel
}

export class GlobalState  {

  public backendUrl: string = "http://localhost:6969/";
  public data = reactive<Data>({
    activeTab: 0,
    tabs: [],
  });

  public datasets = shallowRef<Dataset[]>([]);
  public views: IView[] = [];

  constructor() {
    this.addNewTab();
  }

  get activeTab(): TabData {
    return this.data.tabs[this.data.activeTab]
  }

  get activeDataView(): DataView {
    return this.views[this.data.activeTab].dataview;
  }

  get activeFitView(): FitView {
    return this.views[this.data.activeTab].fitview;
  }

  // get activeFitModel(): FitModel {
  //   return this.views[this.data.activeTab].fitmodel;
  // }

  public addNewTab () {
    const index = this.data.tabs.length;
    this.views.push({
      dataview: new DataView(this, this.backendUrl, index),
      fitview: new FitView(this, this.backendUrl, index),
      fitmodel: new FirstOrderModel(this, this.backendUrl, index),
    });
    this.data = {activeTab: index,
       tabs: [...this.data.tabs, {
          selectedDatasets: [],
          fitParams: [],
          fitOptions: []
        }
      ]};
  };

  public tabIndexChanged(index: number) {
    this.data.activeTab = index;
  };

  public loadDatasets(datasets: Dataset[]) {
    this.datasets.value = [...this.datasets.value, ...datasets];
  }

  public updateDatasets(datasets: Dataset[]) {
    this.datasets.value = datasets;
  }

  public leftPanelCheckedChanged = (index: number) => {
    const selTab = this.activeTab;
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
    APICallPOST(`${this.backendUrl}api/clear`);
    for (let i = 0; i < this.data.tabs.length; i++) {
      this.views[i].dataview.clear();
      this.data.tabs[i].selectedDatasets = [];
    }
    this.datasets.value = [];
  };

  public kineticModelChanged(model: typeof FitModel) {
    const m = new model(this, this.backendUrl, this.data.activeTab);
    this.views[this.data.activeTab].fitmodel = m;
    APICallPOST(`${this.backendUrl}/api/set_model/${this.data.activeTab}/${model.backendName}`);
    m.updateModelOptions();
  };

}
