import { Dataset, Matrix, NumberArray, Scene, formatNumber } from "@pytsa/ts-graph";
import { APICallPOST } from "./utils";
import { reactive } from "vue";
import { SceneUser } from "./sceneuser";
import { v4 } from "uuid";

interface AssignedDataset {
  dataset: Dataset,
  key: string | number
}

export class CanvasView {

  public backendUrl: string;
  public tabIndex: number;
  public id: string;
  public scene: Scene | null = null;

  constructor(backendUrl: string, tabIndex: number) {
    this.backendUrl = backendUrl;
    this.tabIndex = tabIndex;
    this.id = v4();
  }
}

export class DataView extends CanvasView {

  public assignedDatasets: AssignedDataset[] = [];
  public scene: SceneUser | null = null;

  public mount() {
    this.scene = new SceneUser(document.getElementById(this.id) as HTMLDivElement);
  }

  public addDataset(index: number, datasets: Dataset[]) {
    if (!this.scene) return;

    this.assignedDatasets.push({
      dataset: (datasets[index] as Dataset).copy(),
      key: index,
    });
    
    this.scene.datasets = this.assignedDatasets.map((d) => d.dataset);
    this.scene.processDatasets();
    APICallPOST(`${this.backendUrl}api/add_dataset/${index}/${this.tabIndex}`);
    console.log(`addDataset called ${index}, id: ${this.id}`);
  }
  
  public removeDataset(index: number) {
    if (!this.scene) return;

    this.assignedDatasets = this.assignedDatasets.filter((d) => d.key !== index);
    this.scene.datasets = this.assignedDatasets.map((d) => d.dataset);
    this.scene.processDatasets();
    APICallPOST(`${this.backendUrl}api/remove_dataset/${index}/${this.tabIndex}`);
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
}


export class FitView extends CanvasView {

  public scene: SceneUser | null = null;
  public assignedDatasets: AssignedDataset[] = [];

  public mount() {
    this.scene = new SceneUser(document.getElementById(this.id) as HTMLDivElement);
  }

}