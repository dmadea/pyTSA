<script setup lang="ts">
import { defineProps, inject, ref, defineEmits, computed } from "vue";
import CanvasComponent from "./CanvasComponent.vue";
// import { Dataset, Matrix } from "@pytsa/ts-graph";
import { APICallPOST, json2arr, parseDatasets } from "@/utils";
import { Icon } from '@iconify/vue';
import { ModalsContainer, useModal } from 'vue-final-modal'
import ModalCrop from './ModalCrop.vue'
import ModalBaselineCorrect from "./ModalBaselineCorrect.vue";
import ModalDimensionMultiply from "./ModalDimensionMultiply.vue";
import FitWidget from "./FitWidget.vue";


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

const iconWidth: string = "30";

const crop = () => {
  const { open, close } = useModal({
    component: ModalCrop,
    attrs: {
      onSubmit(data: any) {
        APICallPOST(`${backendUrl}api/perform/crop/${props.data.activeTab}`, data, obj => {
          const datasets = parseDatasets(obj);
          canvasInterfaces[props.data.activeTab].updateData(datasets);
        })
        close();
      },
      onCancel() {
        close();
      }
    },
  });

  open();
};

const bcorrect = () => {
  const { open, close } = useModal({
    component: ModalBaselineCorrect,
    attrs: {
      onSubmit(data: any) {
        APICallPOST(`${backendUrl}api/perform/baseline_correct/${props.data.activeTab}`, data, obj => {
          const datasets = parseDatasets(obj);
          canvasInterfaces[props.data.activeTab].updateData(datasets);
        })
        close();
      },
      onCancel() {
        close();
      }
    },
  });

  open();
};

const dimensionMultiply = () => {
  const { open, close } = useModal({
    component: ModalDimensionMultiply,
    attrs: {
      onSubmit(data: any) {
        APICallPOST(`${backendUrl}api/perform/dimension_multiply/${props.data.activeTab}`, data, obj => {
          const datasets = parseDatasets(obj);
          canvasInterfaces[props.data.activeTab].updateData(datasets);
        })
        close();
      },
      onCancel() {
        close();
      }
    },
  });

  open();
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
            @click="emit('tabIndexChanged', index)"
          >
            {{ `Set ${1 + index}` }}
          </button>
        </li>
        <li class="nav-item">
          <button
            class="nav-link"
            @click="emit('addNewTab')"
            href="#"
            >+</button>
        </li>
      </ul>
    </div>
    <div class="card-body">
      <div class="row">
        <div class="col-8">
              
          <button class="btn btn-outline-primary btn-icon" @click="crop" data-bs-toggle="tooltip" data-bs-placement="top" title="Tooltip on top">
              <Icon icon="solar:crop-bold" :width="iconWidth"></Icon>
            </button>
            <button class="btn btn-outline-primary btn-icon" @click="bcorrect">
              <Icon icon="ph:arrow-line-up-bold" :width="iconWidth" :rotate="2"></Icon>
            </button>
            <button class="btn btn-outline-primary btn-icon" @click="dimensionMultiply">
              <Icon icon="iconoir:axes" :width="iconWidth"></Icon>
            </button>
            
            <!-- <button class="btn btn-outline-primary btn-icon" @click="">
              <Icon icon="solar:test-tube-bold" :width="iconWidth"></Icon>
            </button> -->
            
            <ModalsContainer />
            
            <div v-for="(tab, index) in data.tabs" :key="index">
              <CanvasComponent
              v-show="index === data.activeTab"
              :datasets="props.data.datasets"
              @interface="getInterface"
              />
            </div>

        </div>

        <div class="col-4">
            <FitWidget :fitmodel="data.tabs[data.activeTab].fitmodel"></FitWidget>

        </div>
      </div>
           

          



    </div>
  </div>
</template>

<style scoped>

.btn-icon {
  padding: 5px;
  border: none;
  border-radius: 100%;
}



</style>
