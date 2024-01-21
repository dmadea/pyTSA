<script setup lang="ts">
import { defineProps, inject, ref, defineEmits, computed } from "vue";
import CanvasComponent from "./CanvasComponent.vue";
import { Dataset } from "@pytsa/ts-graph";

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
});

const datasets = computed(() => {
  const ret = [];
  for (const tab of props.data.tabs) {
    ret.push(
      props.data.datasets.filter((dataset: Dataset, index: number) =>
        tab.selectedDatasets.includes(index)
      )
    );
  }
  return ret;
});

const emit = defineEmits<{
  (e: "addNewTab"): void;
  (e: "tabIndexChanged", value: number): void;
  // (e: 'update', value: string): void
}>();
</script>

<template>
  <div class="card">
    <div class="card-header">
      <ul class="nav nav-tabs card-header-tabs">
        <li v-for="(tab, index) in data.tabs" :key="index" class="nav-item">
          <button
            class="nav-link"
            :class="{ active: index === data.activeTab }"
            aria-current="true"
            @click="emit('tabIndexChanged', index)"
          >
            {{ `Set ${1 + index}` }}
          </button>
        </li>
        <li class="nav-item">
          <a
            class="nav-link"
            @click="emit('addNewTab')"
            aria-current="true"
            href="#"
            >+</a
          >
        </li>
      </ul>
    </div>
    <div class="card-body">
      <!-- <h5 class="card-title">Special title treatment</h5>
      <p class="card-text">
        With supporting text below as a natural lead-in to additional content.
      </p> -->

      <div v-for="(tab, index) in data.tabs" :key="index">
        <!-- <div
          class="btn-group"
          role="group"
          aria-label="Basic radio toggle button group"
          v-show="index === data.activeTab"
        >
          <input
            type="radio"
            class="btn-check"
            name="btnradio"
            :id="`btndata${index}`"
            autocomplete="off"
          />
          <label class="btn btn-outline-primary" :for="`btndata${index}`"
            >Data</label
          >

          <input
            type="radio"
            class="btn-check"
            name="btnradio"
            :id="`btnfit${index}`"
            autocomplete="off"
          />
          <label class="btn btn-outline-primary" :for="`btnfit${index}`"
            >Fit</label
          >
        </div> -->

        <CanvasComponent
          v-show="index === data.activeTab"
          :datasets="datasets[index]"
        ></CanvasComponent>
      </div>
    </div>
  </div>
</template>

<style></style>
