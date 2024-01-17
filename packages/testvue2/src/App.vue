<template>
  <TestComponent test=" test string to test test -------- ">abc</TestComponent>
</template>

<script setup lang="ts">
import { provide } from "vue";
import TestComponent from "./components/TestComponent.vue";

provide("backendUrl", "http://localhost:6969/");
</script>

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
