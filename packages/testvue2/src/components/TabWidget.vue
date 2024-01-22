<script setup lang="ts">
import { defineProps, inject, ref, defineEmits, computed } from "vue";
import CanvasComponent from "./CanvasComponent.vue";
import { Dataset, Matrix } from "@pytsa/ts-graph";
import { json2arr } from "@/utils";

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
});

const backendUrl = inject("backendUrl");

const emit = defineEmits<{
  (e: "addNewTab"): void;
  (e: "tabIndexChanged", value: number): void;
  (e: "canvasInterfaces", iface: any): void;
}>();

var canvasInterfaces: any[] = [];

const getInterface = (iface: any) => {
  canvasInterfaces.push(iface);
  emit("canvasInterfaces", canvasInterfaces);
};

const crop = () => {
  const xhr = new XMLHttpRequest();
  xhr.onreadystatechange = () => {
    if (xhr.readyState == 4 && xhr.status == 201) {
      var obj = JSON.parse(xhr.response);
      const datasets: Dataset[] = [];

      for (const d of obj.data.datasets) {
        var t = json2arr(d.times);
        var w = json2arr(d.wavelengths);
        var m = json2arr(d.matrix.data);
        var mat = new Matrix(t.length, w.length, m);
        mat.isCContiguous = d.matrix.c_contiguous;

        datasets.push(new Dataset(mat, w, t, d.name));
      }
      console.log(datasets);
      // emit("datasetsUpdated", datasets);
    }
  };

  const kwargs = {
    w0: 350,
    w1: 500,
  };

  const op = "crop";
  // asynchronous requests
  xhr.open(
    "POST",
    `${backendUrl}api/perform/${op}/${props.data.activeTab}`,
    true
  );
  xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

  // Send the request over the network
  xhr.send(JSON.stringify(kwargs));
};
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
        <div v-show="index === data.activeTab">
          <button @click="crop">Crop</button>
          <button>Baseline correct</button>
          <button>Dimension multiply</button>
        </div>

        <CanvasComponent
          v-show="index === data.activeTab"
          :datasets="props.data.datasets"
          @interface="getInterface"
        ></CanvasComponent>
      </div>
    </div>
  </div>
</template>

<style></style>
