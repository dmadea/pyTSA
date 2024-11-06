<script setup lang="ts">
import { defineProps, defineEmits, computed, PropType } from "vue";
import { APICallPOST, parseDatasets } from "@/utils";
import { Icon } from '@iconify/vue';
import { ModalsContainer, useModal } from 'vue-final-modal'
import ModalCrop from './ModalCrop.vue'
import ModalBaselineCorrect from "./ModalBaselineCorrect.vue";
import ModalDimensionMultiply from "./ModalDimensionMultiply.vue";
import FitWidget from "./FitWidget.vue";
import { GlobalState } from "@/state";
import CanvasComponent from "./CanvasComponent.vue";
import ModalBaselineDriftCorrect from "./ModalBaselineDriftCorrect.vue";


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
        if (props.state.activeTabData.selectedDatasets.length == 0) {close(); return;}
        APICallPOST(`perform/crop/${props.state.data.activeTab}`, data, obj => {
          const datasets = parseDatasets(obj);
          props.state.activeDataView.updateData(datasets);
        })
        close();
      },
      onCancel() {
        close();
      },
      selection: props.state.activeDataView.getCurrentMatrixSelection()
    },
  });

  open();
};

const bcorrect = () => {
  const { open, close } = useModal({
    component: ModalBaselineCorrect,
    attrs: {
      onSubmit(data: any) {
        if (props.state.activeTabData.selectedDatasets.length == 0) {close(); return;}
        APICallPOST(`perform/baseline_correct/${props.state.data.activeTab}`, data, obj => {
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

const bcorrect_drift = () => {
  const { open, close } = useModal({
    component: ModalBaselineDriftCorrect,
    attrs: {
      onSubmit(data: any) {
        if (props.state.activeTabData.selectedDatasets.length == 0) {close(); return;}
        APICallPOST(`perform/baseline_drift_correct/${props.state.data.activeTab}`, data, obj => {
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
        if (props.state.activeTabData.selectedDatasets.length == 0) {close(); return;}
        APICallPOST(`perform/dimension_multiply/${props.state.data.activeTab}`, data, obj => {
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

          <div class="btn-group" role="group">
            <input type="radio" class="btn-check" name="btnradio" id="btnradio1" @input="state.panelChanged(0)"
                autocomplete="off" :checked="state.activeTabData.activePanel === 0">
            <label class="btn btn-outline-success" for="btnradio1">Data view</label>

            <input type="radio" class="btn-check" name="btnradio" id="btnradio3" @input="state.panelChanged(1)" 
            autocomplete="off" :checked="state.activeTabData.activePanel === 1">
            <label class="btn btn-outline-dark" for="btnradio3">Fit view</label>
          </div>

              
          <button class="btn btn-outline-primary btn-icon" @click="crop" data-bs-toggle="tooltip" data-bs-placement="top" title="Tooltip on top">
              <Icon icon="solar:crop-bold" :width="iconWidth"></Icon>
            </button>
            <button class="btn btn-outline-primary btn-icon" @click="bcorrect">
              <Icon icon="ph:arrow-line-up-bold" :width="iconWidth" :rotate="2"></Icon>
            </button>
            <button class="btn btn-outline-primary btn-icon" @click="bcorrect_drift">
              Baseline drift correct
            </button>
            <button class="btn btn-outline-primary btn-icon" @click="dimensionMultiply">
              <Icon icon="iconoir:axes" :width="iconWidth"></Icon>
            </button>
            <button class="btn btn-outline-primary btn-icon" @click="state.activeDataView.activateChirpSelection">
              <Icon icon="iconoir:curve-array" :width="iconWidth"></Icon>
            </button>

            
            
            <!-- <button class="btn btn-outline-primary btn-icon" @click="">
              <Icon icon="solar:test-tube-bold" :width="iconWidth"></Icon>
            </button> -->
            
            <ModalsContainer />

            <CanvasComponent v-for="(tab, index) in state.data.tabs" :key="index"
                v-show="index === state.data.activeTab && state.activeTabData.activePanel === 0"
                :canvasview="state.views[index].dataview"
            />

            <CanvasComponent v-for="(tab, index) in state.data.tabs" :key="index"
                v-show="index === state.data.activeTab && state.activeTabData.activePanel === 1"
                :canvasview="state.views[index].fitview"
            />
        </div>

        <div class="col-4">
             <FitWidget 
              :tab-data="state.activeTabData"
              :kinetic-models="state.kineticModels"
              @model-changed="(index) => state.kineticModelChanged(index)"
              @estimate-chirp-params="() => state.activeFitModel.estimateChirpParams()"
              @fit-model-clicked="() => state.activeFitModel.fit()"
              @simulate-model-clicked="() => state.activeFitModel.simulateModel()"
              @option-changed="(value, index, index2) => state.activeFitModel.optionChanged(value, index, index2)"
              @param-min-changed="(value, index, invalid) => state.activeFitModel.paramMinChanged(value, index, invalid)"
              @param-max-changed="(value, index, invalid) => state.activeFitModel.paramMaxChanged(value, index, invalid)"
              @param-fixed-changed="(value, index) => state.activeFitModel.paramFixedChanged(value, index)"
              @param-value-changed="(value, index, invalid) => state.activeFitModel.paramValueChanged(value, index, invalid)"
              />
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
