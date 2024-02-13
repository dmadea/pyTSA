
import classNames from "classnames";
import { useState } from "react";

interface TabButtonProps {
    id?: string,
    active: boolean,
    onClose?: () => void,
    onClick?: () => void,
    title: string
}

 function TabButton ({ id, active, onClose, onClick, title}: TabButtonProps) {

    const [style, setStyle] = useState<{display: "none" | "block"}>({display: 'none'});

  return (
    <>
        <button className={classNames("nav-link me-8", {active})} style={{position: "relative", paddingRight: "35px"}} onClick={onClick}
         onMouseEnter={(ev) => {
            setStyle({display: "block"});
        }}
        onMouseLeave={(ev) => {
            setStyle({display: "none"});
        }}>
            {title}
            <button className="btn btn-outline-danger btn-sm" style={{position: "absolute", bottom: 0, right: 0, transform: "translate(-35%, -35%)", padding: "0px 5px", margin: "0px",
             display: active ? "block" : style.display}}  onClick={onClose} type="button" role="tab">&times;</button>
        </button>
    </>
  );
};

export default TabButton;