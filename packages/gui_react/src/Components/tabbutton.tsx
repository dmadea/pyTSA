
import classNames from "classnames";
import { useState } from "react";

interface TabButtonProps {
    id?: string,
    active: boolean,
    onClose?: () => void,
    onClick?: () => void,
    title: string
}

 const TabButton: React.FC<TabButtonProps> = ({ id, active, onClose, onClick, title, ...props}) => {

    const [style, setStyle] = useState<{display: "none" | "block"}>({display: 'none'});

    const handleClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.stopPropagation();
      if (onClose) onClose();
    }

    return (
    <>
      <div {...props} style={{position: "relative"}} onMouseEnter={() => {
              setStyle({display: "block"});
          }}
          onMouseLeave={() => {
              setStyle({display: "none"});
          }}>
          <button className={classNames("nav-link", {active})} style={{paddingRight: "35px"}} onClick={onClick}
          >{title}</button>
          <button className="btn btn-outline-danger btn-sm" style={{position: "absolute", bottom: 0, right: 0, 
            transform: "translate(-81%, -81%)", padding: "0px 2px 2.5px 2px", margin: "0px",
            lineHeight: "11px", display: active ? "block" : style.display}}  onClick={handleClick}
            type="button" role="tab">&times;</button>
      </div>
    </>
  );
};

export default TabButton;