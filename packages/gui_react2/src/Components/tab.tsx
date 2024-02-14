import { ReactElement } from "react";

export interface TabProps {
    title: string,
    id?: string | number,
    children?: JSX.Element[] | JSX.Element | string
}

export interface TabElement extends ReactElement {
    props: TabProps
}

const Tab: React.FC<TabProps> = ({ children }) => {
    return (
        <>
        {children}
        </>
    );
};

export default Tab;