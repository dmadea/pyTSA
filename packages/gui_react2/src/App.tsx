import { Button } from "react-bootstrap";
import { GlobalState } from "./globalstate";
import { useSignals } from "@preact/signals-react/runtime";
import Tabs from './Components/tabs';
import Tab from "./Components/tab";

const state = GlobalState.getInstance();


function App() {
  useSignals();

  return (
    <>
      <p >
        Click on the Vite and React logos to learn more
      </p>
      <Button variant="primary" onClick={() => console.log("asdd")}>Primary</Button>

      <Tabs id="asdd" newTabButton onNewTabClicked={() => state.addNewTab()} 
            selected={state.activeTab.value} 
            onSelect={(index: number) => state.activeTab.value = index}
            onClose={(index: number) => state.removeTab(index)}>
          {state.tabs.value.map((tab, index) => {
            return <Tab key={index} title={tab.name}>
              Tab content {tab.name} {tab.id}
            </Tab>
          })}
      </Tabs>
    </>
  )
}

export default App
