<script setup lang="ts">
import { defineProps, inject, ref, defineEmits, computed, PropType } from "vue";
import CanvasComponent from "./CanvasComponent.vue";
// import { Dataset, Matrix } from "@pytsa/ts-graph";
import { APICallPOST, json2arr, parseDatasets } from "@/utils";
import { Icon } from '@iconify/vue';
import { ModalsContainer, useModal } from 'vue-final-modal'
import ModalCrop from './ModalCrop.vue'
import ModalBaselineCorrect from "./ModalBaselineCorrect.vue";
import ModalDimensionMultiply from "./ModalDimensionMultiply.vue";
import FitWidget from "./FitWidget.vue";
import { FitModel } from "@/fitmodel";
import DataViewComponent from "./DataViewComponent.vue";
import { GlobalState } from "@/state";
// import { Data } from "@/App.vue";


const props = defineProps({
  state: {
    type: Object as PropType<GlobalState>,
    required: true,
  },
});

const iconWidth: string = "30";

const crop = () => {
  const { open, close } = useModal({
    component: ModalCrop,
    attrs: {
      onSubmit(data: any) {
        if (props.state.data.tabs[props.state.data.activeTab].selectedDatasets.length == 0) {close(); return;}
        APICallPOST(`${props.state.backendUrl}api/perform/crop/${props.state.data.activeTab}`, data, obj => {
          const datasets = parseDatasets(obj);
          props.state.activeDataView.updateData(datasets);
        })
        close();
      },
      onCancel() {
        close();
      },
      selection: ["1", "2", "3","4"]
    },
  });

  open();
};

const bcorrect = () => {
  const { open, close } = useModal({
    component: ModalBaselineCorrect,
    attrs: {
      onSubmit(data: any) {
        if (props.state.data.tabs[props.state.data.activeTab].selectedDatasets.length == 0) {close(); return;}
        APICallPOST(`${props.state.backendUrl}api/perform/baseline_correct/${props.state.data.activeTab}`, data, obj => {
          const datasets = parseDatasets(obj);
          props.state.activeDataView.updateData(datasets);
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
        if (props.state.data.tabs[props.state.data.activeTab].selectedDatasets.length == 0) {close(); return;}
        APICallPOST(`${props.state.backendUrl}api/perform/dimension_multiply/${props.state.data.activeTab}`, data, obj => {
          const datasets = parseDatasets(obj);
          props.state.activeDataView.updateData(datasets);
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
        <li v-for="(tab, index) in state.data.tabs" :key="index" class="nav-item">
          <button
            class="nav-link"
            :class="{ active: index === state.data.activeTab }"
            @click="state.tabIndexChanged(index)"
          >
            {{ `Set ${1 + index}` }}
          </button>
        </li>
        <li class="nav-item">
          <button
            class="nav-link"
            @click="state.addNewTab()"
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

            <DataViewComponent v-for="(tab, index) in state.data.tabs" :key="index"
              v-show="index === state.data.activeTab"
              :dataview="state.views[index].dataview"
              />
            
        </div>

        <div class="col-4">
             <FitWidget :fitmodel="state.fitmodels.value[state.data.activeTab]"
             @model-changed="(model) => state.kineticModelChanged(model)"></FitWidget> 
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
