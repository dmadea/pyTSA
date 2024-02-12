import { Signal, signal, batch } from "@preact/signals-react";
import { v4 } from "uuid";
import { CanvasView } from "./canvasview";

export interface ITabData {
    selectedDatasets: number[],
    selectedFitModel: number,
    activePanel: number,
    isFitting: boolean,
    name: string,
    id: string
  }


export class GlobalState {

    private static _instance: GlobalState;
    public activeTab: Signal<number>;
    public tabs: Signal<ITabData[]>;
    public view: CanvasView;

    private constructor() {
        this.activeTab = signal<number>(0);
        this.tabs = signal<ITabData[]>([]);
        
        this.view = new CanvasView();
        this.addNewTab();
    }

    public addNewTab() {
        batch(() => {
            this.tabs.value = [...this.tabs.value, {
                selectedDatasets: [],
                selectedFitModel: 0,
                activePanel: 0,
                isFitting: false,
                name: "abc",
                id: v4()
            }];
            this.activeTab.value = this.tabs.value.length - 1;
        })

        // this.tabs.value.push({
        //     selectedDatasets: [],
        //     selectedFitModel: 0,
        //     activePanel: 0,
        //     isFitting: false,
        //     name: "abc"
        // })

        console.log('new tab added', this.tabs.value);

    }

    // public static create(): GlobalState {


    // }

    public static getInstance(): GlobalState {
        if (!GlobalState._instance) {
            GlobalState._instance = new GlobalState();
        }

        return GlobalState._instance;
    }

 }