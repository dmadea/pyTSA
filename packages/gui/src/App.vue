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
import { GlobalState } from "./state";

const backendUrl = "http://localhost:6969/";
provide("backendUrl", backendUrl);

const state = new GlobalState();
</script>

<template>
  <splitpanes style="height: 100%">
    <pane min-size="10" size="100">
      <LeftPanel
        :state="state"
      ></LeftPanel>
    </pane>
    <pane min-size="10" size="500">
      <TabWidget
        :state="state"
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
