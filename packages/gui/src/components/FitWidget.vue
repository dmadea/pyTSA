<script setup lang="ts">
import { defineProps, inject, ref, defineEmits, computed } from "vue";
// import { APICallPOST, json2arr, parseDatasets } from "@/utils";
// import { Icon } from '@iconify/vue';
// import { ModalsContainer, useModal } from 'vue-final-modal'
import { v4 } from "uuid";


const props = defineProps({
  params: {
    type: Object,
    required: false,
  },
});

const backendUrl = inject("backendUrl");

const emit = defineEmits<{
  (e: "fit"): void;
  (e: "simulate"): void;
}>();

const iconWidth: string = "30";

// const dimensionMultiply = () => {
//   const { open, close } = useModal({
//     component: ModalDimensionMultiply,
//     attrs: {
//       onSubmit(data: any) {
//         APICallPOST(`${backendUrl}api/perform/dimension_multiply/${props.data.activeTab}`, data, obj => {
//           const datasets = parseDatasets(obj);
//           canvasInterfaces[props.data.activeTab].updateData(datasets);
//         })
//         close();
//       },
//       onCancel() {
//         close();
//       }
//     },
//   });

//   open();
// };



const dataparams = [
  {
    name: "param1",
    min: "-inf",
    value: "1",
    max: "inf",
    error: "0",
    vary: false
  },
  {
    name: "param2",
    min: "-inf",
    value: "4",
    max: "inf",
    error: "0",
    vary: false

  },
  {
    name: "param3",
    min: "-inf",
    value: "10.08345",
    max: "inf",
    error: "0",
    vary: true

  }
]

const kineticModels = ['First order', 'First order with LPL']

const onChange = (obj: Event) => {
  var s = obj.target as HTMLSelectElement
  console.log(s.selectedIndex);
};

</script>

<template>

  <h3 class=""> Fitting</h3>

  
  <h6 class=""> Model</h6>
  
  <div class="input-group input-group-sm mb-3">
    <label class="input-group-text" for="inputGroupSelect01">Kinetic model</label>
    <select class="form-select" id="inputGroupSelect01" :onchange="onChange">
      <option v-for="(opt, index) in kineticModels" :key="index" :value="index">{{ opt }}</option>
    </select>
  </div>

  <div class="form-check">
      <input class="form-check-input" type="checkbox" :id="v4()">
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

  <button class="btn btn-outline-success">Simulate model</button>
  <button class="btn btn-outline-secondary">Fit</button>
  
  <h4 class=""> Params</h4>

  <table class="table table-striped">
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Min</th>
      <th scope="col">Value</th>
      <th scope="col">Max</th>
      <th scope="col">Error</th>
      <th scope="col">Fixed</th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="(entry, index) in dataparams" :key="index">
      <th scope="row">{{ entry.name }}</th>
      <td><input class="input-group-text" type="text" size="2" :value="entry.min"/></td>
      <td><input class="input-group-text" type="text" size="5" :value="entry.value"/></td>
      <td><input class="input-group-text" type="text" size="2" :value="entry.max"/></td>
      <td>{{ entry.error }}</td>
      <td><input class="form-check-input" type="checkbox" :checked="!entry.vary"/></td>
    </tr>
  </tbody>
</table>



  <!-- <div>
    <div class="accordion" id="accordionPanelsStayOpenExample">
  <div class="accordion-item">
    <h2 class="accordion-header" id="panelsStayOpen-headingOne">
      <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseOne" aria-expanded="true" aria-controls="panelsStayOpen-collapseOne">
        Accordion Item #1
      </button>
    </h2>
    <div id="panelsStayOpen-collapseOne" class="accordion-collapse collapse show" aria-labelledby="panelsStayOpen-headingOne">
      <div class="accordion-body">
        <strong>This is the first item's accordion body.</strong> It is shown by default, until the collapse plugin adds the appropriate classes that we use to style each element. These classes control the overall appearance, as well as the showing and hiding via CSS transitions. You can modify any of this with custom CSS or overriding our default variables. It's also worth noting that just about any HTML can go within the <code>.accordion-body</code>, though the transition does limit overflow.
      </div>
    </div>
  </div>
  <div class="accordion-item">
    <h2 class="accordion-header" id="panelsStayOpen-headingTwo">
      <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseTwo" aria-expanded="false" aria-controls="panelsStayOpen-collapseTwo">
        Accordion Item #2
      </button>
    </h2>
    <div id="panelsStayOpen-collapseTwo" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingTwo">
      <div class="accordion-body">
        <strong>This is the second item's accordion body.</strong> It is hidden by default, until the collapse plugin adds the appropriate classes that we use to style each element. These classes control the overall appearance, as well as the showing and hiding via CSS transitions. You can modify any of this with custom CSS or overriding our default variables. It's also worth noting that just about any HTML can go within the <code>.accordion-body</code>, though the transition does limit overflow.
      </div>
    </div>
  </div>
  <div class="accordion-item">
    <h2 class="accordion-header" id="panelsStayOpen-headingThree">
      <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseThree" aria-expanded="false" aria-controls="panelsStayOpen-collapseThree">
        Accordion Item #3
      </button>
    </h2>
    <div id="panelsStayOpen-collapseThree" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingThree">
      <div class="accordion-body">
        <div data-bs-spy="scroll" data-bs-target="#navbar-example3" data-bs-offset="0" tabindex="0">
      <h4 id="item-1">Item 1</h4>
      <p>...</p>
      <h5 id="item-1-1">Item 1-1</h5>
      <p>...</p>
      <h5 id="item-1-2">Item 1-2</h5>
      <p>...</p>
      <h4 id="item-2">Item 2</h4>
      <p>...</p>
      <h4 id="item-3">Item 3</h4>
      <p>...</p>
      <h5 id="item-3-1">Item 3-1</h5>
      <p>...</p>
      <h5 id="item-3-2">Item 3-2</h5>
      <p>...</p>
      </div>
    </div>
  </div>
</div>
  </div>
  
</div> -->
</template>

<style scoped>

.text-field {
  /* width: 98%;
  padding: 1%; */
}

</style>
