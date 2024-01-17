<script setup lang="ts">
import { provide } from "vue";
import TestComponent from "./components/TestComponent.vue";
import LeftPanel from "./components/LeftPanel.vue";
import CanvasComponent from "./components/CanvasComponent.vue";

provide("backendUrl", "http://localhost:6969/");
</script>

<template>
  <div>
    <LeftPanel :datasets="[{ name: 'a' }, { name: 'b' }]"></LeftPanel>
  </div>
  <div>
    <CanvasComponent
      :datasets="[{ name: 'a' }, { name: 'b' }]"
    ></CanvasComponent>
  </div>
  <TestComponent test=" test string to test test -------- ">abc</TestComponent>
</template>

<!-- <style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style> -->
