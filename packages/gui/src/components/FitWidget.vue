<script setup lang="ts">
import { defineProps, ref, defineEmits, PropType, watch } from "vue";
import { FitModel } from "@/dataview/fitmodel";
import { v4 } from "uuid";
import { ITabData } from "@/state";
import Loader from "./Loader.vue";


const props = defineProps({
  tabData: {
    type: Object as PropType<ITabData>,
    required: true,
  },
  kineticModels: {
    type: Array as PropType<Array<typeof FitModel>>,
    required: true,
  }
});

const emit = defineEmits<{
  (e: "modelChanged", index: number): void,
  (e: "simulateModelClicked"): void,
  (e: "fitModelClicked"): void,
  (e: "estimateChirpParams"): void,
  (e: "paramMinChanged", value: string, index: number, invalid: boolean): void,
  (e: "paramMaxChanged", value: string, index: number, invalid: boolean): void,
  (e: "paramValueChanged", value: string, index: number, invalid: boolean): void,
  (e: "paramFixedChanged", value: boolean, index: number): void,
  (e: "optionChanged", value: number | string | boolean, index: number, index2?: number): void
}>();

const invalidInputs: any = ref({
  min: {},
  value: {},
  max: {},
});

// TODO check error on input change
const handle = watch(props.tabData.fitOptions, () => {
  console.log("watch changed", props.tabData.fitOptions);
  // throw Error("asd")
 });


const paramMinChanged = (value: string, index: number) => {
  const pval = parseFloat(value);
  if (Number.isNaN(pval) && value.toLowerCase() !== "-inf") {
    // invalid input
    invalidInputs.value.min = {...invalidInputs.value.min, [index]: true};
    emit('paramMinChanged', value, index, true);
    return;
  } else {
    invalidInputs.value.min = {...invalidInputs.value.min, [index]: false};
  }
  emit('paramMinChanged', value, index, false);
};

const paramMaxChanged = (value: string, index: number) => {
  const pval = parseFloat(value);
  if (Number.isNaN(pval) && value.toLowerCase() !== "inf" && value.toLowerCase() !== "+inf") {
    // invalid input
    invalidInputs.value.max = {...invalidInputs.value.max, [index]: true};
    emit('paramMaxChanged', value, index, true);
    return;
  } else {
    invalidInputs.value.max = {...invalidInputs.value.max, [index]: false};
  }
  emit('paramMaxChanged', value, index, false);
};

const paramValueChanged = (value: string, index: number) => {
  const pval = parseFloat(value);
  if (Number.isNaN(pval)) {
    // invalid input
    invalidInputs.value.value = {...invalidInputs.value.value, [index]: true};
    emit('paramValueChanged', value, index, true);
    return;
  } else {
    invalidInputs.value.value = {...invalidInputs.value.value, [index]: false};
  }
  emit('paramValueChanged', value, index, false);
};


const collapsed = ref<boolean>(true);

</script>

<template>

  <h3 class=""> Fitting</h3>
  
  <div class="input-group input-group-sm mb-3">
    <label class="input-group-text" :for="v4()">Kinetic model</label>
    <select class="form-select" :id="v4()" :value="kineticModels[tabData.selectedFitModel].modelName"
    @input="event => emit('modelChanged', (event.target as HTMLSelectElement).selectedIndex - 1)">
      <option disabled value="">Please select one</option>
      <option v-for="(model, index) in kineticModels" :key="index">{{ model.modelName }}</option>
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
        <div v-for="(option, index) in tabData.fitOptions" :key="index">
        <div v-if="option.type === 'checkbox'" class="form-check">
          <input class="form-check-input" type="checkbox" :id="v4()" :checked="(option.value as boolean)" :disabled="tabData.isFitting"
          @input="ev => emit('optionChanged', (ev.target as HTMLInputElement).checked, index)"/>
          <label class="form-check-label small" :for="v4()">
            {{ option.name }}
          </label>
        </div>

        <div v-else-if="option.type === 'text' || option.type === 'number'" class="input-group input-group-sm mb-1">
            <span class="input-group-text">{{ option.name }}</span>
            <input :type="option.type" class="form-control" :value="option.value" :disabled="tabData.isFitting"
            @input="ev => emit('optionChanged', (option.type === 'text') ? (ev.target as HTMLInputElement).value : parseFloat((ev.target as HTMLInputElement).value), index)"
            placeholder="" :min="option.min" :max="option.max" :step="option.step" />
        </div>

        <div v-else-if="option.type === 'range'" class="input-group input-group-sm mb-1">
          <span class="input-group-text">{{ option.name }}</span>
            <template v-for="(val, index2) in (option.value as (string | number)[])">
              <span class="input-group-text">{{ option.rangeNames ? option.rangeNames[index2] : "" }}</span>
              <input type="number" class="form-control" :value="val" :disabled="tabData.isFitting"
              @input="ev => emit('optionChanged', parseFloat((ev.target as HTMLInputElement).value), index, index2)"
              placeholder="" :min="option.min" :max="option.max" :step="option.step" />
            </template>
        </div>

        <div v-else-if="option.type === 'select'" class="input-group input-group-sm mb-1">
          <label class="input-group-text" :for="`select${index}`">{{ option.name }}</label>
          <select class="form-select" :id="`select${index}`" :disabled="tabData.isFitting" :value="option.value" @input="ev => emit('optionChanged', (ev.target as HTMLSelectElement).value, index)">
            <option disabled value="">Please select one</option>
            <option v-for="(opt, i2) in option.options" :key="i2">{{ opt }}</option>  
          </select>
        </div>
      </div>
      </div>
    </div>
  </div>
</div>

  <button class="btn btn-outline-success" @click="emit('simulateModelClicked')" :disabled="tabData.isFitting">Simulate model</button>
  <button class="btn btn-outline-secondary" @click="emit('fitModelClicked')">{{ tabData.isFitting ? "Cancel" : "Fit" }}</button>
  <button class="btn btn-outline-secondary" @click="emit('estimateChirpParams')">Estimate chirp params</button>
  <Loader v-show="tabData.isFitting"/>
  
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
    <tr v-for="(entry, index) in tabData.fitParams" :key="index">
      <th scope="row">{{ entry.name }}</th>
      <td><input class="input-group-text text-field" :class="{'text-field-error': invalidInputs.min[index] ?? false}"
         type="text" :value="entry.min" :disabled="entry.fixed || tabData.isFitting"
        @input="ev => paramMinChanged((ev.target as HTMLInputElement).value, index)"/></td>
      <td><input class="input-group-text text-field" :class="{'text-field-error': invalidInputs.value[index] ?? false}"
        type="number" :value="entry.value" :disabled="tabData.isFitting"
        @input="ev => paramValueChanged((ev.target as HTMLInputElement).value, index)"/></td>
      <td><input class="input-group-text text-field" :class="{'text-field-error': invalidInputs.max[index] ?? false}"
         type="text" :value="entry.max" :disabled="entry.fixed || tabData.isFitting"
        @input="ev => paramMaxChanged((ev.target as HTMLInputElement).value, index)" /></td>
      <td>{{ entry.error }}</td>
      <td><input class="form-check-input" type="checkbox" :value="entry.fixed" :disabled="tabData.isFitting"
        @input="ev => emit('paramFixedChanged', (ev.target as HTMLInputElement).checked, index)" /></td>
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

.text-field-error {
  outline: none;
  border-color: #ff2f2f;
  box-shadow: 0 0 5px #ff0e0e;
}

</style>
