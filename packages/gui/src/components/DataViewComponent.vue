<script setup lang="ts">
import { defineProps, onMounted, onUnmounted, PropType} from "vue";
import { DataView } from "../dataviews";

const props = defineProps({
  dataview: {
    type: Object as PropType<DataView>,
    required: true,
  },
});

onMounted(() => {
  props.dataview.mount();
  console.log(`Graph ${props.dataview.id} mounted.`);
});

onUnmounted(() => {
  console.log(`Graph ${props.dataview.id} unmounted.`);
});
</script>

<template>
  <div>
    <div :id="dataview.id"></div>
    <!-- <p>Canvas component here, index {{ tabindex }}</p> -->
  </div>
</template>

<style></style>
