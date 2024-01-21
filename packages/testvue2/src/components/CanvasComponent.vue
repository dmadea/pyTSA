<script setup lang="ts">
import { SceneUser } from "@/sceneuser";
import { defineProps, inject, ref, onMounted, watch } from "vue";
import { v4 } from "uuid";
import { Scene, Dataset } from "@pytsa/ts-graph";

const props = defineProps({
  datasets: {
    type: Array,
    required: false,
  },
  // tabindex: {
  //   type: Number,
  //   required: true,
  // },
  // currentTab: {
  //   type: Number,
  //   required: true,
  // },
});

const id = v4();

var scene: SceneUser | null = null;

watch(props, (old) => {
  console.log("some change", old);

  if (!scene) return;

  if (scene.datasets !== props.datasets) {
    scene.datasets = props.datasets as Dataset[];
    scene.processDatasets();
  }
});

onMounted(() => {
  const canvasDiv = document.getElementById(id) as HTMLDivElement;
  scene = new SceneUser(canvasDiv);
  console.log("on mounted");
});
</script>

<template>
  <div>
    <div :id="id"></div>
    <!-- <p>Canvas component here, index {{ tabindex }}</p> -->
  </div>
</template>

<style></style>
