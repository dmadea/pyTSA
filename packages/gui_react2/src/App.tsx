import { Button } from "react-bootstrap";
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import { GlobalState } from "./globalstate";
import { useSignals } from "@preact/signals-react/runtime";

const state = GlobalState.getInstance();


function App() {
  useSignals();

  const onSelect = (key: string | null) => {
    if (key === "new tab") {
      state.addNewTab();
    } else {
      state.activeTab.value = key as string;
    }
  }

  return (
    <>
      <p >
        Click on the Vite and React logos to learn more
      </p>
      <Button variant="primary" onClick={() => console.log("asdd")}>Primary</Button>
      <Tabs
      activeKey={state.activeTab.value}
      onSelect={onSelect}
      className="mb-3"
    >
      {state.tabs.value.map((tab, index) => {
        return (
          <Tab key={index} eventKey={tab.id} title={`Tab ${index}`}>
          Tab content for {tab.name} id: {tab.id}
          </Tab>
        )
      })}
        <Tab eventKey="new tab" title="+"></Tab>
    </Tabs>
    </>
  )
}

export default App
