<script setup lang="ts">
import { APICallGET, APICallPOST, arr2json, json2arr, loadFiles, parseDatasets } from "@/utils";
import { Dataset, Matrix } from "@pytsa/ts-graph";
import { defineProps, inject, ref, defineEmits, PropType } from "vue";
import { Icon } from '@iconify/vue';

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
const iconWidth: string = "30";
const backendUrl = inject("backendUrl");
const emit = defineEmits<{
  (e: "datasetsLoaded", datasets: Dataset[]): void;
  (e: "datasetsUpdated", datasets: Dataset[]): void;
  (e: "checkedChanged", index: number): void;
  (e: "clear"): void;
  // (e: 'update', value: string): void
}>();


const pingClicked = () => {
  const time = Date.now();

  APICallGET(`${backendUrl}api/ping`, null, (obj) => {
    console.log("ping: ", Date.now() - time, "ms");

  })
};

const postDatasets = (datasets: Dataset[]) => {

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

  APICallPOST(`${backendUrl}api/post_datasets`, data);
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
  APICallGET(`${backendUrl}api/get_datasets`, null, (obj) => {
    const datasets = parseDatasets(obj);
    emit("datasetsUpdated", datasets);
  })
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
      <button class="btn btn-outline-primary btn-icon" @click="transpose(index)">
        <Icon icon="carbon:transpose" :width="iconWidth"></Icon>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.button {
  margin: 2px;
  padding: 5px;
}

.btn-icon {
  padding: 5px;
  border: none;
  border-radius: 100%;
}
</style>
