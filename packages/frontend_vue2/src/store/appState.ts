import { reactive } from "vue";

/** Lightweight global state (no Pinia / Redux-style boilerplate). */
export const appState = reactive({
  plotRedraws: 0,
  theme: "dark" as "dark" | "paper",
  pointCount: 400,
  noise: 0.15,
});
