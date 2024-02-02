<script setup lang="ts">
import { defineProps, onMounted, onUnmounted, PropType} from "vue";
// import { CanvasView, Scene } from "@pytsa/ts-graph";

const props = defineProps({
  canvasview: {
    type: Object, // as PropType<CanvasView<Scene>>,
    required: true,
  },
});

onMounted(() => {
  props.canvasview.mount();
  console.log(`Graph ${props.canvasview.id} mounted.`);
});

onUnmounted(() => {
  console.log(`Graph ${props.canvasview.id} unmounted.`);
});
</script>

<template>
  <div>
    <div :id="canvasview.id"></div>
  </div>
</template>

<style></style>
