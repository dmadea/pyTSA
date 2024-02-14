import classNames from "classnames";
import { useState, PropsWithChildren, useEffect } from "react";
import { TabElement } from "./tab";
import TabButton from "./tabbutton";
import React from "react";

interface TabsProps {
    id?: string,
    onSelect?: (key: number | string) => void,
    onClose?: (key: number | string) => void,
    selectedKey?: number | string,
    newTabButton?: boolean,
    onNewTabClicked?: () => void,
}

 const Tabs: React.FC<PropsWithChildren<TabsProps>> =  ({ id, onSelect, onClose, selectedKey, newTabButton, onNewTabClicked, children }) => {
  const [_activeKey, _setActiveKey] = useState<string | number>(0);

//   useEffect(() => {if (children) _setActiveKey(chil)}, []);

  const activeKey = selectedKey ?? _activeKey;
  const _onSelect = (id: number | string) => {
    if (onSelect) {
        onSelect(id);
        return;
    } else {
        _setActiveKey(id);
    }
  }

  return (
    <>
        <ul className="nav nav-tabs" id={id} role="tablist">
            {React.Children.map(children, (child, index: number) => {
                const {id, title} = (child as TabElement).props;
                return (<li key={id} className="nav-item" role="presentation">
                            <TabButton onClick={() => _onSelect(id)} onClose={() => {if (onClose) onClose(id)}} 
                            title={title} active={activeKey === id}/>
                        </li>)
            })}
            {newTabButton && <li className="nav-item" role="presentation">
                            <button className="nav-link" onClick={() => {if (onNewTabClicked) onNewTabClicked()}}>+</button>
                            </li> }

        </ul>
        <div className="tab-content">
            {React.Children.map(children, (child, index: number) =>  {
                const {id} = (child as TabElement).props;
                return <div key={id} className={classNames("tab-pane", {"show active": activeKey === id})} role="tabpanel">{child}</div>
            }
            )}
        </div>
    </>
  );
};

export default Tabs;