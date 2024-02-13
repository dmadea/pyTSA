import classNames from "classnames";
import { useState } from "react";
import Tab, { TabElement } from "./tab";
import TabButton from "./tabbutton";

interface TabsProps{
    id?: string,
    onSelect?: (index: number) => void,
    onClose?: (index: number) => void,
    selected?: number,
    newTabButton?: boolean,
    onNewTabClicked?: () => void,
    children: TabElement[],
}

 function Tabs ({ id, onSelect, onClose, selected, newTabButton, onNewTabClicked, children }: TabsProps) {
  const [_activeTab, _setActiveTab] = useState(0);

  const activeTab = (selected === undefined) ? _activeTab : selected;
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
            {children.map((tab: TabElement, index: number) => {
                return (<li key={index} className="nav-item" role="presentation">
                            <TabButton onClick={() => _onSelect(index)} onClose={() => {onClose ? onClose(index) : null}} title={tab.props.title} active={activeTab === index}/>
                        </li>)
            })}
            {newTabButton && <li className="nav-item" role="presentation">
                            <button className="nav-link" onClick={() => onNewTabClicked ? onNewTabClicked() : null}>+</button>
                            </li> }

        </ul>
        <div className="tab-content">
            {children.map((tab: TabElement, index: number) => {
                return <div key={index} className={classNames("tab-pane", {"show active": activeTab === index })} role="tabpanel">{tab}</div>
            })}
        </div>
    </>
  );
};

export default Tabs;