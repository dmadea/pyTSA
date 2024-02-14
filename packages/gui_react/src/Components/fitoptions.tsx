import { useState } from 'react';
import Input from './Input';

type OptionType = "text" | "number" | "checkbox" | "array" | "select";

interface IOptionBase {
    name: string,
    type: OptionType
    backendName: string,
    value: any
}

interface ITextOption extends IOptionBase {
    type: "text"
    value: string,
}

interface INumberOption extends IOptionBase {
    type: "number",
    value: string,
    min?: number,
    max?: number,
    step?: number
}

interface ICheckBoxOption extends IOptionBase {
    type: "checkbox"
    value: boolean,
}

interface IArrayOption extends IOptionBase {
    type: "array",
    value: string[],
    entryNames: string[]
}

interface ISelectOption extends IOptionBase {
    type: "select",
    selectOptions: string[]
    value: string,
}

export type IOption = ITextOption | INumberOption | ICheckBoxOption | IArrayOption | ISelectOption;


const testData: IOption[]  = [
    {
        name: "include IRF",
        type: "checkbox",
        backendName: "bbb",
        value: true
    },
    {
        name: "number of stuff",
        type: "number",
        backendName: "bbb",
        value: "28",
        min: 1,
        max: 10,
        step: 1
    },
    {
        name: "include asdd",
        type: "checkbox",
        backendName: "bbb",
        value: false
    },
    {
        name: "select option",
        type: "select",
        backendName: "bbb",
        value: "option 1",
        selectOptions: ["option 1", "option 2", "option 5"]
    },
    {
        type: "array",
        name: "select array",
        backendName: "bbb",
        value: ["a", "b"],
        entryNames: ["a 1", "b 2"]
    },
    
]

function FitOptions() {

    const [data, setData] = useState<IOption[]>(testData);


    const innerContent = (entry: IOption, index: number) =>  {
        switch (entry.type) {
            case "text": {
                return <Input type="text" value={entry.value} />
            }
            case "number": {
                return <Input type="number" {...{min: entry.min, max: entry.max, step: entry.step}} value={entry.value} />
            }
            case "select": {
                return (
                    <select className='form-select' value={entry.value}>
                        <option disabled>Please select one</option>
                        {entry.selectOptions.map((op: string, opIndex: number) => 
                            <option key={`option_${opIndex}${index}`}>{op}</option>)}
                    </select>
                )
            }
            case "array": {
                return  entry.entryNames.map((name: string, eIndex: number) =>  {
                    return (<>
                                <span key={`span_${eIndex}`} className="input-group-text">{name}</span>
                                <Input key={`input_${eIndex}${index}`} value={entry.value[eIndex]} type="text" />
                            </>)
                })
            }
            default:
                return
        }
    }


  return data.map((entry, index) => {
            if (entry.type === "checkbox") {
                return (
                    <div key={index} className="form-check input-group-sm mb-0 mt-0">
                        <input className="form-check-input" type="checkbox" checked={entry.value} id={`checkbox_${index}`} />
                        <label className="form-check-label small" htmlFor={`checkbox_${index}`}>{entry.name}</label>
                    </div>
                )
            } else {
                return (
                    <div key={index} className="input-group input-group-sm mb-1">
                        <span className="input-group-text">{entry.name}</span>
                        {innerContent(entry, index)}
                    </div>
                )
            }
        })
}

export default FitOptions
