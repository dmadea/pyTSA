<script setup lang="ts">
import { defineProps, onMounted, onUnmounted, PropType} from "vue";
import { CanvasView } from "./canvasview";

const props = defineProps({
  canvasview: {
    type: Object as PropType<CanvasView>,
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
    <!-- <p>Canvas component here, index {{ tabindex }}</p> -->
  </div>
</template>

<style></style>
