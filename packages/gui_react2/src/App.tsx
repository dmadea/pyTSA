import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.min.js";

import { Button } from "react-bootstrap";
import { GlobalState } from "./globalstate";
import { useSignals } from "@preact/signals-react/runtime";
import Tabs from './Components/tabs';
import Tab from "./Components/tab";
import Input from "./Components/Input";
import FitWidget from "./Components/FitWidget";

const state = GlobalState.getInstance();


function App() {
  useSignals();

  const isValid = (value: string, parsedNumber: number) => {
    return (!Number.isNaN(parsedNumber) && parsedNumber !== Number.POSITIVE_INFINITY && parsedNumber !== Number.NEGATIVE_INFINITY) ||
            value.toLowerCase() === "inf";
  }

  return (
    <>
      <div className="container-fluid my-2">
        <div className="row">
          <div className="col">

          {/* <Button variant="primary" onClick={() => state.activeTab.value = 0}>Primary</Button>

        <Input returnType="string" isValidInput={isValid}/> */}

        <Tabs newTabButton onNewTabClicked={() => state.addNewTab()} 
              selected={state.activeTab.value} 
              onSelect={(index: number) => state.activeTab.value = index}
              onClose={(index: number) => state.removeTab(index)}>

            {state.tabs.value.map((tab, index) => {
              return <Tab key={index} title={tab.name}>
                {tab.name} {tab.id}

                {[0, 1, 2, 3, 4, 5, 6].map(() => {
                  return  (<div className="input-group input-group-sm mb-1">
                          <span className="input-group-text">Label</span>
                        <Input/>
                        <span className="input-group-text">Label</span>
                        <Input/>
                        </div>)
                })}
                
              </Tab>
            })}
        </Tabs>



          </div>
          <div className="col-auto">
            <FitWidget />
          </div>
        </div>
        

      </div>
      
    </>
  )
}

export default App
