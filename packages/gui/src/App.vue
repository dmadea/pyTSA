<script setup lang="ts">
import LeftPanel from "./components/LeftPanel.vue";
import TabWidget from "./components/TabWidget.vue";
import { Splitpanes, Pane } from "splitpanes"; // from https://antoniandre.github.io/splitpanes/?ref=madewithvuejs.com
import "splitpanes/dist/splitpanes.css";
import { GlobalState } from "./state";

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
