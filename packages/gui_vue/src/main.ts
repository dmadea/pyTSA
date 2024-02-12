import { createApp } from "vue";
import App from "./App.vue";
import { createVfm } from 'vue-final-modal'
import "bootstrap/dist/css/bootstrap.css";
import 'vue-final-modal/style.css'

const app = createApp(App);

const vfm = createVfm();
app.use(vfm).mount("#app");
