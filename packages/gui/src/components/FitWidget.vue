<script setup lang="ts">
import { defineProps, inject, ref, defineEmits, computed, reactive } from "vue";
// import { APICallPOST, json2arr, parseDatasets } from "@/utils";
// import { Icon } from '@iconify/vue';
// import { ModalsContainer, useModal } from 'vue-final-modal'
import { FirstOrderModel, FirstOrderModelLPL, FitModel } from "@/fitmodel";


const props = defineProps({
  fitmodel: {
    type: Object,
    required: true,
  },
});

// const backendUrl = inject("backendUrl");

const emit = defineEmits<{
  (e: "modelChanged", model: typeof FitModel): void;
}>();

const kineticModels = [FirstOrderModel, FirstOrderModelLPL];

const onChangeModel = (obj: Event) => {
  var s = obj.target as HTMLSelectElement;
  // console.log(s.selectedIndex);
  emit('modelChanged', kineticModels[s.selectedIndex - 1]);
};

const optionChanged = (index: number) => {
  props.fitmodel.updateModelOptions(index);
};

const paramChanged = (index: number) => {



  props.fitmodel.updateModelParams(index);
};

const collapsed = ref<boolean>(true);

</script>

<template>

  <h3 class=""> Fitting</h3>
  
  <div class="input-group input-group-sm mb-3">
    <label class="input-group-text" for="inputGroupSelect01">Kinetic model</label>
    <select class="form-select" id="inputGroupSelect01" :onchange="onChangeModel">
      <option disabled value="">Please select one</option>
      <option v-for="(opt, index) in kineticModels" :key="index" :value="index">{{ opt.modelName }}</option>
    </select>
  </div>

  <div class="accordion">
  <div class="accordion-item">
    <h3 class="accordion-header">
      <button class="accordion-button small" :class="{'collapsed': collapsed}" 
      type="button" data-bs-toggle="collapse" @click="() => {collapsed = !collapsed}">
        Model options
      </button>
    </h3>
    <div class="accordion-collapse" :class="{'collapse': collapsed}">
      <div class="accordion-body">
        <div v-for="(option, index) in fitmodel.options" :key="index">
        <div v-if="option.type === 'checkbox'" class="form-check">
          <input class="form-check-input" type="checkbox" :id="`cb${index}`" v-model="option.value" :onchange="() => optionChanged(index)">
          <label class="form-check-label small" :for="`cb${index}`">
            {{ option.name }}
          </label>
        </div>

        <div v-else-if="option.type === 'text' || option.type === 'number'" class="input-group input-group-sm mb-3">
            <span class="input-group-text">{{ option.name }}</span>
            <input :type="option.type" class="form-control" v-model="option.value" :onchange="() => optionChanged(index)"
            placeholder="" :min="option.min" :max="option.max" :step="option.step" >
        </div>

        <div v-else-if="option.type === 'select'" class="input-group input-group-sm mb-3">
          <label class="input-group-text" :for="`select${index}`">{{ option.name }}</label>
          <select class="form-select" :id="`select${index}`" v-model="option.value" :onchange="() => optionChanged(index)">
            <option disabled value="">Please select one</option>
            <option v-for="(opt, i2) in option.options" :key="i2">{{ opt }}</option>  
          </select>
        </div>
      </div>
      </div>
    </div>
  </div>
</div>

  <button class="btn btn-outline-success" @click="fitmodel.simulateModel()">Simulate model</button>
  <button class="btn btn-outline-secondary" @click="fitmodel.fit()">Fit</button>
  
  <h4 class=""> Params</h4>

  <table class="table table-sm table-striped">
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Min</th>
      <th scope="col">Value</th>
      <th scope="col">Max</th>
      <th scope="col">Error</th>
      <th scope="col">Fixed</th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="(entry, index) in fitmodel.params" :key="index">
      <th scope="row">{{ entry.name }}</th>
      <td><input class="input-group-text text-field" type="text" v-model="entry.min" :disabled="entry.fixed" :onchange="() => paramChanged(index)"/></td>
      <td><input class="input-group-text text-field" type="number" v-model="entry.value" :onchange="() => paramChanged(index)"/></td>
      <td><input class="input-group-text text-field" type="text" v-model="entry.max" :disabled="entry.fixed" :onchange="() => paramChanged(index)"/></td>
      <td>{{ entry.error }}</td>
      <td><input class="form-check-input" type="checkbox" v-model="entry.fixed" :onchange="() => paramChanged(index)" /></td>
    </tr>
  </tbody>
</table>

</template>

<style scoped>

.text-field {
  width: 100%;
  padding: 1% 2%;
  margin: 0px;
  text-align: left;
  background-color: white;
}

.text-field:disabled {
  background-color: rgb(234, 234, 234);
}

</style>
