<script setup lang="ts">
  import { reactive, defineEmits , ref} from 'vue';
import CustomModal from './CustomModal.vue'

  const emit = defineEmits<{
    (e: 'submit', data: any): void
    (e: 'cancel'): void
  }>()

  const data = reactive({
    t0: "",
    t1: "",
  })

const errorMessage: string = "Invalid input, provide a number or keep the area blank!";
const errors = ref<boolean[]>([false, false]);

  const submit = () =>  {

    const parsedData = {
      t0: data.t0 === "" ? null : parseFloat(data.t0),
      t1: data.t1 === "" ? null : parseFloat(data.t1)
    }

    errors.value.fill(false);
    
    if (Number.isNaN(parsedData.t0)) {
      errors.value[0] = true;
    }
    if (Number.isNaN(parsedData.t1)) {
      errors.value[1] = true;
    }

    if (errors.value.includes(true)) {
      return;
    }

    emit('submit', parsedData)
  };


  </script>

  <template>
    <CustomModal title="Baseline correct datasets" @cancel="emit('cancel')" @submit="submit">
      <span>Time range:</span>
      <div class="input-group input-group-sm" :class="{'mb-3': !errors[0]}">
        <span class="input-group-text" id="basic-addon1">Start</span>
        <input type="text" class="form-control" v-model="data.t0" placeholder="">
      </div>
      <div class="error" v-show="errors[0]">{{ errorMessage }}</div>

      <div class="input-group input-group-sm" :class="{'mb-3': !errors[1]}">
        <span class="input-group-text" id="basic-addon1">End</span>
        <input type="text" class="form-control" v-model="data.t1" placeholder="">
      </div>
      <div class="error" v-show="errors[1]">{{ errorMessage }}</div>

    </CustomModal>
  </template>
