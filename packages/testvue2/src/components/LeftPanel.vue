<script setup lang="ts">
import { loadFiles } from "@/utils";
import { Dataset } from "@pytsa/ts-graph";
import { defineProps, inject, ref, defineEmits } from "vue";

const props = defineProps({
  datasets: {
    type: Object,
    required: true,
  },
});

const backendUrl = inject("backendUrl");
const emit = defineEmits<{
  (e: "datasetsLoaded", datasets: Dataset[]): void;
  // (e: 'update', value: string): void
}>();

// const picked = ref<string>("One");

const xhr = new XMLHttpRequest();

const pingClicked = () => {
  const time = Date.now();

  xhr.onreadystatechange = () => {
    // console.log(xhr.responseText);
    if (xhr.readyState == 4 && xhr.status == 200) {
      //  && xhr.responseText == "pong"
      console.log("ping: ", Date.now() - time, "ms");
    }
  };
  // asynchronous requests
  xhr.open("GET", `${backendUrl}api/ping`, true);
  // Send the request over the network
  xhr.send(null);
};

const loadDatasets = (payload: Event) => {
  const files = (payload.target as HTMLInputElement).files;
  if (!files) return;
  loadFiles(files, (datasets) => {
    emit("datasetsLoaded", datasets);
  });
};

const syncData = () => {
  console.log("syncata");
};
</script>

<template>
  <div>
    <input type="file" class="btn button" @change="loadDatasets" multiple />
    <button class="btn btn-secondary button" @click="pingClicked">Ping</button>
    <button class="btn btn-outline-primary button" @click="syncData">
      Sync data with backend
    </button>
  </div>

  <h4>List of loaded datasets</h4>
  <ul class="list-group">
    <li
      v-for="(dataset, index) in datasets"
      :key="index"
      class="list-group-item"
    >
      <input
        class="form-check-input me-1"
        type="checkbox"
        :checked="dataset.checked"
        aria-label="..."
      />
      {{ dataset.datasetData.name }}
    </li>
  </ul>
</template>

<style scoped>
.button {
  margin: 2px;
  padding: 5px;
}
</style>
