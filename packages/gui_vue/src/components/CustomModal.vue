<script setup lang="ts">
  import { defineEmits} from 'vue';
import { VueFinalModal } from 'vue-final-modal'

  defineProps<{
    title?: string
  }>()

  const emit = defineEmits<{
    (e: 'submit'): void
    (e: 'cancel'): void

  }>()

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

      <hr/>
      <div class="modal-footer">
        <button class="btn btn-outline-danger" @click="emit('cancel')">
            Cancel
          </button>
          <button class="btn btn-outline-success" @click="emit('submit')">
            Confirm
          </button>
      </div>

    </VueFinalModal>
  </template>

  <style>
  .confirm-modal {
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .confirm-modal-content {
    /*display: flex;
    flex-direction: column;*/
    padding: 1rem;
    background: #fff;
  }
  .confirm-modal-content > * + *{
    margin: 0.5rem 0;
  }
  .confirm-modal-content h1 {
    font-size: 1.375rem;
  }
   .confirm-modal-content button {
    /* margin: 0.25rem 0 0 auto; */
    margin-left: 5px;
    padding: 0 8px;
    /*border: 1px solid;
    border-radius: 0.5rem;*/
  }

  .dark .confirm-modal-content {
    background: #000;
  }
  
  .error {
    color: rgb(255, 0, 0);
    font-size: small;
  }
  </style>