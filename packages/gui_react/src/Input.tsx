import { useState } from 'react';
import "./Input.css";

export type InputType = "text" | "number";

export interface InputProps {
    onChange: (value: string | number) => void,
    type: InputType,
    value: string | number,
    min?: number,
    max?: number,
    step?: number
}


function Input({onChange, type, value, min, max, step}: InputProps) {
  const [invalid, setInvalid] = useState<boolean>(false);
  const [invalidText, setInvalidText] = useState<string>("");

  const validateInput = (value: string) => {
    const num = parseFloat(value);

    if (Number.isNaN(num)) {
        setInvalid(true);
        setInvalidText(value);
        console.log("number is invalid");
    } else {
        setInvalid(false);
        onChange(num);
    }

  }

  return (
    <input className={"form-control" + (invalid ? " form-control-error" : "")} type={type} min={min} max={max} step={step}
    value={invalid ? invalidText : value} onChange={(ev) => validateInput(ev.target.value)}  />
  ) 
}

export default Input
