import { useState } from 'react';
import classNames from 'classnames';
import "./Input.css";

export type InputType = "text" | "number";

export interface InputProps {
    onChange?: (value: string | number) => void,
    type: InputType,
    value?: string | number,
    isValidInput: (value: string, parsedNumber: number) => boolean,
}

function Input({
  onChange,
  type,
  value,
  isValidInput = (value: string, parsedNumber: number) => !Number.isNaN(parsedNumber),
  ...props
  }: InputProps) {
  
  const [invalid, setInvalid] = useState<boolean>(false);
  const [text, setText] = useState<string>("");

  const validateInput = (value: string) => {
    setText(value);
    const num = parseFloat(value);

    if (isValidInput(value, num)) {
      setInvalid(false);
      if (onChange) onChange(num);
    } else {
      setInvalid(true);
      // console.log("number is invalid");
    }
  }

  return (
    <input {...props} className={classNames("form-control", {"form-control-error": invalid})} type={type} 
    value={invalid ? text : (value ?? text)} onChange={(ev) => validateInput(ev.target.value)}  />
  ) 
}

export default Input
