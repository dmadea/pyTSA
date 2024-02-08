import { Dataset, Matrix, NumberArray, Point, Scene, formatNumber, formatNumber2String } from "@pytsa/ts-graph";
import { APICallPOST } from "../utils";
import { reactive } from "vue";
import { SceneData } from "./scenedata";
import { GlobalState } from "../state";
import { CanvasView as CV } from "@pytsa/ts-graph";
import { SceneFit } from "./scenefit";
import { IFitParsedData } from "./fitmodel";
import { CropData } from "@/components/types";

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

  public getDataset(index: number) {
    return this.assignedDatasets.filter(a => a.key === index)[0].dataset;
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

  public activateChirpSelection() {
    this.scene?.activateChirpSelection();
  }

  public getChirpSelectionData(): Point[] | null {
    if (!this.scene || !this.scene.roi) return null;

    return this.scene.roi.getPositions(true);
  }

  public getCurrentMatrixSelection(index: number = 0): CropData | undefined {
    if (!this.scene) return;

    const rng = this.scene.groupPlots[index].heatmapFig.range;
    return {
      w0: formatNumber2String(rng.x, 4, "-"),
      w1: formatNumber2String(rng.x + rng.w, 4, "-"),
      t0: formatNumber2String(rng.y, 4, "-"),
      t1: formatNumber2String(rng.y + rng.h, 4, "-")
    }
  }

  public updateData(datasets: Dataset[]) {
    if (!this.scene) return;

    for (let i = 0; i < this.assignedDatasets.length; i++) {
      this.assignedDatasets[i].dataset = datasets[i];
    }

    this.scene.updateData(this.assignedDatasets.map((d) => d.dataset));
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

  public updateFitData(dataset: Dataset, chirpData?: NumberArray) {
    this.scene?.updateFitData(dataset, chirpData);
  }

}


export class FitView extends CanvasView<SceneFit> {

  public mount() {
    this.scene = new SceneFit(document.getElementById(this.id) as HTMLDivElement);
  }

  public updateData(x: NumberArray, y: NumberArray, parsedData: IFitParsedData) {
    this.scene?.updateData(x, y, parsedData);
  }


}