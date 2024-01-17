<script setup lang="ts">
import { defineProps, inject, ref } from "vue";

const props = defineProps({
  test: {
    type: String,
    required: true,
  },
});

const backendUrl = inject("backendUrl");

const picked = ref<string>("One");

const xhr = new XMLHttpRequest();

const pingClicked = () => {
  const time = Date.now();

  xhr.onreadystatechange = () => {
    // console.log(xhr.responseText);
    if (xhr.readyState == 4 && xhr.status == 200) {
      //  && xhr.responseText == "pong"
      console.log("ping: ", Date.now() - time, "ms");
    }
  };
  // asynchronous requests
  xhr.open("GET", `${backendUrl}api/ping`, true);
  // Send the request over the network
  xhr.send(null);
};
</script>

<template>
  <div>
    <div>Picked: {{ picked }}</div>

    <input type="radio" id="one" value="One" v-model="picked" />
    <label for="one">One</label>

    <input type="radio" id="two" value="Two" v-model="picked" />
    <label for="two">Two</label>

    <button @click="pingClicked">Ping</button>
  </div>
  <div>
    <slot></slot>
    <a>
      {{ test }}
    </a>
  </div>
</template>
