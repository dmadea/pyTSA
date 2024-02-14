import classNames from "classnames";
import { useState, PropsWithChildren } from "react";
import { TabElement } from "./tab";
import TabButton from "./tabbutton";
import React from "react";

interface TabsProps {
    id?: string,
    onSelect?: (index: number) => void,
    onClose?: (index: number) => void,
    selected?: number,
    newTabButton?: boolean,
    onNewTabClicked?: () => void,
}

 const Tabs: React.FC<PropsWithChildren<TabsProps>> =  ({ id, onSelect, onClose, selected, newTabButton, onNewTabClicked, children }) => {
  const [_activeTab, _setActiveTab] = useState(0);

  const activeTab = selected ?? _activeTab;
  const _onSelect = (index: number) => {
    if (onSelect) {
        onSelect(index);
        return;
    } else {
        _setActiveTab(index);
    }
  }

  return (
    <>
        <ul className="nav nav-tabs" id={id} role="tablist">
            {React.Children.map(children, (child, index: number) => {
                return (<li key={index} className="nav-item" role="presentation">
                            <TabButton onClick={() => _onSelect(index)} onClose={() => {onClose ? onClose(index) : null}} 
                            title={(child as TabElement).props.title} active={activeTab === index}/>
                        </li>)
            })}
            {newTabButton && <li className="nav-item" role="presentation">
                            <button className="nav-link" onClick={() => {if (onNewTabClicked) onNewTabClicked()}}>+</button>
                            </li> }

        </ul>
        <div className="tab-content">
            {React.Children.map(children, (child, index: number) =>  
            <div key={index} className={classNames("tab-pane", {"show active": activeTab === index })} role="tabpanel">{child}</div>
            )}
        </div>
    </>
  );
};

export default Tabs;