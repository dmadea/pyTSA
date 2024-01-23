<script setup lang="ts">
import { APICallPOST, arr2json, json2arr, loadFiles } from "@/utils";
import { Dataset, Matrix } from "@pytsa/ts-graph";
import { defineProps, inject, ref, defineEmits, PropType } from "vue";

const props = defineProps({
  datasets: {
    type: Array,
    required: true,
  },
  checked: {
    type: Array as PropType<boolean[]>,
    required: true,
  },
});

const backendUrl = inject("backendUrl");
const emit = defineEmits<{
  (e: "datasetsLoaded", datasets: Dataset[]): void;
  (e: "datasetsUpdated", datasets: Dataset[]): void;
  (e: "checkedChanged", index: number): void;
  (e: "clear"): void;
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

const postDatasets = (datasets: Dataset[]) => {
  const xhr = new XMLHttpRequest();

  var dataset2send = [];
  for (const d of datasets) {
    dataset2send.push({
      times: arr2json(d.y),
      wavelengths: arr2json(d.x),
      matrix: {
        data: arr2json(d.data),
        c_contiguous: d.data.isCContiguous,
      },
      name: d.name,
    });
  }

  var data = {
    data: {
      datasets: dataset2send,
    },
  };

  xhr.onreadystatechange = () => {
    if (xhr.readyState == 4 && xhr.status == 200) {
      console.log("Success");
    }
  };
  // asynchronous requests
  xhr.open("POST", `${backendUrl}api/post_datasets`, true);
  xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

  // Send the request over the network
  xhr.send(JSON.stringify(data));
};

const loadDatasets = (payload: Event) => {
  const files = (payload.target as HTMLInputElement).files;
  if (!files) return;
  loadFiles(files, (datasets) => {
    postDatasets(datasets);
    emit("datasetsLoaded", datasets);
  });
};

const syncData = () => {
  xhr.onreadystatechange = () => {
    if (xhr.readyState == 4 && xhr.status == 200) {
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
      emit("datasetsUpdated", datasets);
    }
  };
  // asynchronous requests
  xhr.open("GET", `${backendUrl}api/get_datasets`, true);

  // Send the request over the network
  xhr.send(null);
};

const transpose = (index: number) => {
  (props.datasets[index] as Dataset).transpose();
  APICallPOST(`${backendUrl}api/transpose_dataset/${index}`);
};


</script>

<template>
  <div>
    <input type="file" class="btn button" @change="loadDatasets" multiple />
    <button class="btn btn-secondary button" @click="pingClicked">Ping</button>
    <button class="btn btn-outline-primary button" @click="syncData">
      Sync data with backend
    </button>
    <button class="btn btn-secondary button" @click="emit('clear')">Clear</button>
  </div>

  <h4>List of loaded datasets</h4>
  <ul class="list-group">
    <li
      v-for="(dataset, index) in datasets"
      :key="index"
      class="list-group-item small"
    >
      <input
        class="form-check-input me-1"
        type="checkbox"
        :checked="checked[index]"
        @change="emit('checkedChanged', index)"
        aria-label="..."
      />
      {{ (dataset as Dataset).name }}
      <button class="button" @click="transpose(index)">Tr</button>
    </li>
  </ul>
</template>

<style scoped>
.button {
  margin: 2px;
  padding: 5px;
}
</style>
