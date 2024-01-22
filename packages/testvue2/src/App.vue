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

const backendUrl = "http://localhost:6969/";
provide("backendUrl", backendUrl);

// interface DatasetData {
//   datasetData: Dataset | null;
//   checked: boolean;
// }

interface TabData {
  selectedDatasets: number[];
}

interface Data {
  activeTab: number;
  tabs: TabData[];
  datasets: Dataset[];
}

const data = ref<Data>({
  activeTab: 0,
  tabs: [
    {
      selectedDatasets: [],
    },
  ],
  datasets: [],
});

const datasetsLoaded = (ds: Dataset[]) => {
  data.value.datasets = [...data.value.datasets, ...ds];
};

const datasetsUpdated = (ds: Dataset[]) => {
  data.value.datasets = ds;
};

const checkedDatasets = computed<boolean[]>(() => {
  const selTab = data.value.tabs[data.value.activeTab];
  const isChecked: boolean[] = [];
  for (let i = 0; i < data.value.datasets.length; i++) {
    isChecked.push(selTab.selectedDatasets.includes(i));
  }

  return isChecked;
});

const addNewTab = () => {
  data.value.tabs.push({
    selectedDatasets: [],
  });
  data.value.activeTab = data.value.tabs.length - 1;
};

const tabIndexChanged = (index: number) => {
  data.value.activeTab = index;
};

var canvasInterfaces: any[] = [];

const getCanvasInterfaces = (ifaces: any[]) => {
  canvasInterfaces = ifaces;
};

const checkedChanged = (index: number) => {
  const selTab = data.value.tabs[data.value.activeTab];
  if (selTab.selectedDatasets.includes(index)) {
    selTab.selectedDatasets = selTab.selectedDatasets.filter(
      (entry) => entry !== index
    );
    // remove dataset from tab
    canvasInterfaces[data.value.activeTab].removeDataset(index);
    APICallPOST(
      `${backendUrl}api/remove_dataset/${index}/${data.value.activeTab}`
    );
  } else {
    selTab.selectedDatasets = [...selTab.selectedDatasets, index];
    // add dataset to tab
    canvasInterfaces[data.value.activeTab].addDataset(index);
    // sync with a backend
    APICallPOST(
      `${backendUrl}api/add_dataset/${index}/${data.value.activeTab}`
    );
  }
};
</script>

<template>
  <splitpanes style="height: 100%">
    <pane min-size="10" size="100">
      <LeftPanel
        :datasets="data.datasets"
        :checked="checkedDatasets"
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
        @canvas-interfaces="getCanvasInterfaces"
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
