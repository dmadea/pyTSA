<script setup lang="ts">
import { APICallGET, APICallPOST, arr2json, json2arr, loadFiles, parseDatasets } from "@/utils";
import { Dataset, Matrix } from "@pytsa/ts-graph";
import { defineProps, defineEmits, PropType, computed } from "vue";
import { Icon } from '@iconify/vue';
import { GlobalState } from "@/state";

const props = defineProps({
  state: {
    type: Object as PropType<GlobalState>,
    required: true,
  },
});

const iconWidth: string = "30";

const pingClicked = () => {
  const time = Date.now();

  APICallGET("ping", null, (obj) => {
    console.log("ping: ", Date.now() - time, "ms");
  });
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
        nrows: d.data.nrows,
        ncols: d.data.ncols
      },
      name: d.name,
    });
  }

  var data = {
    data: {
      datasets: dataset2send,
    },
  };

  APICallPOST("post_datasets", data);
};

const checkedDatasets = computed<boolean[]>(() => {
  const selTab = props.state.activeTabData;
  const isChecked: boolean[] = [];
  for (let i = 0; i < props.state.datasets.value.length; i++) {
    isChecked.push(selTab.selectedDatasets.includes(i));
  }

  return isChecked;
});

const loadDatasets = (payload: Event) => {
  const files = (payload.target as HTMLInputElement).files;
  if (!files) return;
  loadFiles(files, (datasets) => {
    postDatasets(datasets);
    props.state.loadDatasets(datasets);
  });
};

const syncData = () => {
  APICallGET(`get_datasets`, null, (obj) => {
    const datasets = parseDatasets(obj);
    props.state.updateDatasets(datasets);
  })
};

const transpose = (index: number) => {
  props.state.datasets.value[index].transpose();
  APICallPOST(`transpose_dataset/${index}`);
};

</script>

<template>
  <div>
    <input type="file" class="btn button" @change="loadDatasets" multiple />

    <button class="btn btn-outline-primary btn-icon" @click="pingClicked">
        <Icon icon="mdi:ping-pong" :width="iconWidth"></Icon>
    </button>
    <button class="btn btn-outline-primary btn-icon" @click="syncData">
        <Icon icon="material-symbols:sync" :width="iconWidth"></Icon>
    </button>
    <button class="btn btn-outline-primary btn-icon" @click="state.clear()">
        <Icon icon="lets-icons:blank" :rotate="2" :width="iconWidth"></Icon>
    </button>
  </div>

  <h4>List of loaded datasets</h4>
  <ul class="list-group">
    <li
      v-for="(dataset, index) in state.datasets.value"
      :key="index"
      class="list-group-item small"
    >
      <input
        class="form-check-input me-1"
        type="checkbox"
        :checked="checkedDatasets[index]"
        @change="state.leftPanelCheckedChanged(index)"
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
