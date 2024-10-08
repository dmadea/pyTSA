<script setup lang="ts">
  import { reactive, defineEmits , ref} from 'vue';
import CustomModal from './CustomModal.vue'

  const emit = defineEmits<{
    (e: 'submit', data: any): void
    (e: 'cancel'): void
  }>()

  const data = reactive({
    w0: "",
    w1: "",
  })

const errorMessage: string = "Invalid input, provide a number or keep the area blank!";
const errors = ref<boolean[]>([false, false]);

  const submit = () =>  {

    const parsedData = {
      w0: data.w0 === "" ? null : parseFloat(data.w0),
      w1: data.w1 === "" ? null : parseFloat(data.w1)
    }

    errors.value.fill(false);
    
    if (Number.isNaN(parsedData.w0)) {
      errors.value[0] = true;
    }
    if (Number.isNaN(parsedData.w1)) {
      errors.value[1] = true;
    }

    if (errors.value.includes(true)) {
      return;
    }

    emit('submit', parsedData)
  };


  </script>

  <template>
    <CustomModal title="Baselined drift correct datasets" @cancel="emit('cancel')" @submit="submit">
      <span>Wavelength range of the noise region:</span>
      <div class="input-group input-group-sm" :class="{'mb-3': !errors[0]}">
        <span class="input-group-text" id="basic-addon1">Start</span>
        <input type="text" class="form-control" v-model="data.w0" placeholder="">
      </div>
      <div class="error" v-show="errors[0]">{{ errorMessage }}</div>

      <div class="input-group input-group-sm" :class="{'mb-3': !errors[1]}">
        <span class="input-group-text" id="basic-addon1">End</span>
        <input type="text" class="form-control" v-model="data.w1" placeholder="">
      </div>
      <div class="error" v-show="errors[1]">{{ errorMessage }}</div>

    </CustomModal>
  </template>
