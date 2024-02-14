import { useState } from 'react';
import Input from './Input';
import "./fitparamstable.css";

export interface IParam {
    name: string,
    min: string,
    value: string | number,
    max: string,
    error: string | number | null,
    fixed: boolean
  }

const testData: IParam[]  = [
    {
        name: "t0",
        min: "-inf",
        value: 156,
        max: "inf",
        error: null,
        fixed: false
    },
    {
        name: "t0_p0",
        min: "-inf",
        value: 0,
        max: "inf",
        error: null,
        fixed: false
    },
    {
        name: "tau_1",
        min: "-inf",
        value: 1,
        max: "inf",
        error: "0.5",
        fixed: true
    }
]

function FitParamsTable() {

    const [data, setData] = useState<IParam[]>(testData);

    const isValidMin = (value: string, parsedNumber: number) => {
        return (!Number.isNaN(parsedNumber) && parsedNumber !== Number.POSITIVE_INFINITY && parsedNumber !== Number.NEGATIVE_INFINITY) ||
                value.toLowerCase() === "-inf";
      }


    const isValidMax = (value: string, parsedNumber: number) => {
        return (!Number.isNaN(parsedNumber) && parsedNumber !== Number.POSITIVE_INFINITY && parsedNumber !== Number.NEGATIVE_INFINITY) ||
                value.toLowerCase() === "inf" || value.toLowerCase() === "+inf";
      }

  return (
    <>
    <table className="table table-striped" style={{verticalAlign: "middle"}}>
        <thead>
            <tr>
            <th scope="col">Name</th>
            <th scope="col">Min</th>
            <th scope="col">Value</th>
            <th scope="col">Max</th>
            <th scope="col">Error</th>
            <th scope="col">Fixed</th>
            </tr>
        </thead>
        <tbody >
            {data.map((entry, index) => 
                <tr key={index}>
                    <th className="pt-1 pb-1"  scope="row">{entry.name}</th>
                    <td className="pt-1 pb-1">
                        <div className="input-group-sm">
                            <Input value={entry.min} isValidInput={isValidMin} onValueChange={(value) => setData((pData) => {pData[index].min = value; return [...pData]})} />
                        </div>
                    </td>
                    <td className="pt-1 pb-1">
                    <div className="input-group input-group-sm">
                            <Input value={entry.value} onValueChange={(value) => setData((pData) => {pData[index].value = value; return [...pData]})} />
                        </div>
                    </td>
                    <td className="pt-1 pb-1">
                    <div className="input-group input-group-sm">
                            <Input value={entry.max} isValidInput={isValidMax} onValueChange={(value) => setData((pData) => {pData[index].max = value; return [...pData]})} />
                        </div>
                    </td>
                    <td className="pt-1 pb-1">{entry.error}</td>
                    <td className="pt-1 pb-1">
                        <input className="form-check-input" type="checkbox" checked={entry.fixed} onChange={(ev) => setData(pData => {pData[index].fixed = ev.target.checked; return [...pData]})} />
                    </td>
                </tr>
            )}

        </tbody>
    </table>
    </>
  ) 
}

export default FitParamsTable
