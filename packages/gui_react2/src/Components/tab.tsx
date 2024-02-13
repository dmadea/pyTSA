import { ReactElement } from "react";

export interface TabProps {
    title: string,
    id?: string | number,
    children?: JSX.Element[] | JSX.Element | string
}

export interface TabElement extends ReactElement {
    props: TabProps
}

function Tab ({ children }: TabProps): TabElement {
    return (
        <>
        {children}
        </>
    );
};

export default Tab;