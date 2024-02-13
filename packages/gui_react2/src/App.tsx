import "bootstrap/dist/css/bootstrap.min.css";
import { Button } from "react-bootstrap";
import { GlobalState } from "./globalstate";
import { useSignals } from "@preact/signals-react/runtime";
import Tabs from './Components/tabs';
import Tab from "./Components/tab";
import Input from "./Components/Input";

const state = GlobalState.getInstance();


function App() {
  useSignals();

  return (
    <>
      <p >
        Click on the Vite and React logos to learn more
      </p>

      <div className="container-fluid">
        <Button variant="primary" onClick={() => state.activeTab.value = 0}>Primary</Button>

        <Tabs newTabButton onNewTabClicked={() => state.addNewTab()} 
              selected={state.activeTab.value} 
              onSelect={(index: number) => state.activeTab.value = index}
              onClose={(index: number) => state.removeTab(index)}>

            {state.tabs.value.map((tab, index) => {
              return <Tab key={index} title={tab.name}>
                {tab.name} {tab.id}

                {[0, 1, 2, 3, 4, 5, 6].map((v: number) => {

                  return  (<div className="input-group input-group-sm mb-1">
                          <span className="input-group-text">Label</span>
                        <Input type="number"/>
                        <span className="input-group-text">Label</span>
                        <Input type="number"/>
                        <span className="input-group-text">Label</span>
                        <Input type="number"/>
                        </div>)
                })}
                
              </Tab>
            })}
        </Tabs>

      </div>
      
    </>
  )
}

export default App
