<script setup lang="ts">
import { provide, reactive, ref, computed } from "vue";
// import TestComponent from "./components/TestComponent.vue";
import LeftPanel from "./components/LeftPanel.vue";
// import CanvasComponent from "./components/CanvasComponent.vue";
import TabWidget from "./components/TabWidget.vue";
import { Dataset } from "@pytsa/ts-graph";
import { Splitpanes, Pane } from "splitpanes"; // from https://antoniandre.github.io/splitpanes/?ref=madewithvuejs.com
import "splitpanes/dist/splitpanes.css";

provide("backendUrl", "http://localhost:6969/");

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

const checkedChanged = (index: number) => {
  const selTab = data.value.tabs[data.value.activeTab];
  if (selTab.selectedDatasets.includes(index)) {
    selTab.selectedDatasets = selTab.selectedDatasets.filter(
      (entry) => entry !== index
    );
  } else {
    selTab.selectedDatasets.push(index);
  }
};
</script>

<template>
  <splitpanes style="height: 100%">
    <pane min-size="10">
      <LeftPanel
        :datasets="data.datasets"
        :checked="checkedDatasets"
        @datasets-loaded="datasetsLoaded"
        @checked-changed="checkedChanged"
      ></LeftPanel>
    </pane>
    <pane min-size="10">
      <TabWidget
        :data="data"
        @add-new-tab="addNewTab"
        @tab-index-changed="tabIndexChanged"
      ></TabWidget>
    </pane>
    <pane min-size="10">
      <h4>Fit widget</h4>
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
