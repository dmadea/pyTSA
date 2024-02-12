import { useState } from 'react';
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.min.js";
import Input from './Components/Input';
import { GlobalState, ITabData } from './globalstate';
import { useSignals } from "@preact/signals-react/runtime";
// https://github.com/preactjs/signals/issues/469

import Canvas from './test';

const state = GlobalState.getInstance();

export interface ITab {
  name: string
}

// const tabs = signal<ITab[]>([]);

// function addNewTab() {
//   tabs.value = [...tabs.value, {name: 'asd'}]
//   console.log("addNewTab", tabs.value)
// }

// addNewTab()
// addNewTab()


function App() {
  // const [count, setCount] = useState(0);
  const [value, setValue] = useState<number>(0);

  useSignals();


  return (
    <>
    <div className="container">
      <div className="row">
        <div className="col">
          Col 1 test
          <Input type="number" onChange={(value) => setValue(value as number)} value={value}/>
        </div>
        <div className="col">
          Col 2 test

          <button className='btn btn-secondary btn-sm' onClick={() => state.addNewTab()}>
            Add new tab
          </button>
          <button className='btn btn-secondary btn-sm' onClick={() =>  {state.tabs.value[0].name = "new name 555"; state.tabs.value = [...state.tabs.value]}}>
            change something in tab
          </button>
        </div>
        {/* {state.tabs.value.map((tab: ITab, index: number) => {
          
          return <div key={index} className='col'>{tab.name}</div>
        
        })} */}

      </div>


      <nav>
      <div className="nav nav-tabs" id="nav-tab" role="tablist">
        {state.tabs.value.map((tab: ITabData, index: number) => {
           return <button className={"nav-link" + ((index === state.activeTab.value) ? " active" : "")} key={index} id={`btn${tab.id}`}
           data-bs-toggle="tab" data-bs-target={`#tab${tab.id}`} type="button" role="tab"
            aria-controls="nav-home" aria-selected="false">{`Tab ${index}`}</button>
        })}

        {/* <button className="nav-link active" id="nav-home-tab" data-bs-toggle="tab" data-bs-target="#nav-home" type="button" role="tab" aria-controls="nav-home" aria-selected="true">Home</button>
        <button className="nav-link" id="nav-profile-tab" data-bs-toggle="tab" data-bs-target="#nav-profile" type="button" role="tab" aria-controls="nav-profile" aria-selected="false">Profile</button>
        <button className="nav-link" id="nav-contact-tab" data-bs-toggle="tab" data-bs-target="#nav-55" type="button" role="tab" aria-controls="nav-contact" aria-selected="false">Contact</button> */}
        <button className="nav-link" type="button" role="tab" aria-selected="false" onClick={() => state.addNewTab()}>+</button>
      </div>
      </nav>
      <div className="tab-content" id="nav-tabContent">
        {state.tabs.value.map((tab: ITabData, index: number) => {
           return <div className={"tab-pane fade" + ((index === state.activeTab.value) ? " show active" : "")} id={`tab${tab.id}`} role="tabpanel" aria-labelledby="nav-home-tab">content tab {index}
           <Canvas /></div>
        })}

        {/* <div className="tab-pane fade show active" id="nav-home" role="tabpanel" aria-labelledby="nav-home-tab">a tab 1</div>
        <div className="tab-pane fade" id="nav-profile" role="tabpanel" aria-labelledby="nav-profile-tab">b</div>
        <div className="tab-pane fade" id="nav-55" role="tabpanel" aria-labelledby="nav-contact-tab">c</div> */}
      </div>


    </div>




    </>
  ) 
}

export default App
