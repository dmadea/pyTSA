import { useState } from 'react';
import FitParamsTable from './fitparamstable';
import FitOptions from './fitoptions';

function FitWidget() {
  
  const [invalid, setInvalid] = useState<boolean>(false);


  return (
    <>
        <div className="input-group input-group-sm mb-1">
            <span className="input-group-text">Kinetic model</span>
            <select className='form-select' value="Option 2">
                <option disabled> Please select one</option>
                <option> Option 1</option>
                <option> Option 2</option>
                <option> Option 3</option>

            </select>
        </div>

        <div className="d-flex justify-content-start my-2">
            <button className="btn btn-outline-primary btn-sm me-2">Simulate model</button>
            <button className="btn btn-outline-success btn-sm me-2">Fit</button>
            <button className="btn btn-outline-secondary btn-sm me-2">Fit chirp params</button>
        </div>

        <div className="accordion">
            <div className="accordion-item">
                <h2 className="accordion-header">
                    <button className="accordion-button py-2" type="button" data-bs-toggle="collapse" data-bs-target="#model-options">
                        Kinetic Model Options
                    </button>
                </h2>
                <div className="accordion-collapse collapse show" id="model-options">
                    <div className="accordion-body py-2 px-2">
                        <FitOptions />
                    </div>
                </div>
            </div>
            <div className="accordion-item">
                <h2 className="accordion-header">
                    <button className="accordion-button collapsed py-2" type="button" data-bs-toggle="collapse" data-bs-target="#fit-params">
                        Fit parameters
                    </button>
                </h2>
                <div className="accordion-collapse collapse" id="fit-params">
                    <div className="accordion-body py-2 px-2">
                        <FitParamsTable />
                    </div>
                </div>
            </div>

        </div>
    </>
  ) 
}

export default FitWidget
