<script setup lang="ts">
import { defineProps, inject, ref, onMounted } from "vue";
import CanvasComponent from "./CanvasComponent.vue";

const props = defineProps({
  datasets: {
    type: Object,
    required: true,
  },
});

const activeTab = ref<number>(0);

const tabs = ref([
  {
    name: "Tab 1",
  },
]);

const addNewTab = () => {
  tabs.value.push({
    name: `Tab ${tabs.value.length + 1}`,
  });
  activeTab.value = tabs.value.length - 1;
};
</script>

<template>
  <div class="card">
    <div class="card-header">
      <ul class="nav nav-tabs card-header-tabs">
        <li v-for="(tab, index) in tabs" :key="index" class="nav-item">
          <button
            class="nav-link"
            :class="{ active: index === activeTab }"
            aria-current="true"
            @click="activeTab = index"
          >
            {{ tab.name }}
          </button>
        </li>
        <li class="nav-item">
          <a class="nav-link" @click="addNewTab()" aria-current="true" href="#"
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

      <div v-for="(tab, index) in tabs" :key="index">
        <div
          class="btn-group"
          role="group"
          aria-label="Basic radio toggle button group"
          v-show="index === activeTab"
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
        </div>

        <CanvasComponent
          v-show="index === activeTab"
          :tabindex="index"
          :currentTab="activeTab"
        ></CanvasComponent>
      </div>
    </div>
  </div>
</template>

<style></style>
