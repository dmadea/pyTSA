import { useState } from 'react';
import classNames from 'classnames';
import "./Input.css";


export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    onValueChange?: (value: string) => void,
    value?: string | number,
    isValidInput?: (value: string, parsedNumber: number) => boolean,
    className?: string
}

const Input: React.FC<InputProps> = ({
  onValueChange,
  value,
  isValidInput = (value: string, parsedNumber: number) => !Number.isNaN(parsedNumber) && parsedNumber !== Number.POSITIVE_INFINITY && parsedNumber !== Number.NEGATIVE_INFINITY,
  className = "",
  ...props
  }) => {
  
  const [invalid, setInvalid] = useState<boolean>(false);
  const [text, setText] = useState<string>("");

  const validateInput = (value: string) => {
    const tValue = value.trim();
    setText(tValue);
    const num = Number(tValue); // parseFloat does not work here, but we need to check for "", because in this case Number("") returns 0, which is not correct
    // console.log(typeof value, "value", value, "number:", num);

    if (tValue !== "" && isValidInput(value, num)) {
      setInvalid(false);
      if (onValueChange) onValueChange(value);
    } else {
      setInvalid(true);
    }
  }

  return (
    <input {...props} className={classNames(className, "form-control", {"form-control-error": invalid})}
    value={invalid ? text : (value ?? text)} onChange={(ev) => validateInput(ev.target.value)} />
  ) 
}

export default Input
