<script setup lang="ts">
  import { reactive, defineEmits , ref} from 'vue';
import CustomModal from './CustomModal.vue'

  const emit = defineEmits<{
    (e: 'submit', data: any): void
    (e: 'cancel'): void
  }>()

  const data = reactive({
    x: "1.0",
    y: "1.0",
    z: "1.0",
  })

const errorMessage: string = "Invalid input, provide a valid non-zero number!";
const errors = ref<boolean[]>([false, false]);

  const submit = () =>  {

    const parsedData = {
      x: parseFloat(data.x),
      y: parseFloat(data.y),
      z: parseFloat(data.z),
    }

    errors.value.fill(false);
    
    if (Number.isNaN(parsedData.x) || parsedData.x === 0) {
      errors.value[0] = true;
    }
    if (Number.isNaN(parsedData.y) || parsedData.y === 0) {
      errors.value[1] = true;
    }
    if (Number.isNaN(parsedData.z) || parsedData.z === 0) {
      errors.value[2] = true;
    }

    if (errors.value.includes(true)) {
      return;
    }

    emit('submit', parsedData)
  };


  </script>

  <template>
    <CustomModal title="Dimension  multiply" @cancel="emit('cancel')" @submit="submit">
      <div class="input-group input-group-sm" :class="{'mb-3': !errors[0]}">
        <span class="input-group-text" id="basic-addon1">X axis</span>
        <input type="number" step="0.1" class="form-control" v-model="data.x" placeholder="">
      </div>
      <div class="error" v-show="errors[0]">{{ errorMessage }}</div>

      <div class="input-group input-group-sm" :class="{'mb-3': !errors[1]}">
        <span class="input-group-text" id="basic-addon1">Y axis</span>
        <input type="number" step="0.1" class="form-control" v-model="data.y" placeholder="">
      </div>
      <div class="error" v-show="errors[1]">{{ errorMessage }}</div>

      <div class="input-group input-group-sm" :class="{'mb-3': !errors[2]}">
        <span class="input-group-text" id="basic-addon1">Z axis</span>
        <input type="number" step="0.1" class="form-control" v-model="data.z" placeholder="">
      </div>
      <div class="error" v-show="errors[2]">{{ errorMessage }}</div>

    </CustomModal>
  </template>
