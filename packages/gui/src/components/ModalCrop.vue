<script setup lang="ts">
  import { defineEmits, defineProps, ref, PropType } from 'vue';
import CustomModal from './CustomModal.vue'

export interface CropData {
  w0: string,
  w1: string,
  t0: string,
  t1: string,
}

const props = defineProps({
  selection: {
    type: Object as PropType<CropData>,
    required: false
  }
})

  const emit = defineEmits<{
    (e: 'submit', data: any): void
    (e: 'cancel'): void
  }>()

  const data = ref<CropData>({
    w0: "",
    w1: "",
    t0: "",
    t1: "",
  })

const errorMessage: string = "Invalid input, provide a number or keep the area blank!";
const errors = ref<boolean[]>([false, false, false, false]);

  const submit = () =>  {

    const parsedData = {
      w0: data.value.w0 === "" ? null : parseFloat(data.value.w0),
      w1: data.value.w1 === "" ? null : parseFloat(data.value.w1),
      t0: data.value.t0 === "" ? null : parseFloat(data.value.t0),
      t1: data.value.t1 === "" ? null : parseFloat(data.value.t1)
    }

    errors.value.fill(false);
    
    if (Number.isNaN(parsedData.w0)) {
      errors.value[0] = true;
    }
    if (Number.isNaN(parsedData.w1)) {
      errors.value[1] = true;
    }
    if (Number.isNaN(parsedData.t0)) {
      errors.value[2] = true;
    }
    if (Number.isNaN(parsedData.t1)) {
      errors.value[3] = true;
    }
    if (errors.value.includes(true)) {
      return;
    }

    emit('submit', parsedData)
  };

  const useSelection = () => {
    if (props.selection) {
      data.value = props.selection;
    }
  };

  </script>

  <template>
    <CustomModal title="Crop datasets" @cancel="emit('cancel')" @submit="submit">
      <span>Wavelength range:</span>

      <div class="input-group input-group-sm" :class="{'mb-3': !errors[0]}">
        <span class="input-group-text">Start</span>
        <input type="text" class="form-control" v-model="data.w0" placeholder="">
      </div>
      <div class="error" v-show="errors[0]">{{ errorMessage }}</div>

      <div class="input-group input-group-sm" :class="{'mb-3': !errors[1]}">
        <span class="input-group-text">End</span>
        <input type="text" class="form-control" v-model="data.w1" placeholder="">
      </div>
      <div class="error" v-show="errors[1]">{{ errorMessage }}</div>

      <span>Time range:</span>
      <div class="input-group input-group-sm" :class="{'mb-3': !errors[2]}">
        <span class="input-group-text">Start</span>
        <input type="text" class="form-control" v-model="data.t0" placeholder="">
      </div>
      <div class="error" v-show="errors[2]">{{ errorMessage }}</div>

      <div class="input-group input-group-sm" :class="{'mb-3': !errors[3]}">
        <span class="input-group-text">End</span>
        <input type="text" class="form-control" v-model="data.t1" placeholder="">
      </div>
      <div class="error" v-show="errors[3]">{{ errorMessage }}</div>

      <div>
        <button class="btn btn-secondary" @click="() => useSelection()">
              Use selection
        </button>
      </div>
    </CustomModal>
  </template>
