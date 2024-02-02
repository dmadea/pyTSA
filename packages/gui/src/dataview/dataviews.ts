import { Dataset, Matrix, NumberArray, Scene, formatNumber } from "@pytsa/ts-graph";
import { APICallPOST } from "../utils";
import { reactive } from "vue";
import { SceneData } from "./scenedata";
import { GlobalState } from "../state";
import { CanvasView as CV } from "@pytsa/ts-graph";
import { SceneFit } from "./scenefit";

interface AssignedDataset {
  dataset: Dataset,
  key: string | number
}

export class CanvasView<T extends Scene> extends CV<T> {

  public state: GlobalState;
  public tabIndex: number;

  constructor(state: GlobalState, tabIndex: number) {
    super();
    this.state = state;
    this.tabIndex = tabIndex;
  }
}

export class DataView extends CanvasView<SceneData> {

  public assignedDatasets: AssignedDataset[] = [];

  public mount() {
    this.scene = new SceneData(document.getElementById(this.id) as HTMLDivElement);
  }

  public addDataset(index: number) {
    if (!this.scene) return;

    this.assignedDatasets.push({
      dataset: (this.state.datasets.value[index] as Dataset).copy(),
      key: index,
    });
    
    this.scene.datasets = this.assignedDatasets.map((d) => d.dataset);
    this.scene.processDatasets();
    APICallPOST(`add_dataset/${index}/${this.tabIndex}`);
    console.log(`addDataset called ${index}, id: ${this.id}`);
  }
  
  public removeDataset(index: number) {
    if (!this.scene) return;

    this.assignedDatasets = this.assignedDatasets.filter((d) => d.key !== index);
    this.scene.datasets = this.assignedDatasets.map((d) => d.dataset);
    this.scene.processDatasets();
    APICallPOST(`remove_dataset/${index}/${this.tabIndex}`);
    console.log(`removeDataset called ${index}, id: ${this.id}`);
  }

  public updateData(datasets: Dataset[]) {
    if (!this.scene) return;

    this.scene.updateData(datasets);
    console.log(`updateData called, id: ${this.id}`);
  }

  public clear() {
    if (!this.scene) return;

    this.scene.clear();
    this.scene.datasets = [];
    this.assignedDatasets = [];
    this.scene.replot();
    console.log(`cleared: ${this.id}`)
  }

  public setFitDataset(dataset: Dataset) {
    if (!this.scene) return;

    this.scene.fitDataset = dataset;
    this.scene.replot();
  }

}


export class FitView extends CanvasView<SceneFit> {

  public mount() {
    this.scene = new SceneFit(document.getElementById(this.id) as HTMLDivElement);
  }

  public updateData(x: NumberArray, y: NumberArray, C: Matrix, ST: Matrix, res: Matrix) {
    this.scene?.updateData(x, y, C, ST, res);
  }


}