<script setup lang="ts">
import { provide, reactive, ref, computed } from "vue";
// import TestComponent from "./components/TestComponent.vue";
import LeftPanel from "./components/LeftPanel.vue";
// import CanvasComponent from "./components/CanvasComponent.vue";
import TabWidget from "./components/TabWidget.vue";
import { Dataset } from "@pytsa/ts-graph";
import { Splitpanes, Pane } from "splitpanes"; // from https://antoniandre.github.io/splitpanes/?ref=madewithvuejs.com
import "splitpanes/dist/splitpanes.css";
import { APICallPOST } from "./utils";
import { FirstOrderModel, FitModel } from "./fitmodel";
import { DataView } from "./dataviews";

const backendUrl = "http://localhost:6969/";
provide("backendUrl", backendUrl);

// interface DatasetData {
//   datasetData: Dataset | null;
//   checked: boolean;
// }

export interface TabData {
  selectedDatasets: number[],
  fitmodel: FitModel,
  dataview: DataView
}

export interface Data {
  activeTab: number,
  tabs: TabData[],
  datasets: Dataset[]
}

const data = reactive<Data>({
  activeTab: 0,
  tabs: [
    {
      selectedDatasets: [],
      fitmodel: new FirstOrderModel(backendUrl, 0),
      dataview: new DataView(backendUrl, 0)
    },
  ],
  datasets: [],
});

const datasetsLoaded = (ds: Dataset[]) => {
  data.datasets = [...data.datasets, ...ds];
};

const datasetsUpdated = (ds: Dataset[]) => {
  data.datasets = ds;
};

const checkedDatasets = computed<boolean[]>(() => {
  const selTab = data.tabs[data.activeTab];
  const isChecked: boolean[] = [];
  for (let i = 0; i < data.datasets.length; i++) {
    isChecked.push(selTab.selectedDatasets.includes(i));
  }

  return isChecked;
});

const modelChanged = (model: typeof FitModel) => {
  const m = new model(backendUrl, data.activeTab);
  data.tabs[data.activeTab].fitmodel = m;
  APICallPOST(`${backendUrl}/api/set_model/${data.activeTab}/${model.backendName}`);
  m.updateModelOptions();
};

const addNewTab = () => {
  data.tabs.push({
    selectedDatasets: [],
    fitmodel: new FirstOrderModel(backendUrl, data.tabs.length),
    dataview: new DataView(backendUrl, data.tabs.length)
  });
  data.activeTab = data.tabs.length - 1;
};

const tabIndexChanged = (index: number) => {
  data.activeTab = index;
};

const checkedChanged = (index: number) => {
  const selTab = data.tabs[data.activeTab];
  if (selTab.selectedDatasets.includes(index)) {
    selTab.selectedDatasets = selTab.selectedDatasets.filter((entry) => entry !== index);
    // remove dataset from tab
    data.tabs[data.activeTab].dataview.removeDataset(index);
  } else {
    selTab.selectedDatasets = [...selTab.selectedDatasets, index];
    // add dataset to tab and sync with backend
    data.tabs[data.activeTab].dataview.addDataset(index, data.datasets as Dataset[]);
  }
};

const clear = () => {
  APICallPOST(`${backendUrl}api/clear`);
  for (let i = 0; i < data.tabs.length; i++) {
    data.tabs[i].dataview.clear();
    data.tabs[i] = {
        selectedDatasets: [],
        fitmodel: new FirstOrderModel(backendUrl, i),
        dataview: new DataView(backendUrl, i)
    };
  }
  data.datasets = [];
};

</script>

<template>
  <splitpanes style="height: 100%">
    <pane min-size="10" size="100">
      <LeftPanel
        :datasets="data.datasets"
        :checked="checkedDatasets"
        @clear="clear"
        @datasets-loaded="datasetsLoaded"
        @checked-changed="checkedChanged"
        @datasets-updated="datasetsUpdated"
      ></LeftPanel>
    </pane>
    <pane min-size="10" size="500">
      <TabWidget
        :data="data"
        @add-new-tab="addNewTab"
        @tab-index-changed="tabIndexChanged"
        @model-changed="modelChanged"
      ></TabWidget>
    </pane>
  </splitpanes>
</template>

<style>
/* #app {
  font-family: Avenir, Helvetica, Arial, sans-seif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
} */

body {
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 0;
}

.splitpanes__splitter {
  background-color: #ccc;
  position: relative;
}

.container-flex {
  /* width: 100%;  */
  height: 90%;
  display: flex;
  background-color: white;
}

.left {
  width: 40%;
  min-width: 150px;
}

.right {
  flex: 1;
  height: 100%;
}
</style>
