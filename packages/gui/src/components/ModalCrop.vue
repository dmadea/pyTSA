<script setup lang="ts">
  import { reactive, defineEmits , ref} from 'vue';
import { VueFinalModal } from 'vue-final-modal'
import { CropData } from "./types";
import { parse } from 'uuid';

  defineProps<{
    title?: string
  }>()

  const emit = defineEmits<{
    (e: 'submit', data: any): void
    (e: 'cancel'): void

  }>()

  const data = reactive({
    w0: "",
    w1: "",
    t0: "",
    t1: "",
  })

const errorMessage: string = "Invalid input, provide a number or keep the area blank!";
const errors = ref<boolean[]>([false, false, false, false]);

  const submit = () =>  {

    const parsedData = {
      w0: data.w0 === "" ? null : parseFloat(data.w0),
      w1: data.w1 === "" ? null : parseFloat(data.w1),
      t0: data.t0 === "" ? null : parseFloat(data.t0),
      t1: data.t1 === "" ? null : parseFloat(data.t1)
    }
    
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

    console.log(parsedData, errors.value);

    if (errors.value.includes(true)) {
      return;
    }

    emit('submit', parsedData)
  };


  </script>

  <template>
    <VueFinalModal
      class="confirm-modal"
      content-class="confirm-modal-content"
      overlay-transition="vfm-fade"
      content-transition="vfm-fade"
    >
      <h1>{{ title }}</h1>
      <slot />

      <div class="input-group input-group-sm mb-3">
        <span class="input-group-text" id="basic-addon1">w0</span>
        <input type="text" class="form-control" v-model="data.w0" placeholder="" aria-describedby="basic-addon1">
      </div>
      <span class="error" v-show="errors[0]">{{ errorMessage }}</span>
      <div class="input-group input-group-sm mb-3">
        <span class="input-group-text" id="basic-addon1">w1</span>
        <input type="text" class="form-control" v-model="data.w1" placeholder="" aria-describedby="basic-addon1">
      </div>
      <span class="error" v-show="errors[1]">{{ errorMessage }}</span>
      <div class="input-group input-group-sm mb-3">
        <span class="input-group-text" id="basic-addon1">t0</span>
        <input type="text" class="form-control" v-model="data.t0" placeholder="" aria-describedby="basic-addon1">

      </div>
      <span class="error" v-show="errors[2]">{{ errorMessage }}</span>
      <div class="input-group input-group-sm mb-3">
        <span class="input-group-text" id="basic-addon1">t1</span>
        <input type="text" class="form-control" v-model="data.t1" placeholder="" aria-describedby="basic-addon1">
      </div>
      <span class="error" v-show="errors[3]">{{ errorMessage }}</span>
      
      <div>
          <button class="btn btn-outline-danger" @click="emit('cancel')">
            Cancel
          </button>
          <button class="btn btn-outline-success" @click="submit">
            Confirm
          </button>

      </div>

    </VueFinalModal>
  </template>

  <style>
  .error {
    color: red;
    font-size: small;
    /* padding-top: -50px;
    margin-top: -50px; */
  }

  .confirm-modal {
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .confirm-modal-content {
    display: flex;
    flex-direction: column;
    padding: 1rem;
    background: #fff;
    border-radius: 0.5rem;
  }
  .confirm-modal-content > * + *{
    margin: 0.5rem 0;
  }
  .confirm-modal-content h1 {
    font-size: 1.375rem;
  }
  .confirm-modal-content button {
    margin: 0.25rem 0 0 auto;
    padding: 0 8px;
    border: 1px solid;
    border-radius: 0.5rem;
  }
  .dark .confirm-modal-content {
    background: #000;
  }
  </style>