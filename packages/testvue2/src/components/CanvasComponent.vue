<script setup lang="ts">
import { SceneUser } from "@/sceneuser";
import {
  defineProps,
  inject,
  ref,
  onMounted,
  watch,
  onUnmounted,
  defineEmits,
} from "vue";
import { v4 } from "uuid";
import { Dataset } from "@pytsa/ts-graph";

const props = defineProps({
  datasets: {
    type: Array,
    required: true,
  },
});

const id = v4();

const emit = defineEmits<{
  (
    e: "interface",
    iface: {
      addDataset: (index: number) => void;
      removeDataset: (index: number) => void;
    }
  ): void;
}>();

onMounted(() => {
  const canvasDiv = document.getElementById(id) as HTMLDivElement;
  const scene = new SceneUser(canvasDiv);
  console.log(`Graph ${id} mounted.`);

  var assignedDatasets: any[] = [];

  emit("interface", {
    addDataset: (index: number) => {
      console.log(`addDataset called ${index}, id: ${id}`);

      assignedDatasets.push({
        dataset: (props.datasets[index] as Dataset).copy(),
        index,
      });

      scene.datasets = assignedDatasets.map((d) => d.dataset);
      scene.processDatasets();
    },
    removeDataset: (index: number) => {
      console.log(`removeDataset called ${index}, id: ${id}`);
      assignedDatasets = assignedDatasets.filter((d) => d.index !== index);
      scene.datasets = assignedDatasets.map((d) => d.dataset);
      scene.processDatasets();
    },
  });
});

onUnmounted(() => {
  console.log(`Graph ${id} unmounted.`);
});
</script>

<template>
  <div>
    <div :id="id"></div>
    <!-- <p>Canvas component here, index {{ tabindex }}</p> -->
  </div>
</template>

<style></style>
