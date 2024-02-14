import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.min.js";
import { GlobalState } from "./globalstate";
import { useSignals } from "@preact/signals-react/runtime";
import Tabs from './Components/tabs';
import Tab from "./Components/tab";
import Input from "./Components/Input";
import FitWidget from "./Components/FitWidget";

const state = GlobalState.getInstance();


function App() {
  useSignals();

  const handleOnSelect = (id: string | number) => {
    state.tabs.value.map((tab, index) => {
      if (tab.id === id) state.activeTab.value = index;
    })
  }

  return (
    <>
      <div className="container-fluid my-2">
        <div className="row">
          <div className="col">

          {/* <Button variant="primary"   onClick={() => state.activeTab.value = 0}>Primary</Button>

        <Input returnType="string" isValidInput={isValid}/> */}

        <Tabs newTabButton onNewTabClicked={() => state.addNewTab()} 
              selectedKey={state.tabs.value[state.activeTab.value].id} 
              onSelect={handleOnSelect}
              onClose={id => state.removeTab(id)}>

            {state.tabs.value.map(tab => {
              return <Tab id={tab.id} key={tab.id} title={tab.name}>
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


    <button type="button" className="btn btn-primary" data-bs-toggle="modal" data-bs-target="#exampleModal">
      Launch demo modal
    </button>

    <div className="modal fade" id="exampleModal"  aria-labelledby="exampleModalLabel" aria-hidden="true">
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="exampleModalLabel">Modal title</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            Lorem ipsum dolor sit amet consectetur, adipisicing elit. Alias sit deserunt maxime ullam dolorem unde autem, facilis aspernatur velit expedita possimus, at deleniti labore perferendis quod natus accusamus. Ratione, dolor.
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-danger btn-sm" data-bs-dismiss="modal">Cancel</button>
            <button type="button" className="btn btn-outline-success btn-sm">Confirm</button>
          </div>
        </div>
      </div>
    </div>
      
    </>
  )
}

export default App
