import { useState } from 'react';
import "bootstrap/dist/css/bootstrap.css";
import Input from './Input';

function App() {
  const [count, setCount] = useState(0);
  const [value, setValue] = useState<number>(0);


  return (
    <>
    <div className="container">
      <div className="row">
        <div className="col">
          Col 1
          <Input type="number" onChange={(value) => setValue(value as number)} value={value}/>
        </div>
        <div className="col">
          <button className='btn btn-primary btn-sm' onClick={() => setCount((count) => count + 1)}>
            count asldiajosd is {count}
          </button>
          Col 2
        </div>
      </div>


    </div>


    </>
  ) 
}

export default App
