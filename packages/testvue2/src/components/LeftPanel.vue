<script setup lang="ts">
import { defineProps, inject, ref } from "vue";

const props = defineProps({
  datasets: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <div v-for="(dataset, index) in datasets" :key="index">
    <input type="checkbox" :checked="true" />
    <p>{{ dataset.name }}</p>
  </div>
</template>

<style></style>
