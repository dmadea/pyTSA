import { PropsWithChildren, ReactElement } from "react";

export interface TabProps {
    title: string,
    id: string | number,
}

export interface TabElement extends ReactElement {
    props: PropsWithChildren<TabProps>
}


const Tab: React.FC<PropsWithChildren<TabProps>> = ({ children }) => {
    return (
        <>
        {children}
        </>
    );
};

export default Tab;