<script setup lang="ts">
  import { reactive, defineEmits, defineProps, ref, PropType} from 'vue';
import CustomModal from './CustomModal.vue'

const props = defineProps({
  selection: {
    type: Array as PropType<string[]>,
    required: false
  }
})

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
      data.w0 = props.selection[0];
      data.w1 = props.selection[1];
      data.t0 = props.selection[2];
      data.t1 = props.selection[3];
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
