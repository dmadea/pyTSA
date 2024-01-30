<script setup lang="ts">
import { defineProps, inject, ref, defineEmits, computed } from "vue";

const props = defineProps({
  model: {
    type: Object,
    required: false,
  },
});

const emit = defineEmits<{
  (e: "change", data: any): void;
}>();

// const onChange = (obj: Event) => {
//   var s = obj.target as HTMLSelectElement
//   console.log(s.selectedIndex);
// };

</script>

<template>

  <div class="form-check">
      <input class="form-check-input" type="checkbox" id="">
      <label class="form-check-label" for="gridCheck">
        Include chirp
      </label>
  </div>

  <div class="form-check">
      <input class="form-check-input" type="checkbox" :id="v4()">
      <label class="form-check-label" for="gridCheck">
        Include IRF
      </label>
  </div>
</template>

<style scoped>

</style>
