<script setup lang="ts">
import { SceneUser } from "@/sceneuser";
import { defineProps, inject, ref, onMounted } from "vue";

onMounted(() => {
  const canvasDiv = document.getElementById("canvas") as HTMLDivElement;
  const scene = new SceneUser(canvasDiv);
});

const props = defineProps({
  datasets: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <div>
    <div id="canvas"></div>
  </div>
</template>

<style></style>
