<script setup lang="ts">
import { SceneUser } from "@/sceneuser";
import { defineProps, inject, ref, onMounted } from "vue";

const props = defineProps({
  datasets: {
    type: Object,
    required: false,
  },
  tabindex: {
    type: Number,
    required: true,
  },
  currentTab: {
    type: Number,
    required: true,
  },
});

onMounted(() => {
  const canvasDiv = document.getElementById(
    `canvas${props.tabindex}`
  ) as HTMLDivElement;
  const scene = new SceneUser(canvasDiv);
});
</script>

<template>
  <div>
    <div :id="`canvas${tabindex}`"></div>
    <p>Canvas component here, index {{ tabindex }}</p>
  </div>
</template>

<style></style>
