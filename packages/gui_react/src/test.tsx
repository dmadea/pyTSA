import { CanvasView } from './canvasview';
import { GlobalState } from './globalstate';
import { Component, ReactNode } from "react";


interface CanvasProps {
    canvasview: CanvasView
}


const state = GlobalState.getInstance();

class Canvas extends Component {

    constructor(props: CanvasProps) {
        super(props);
    }

    componentDidMount(): void {
        console.log("componentDidMount");
    }

    componentDidUpdate(prevProps: Readonly<{}>, prevState: Readonly<{}>, snapshot?: any): void {
        console.log("componentDidUpdate");
    }

    componentWillUnmount(): void {
        console.log("component will unmount");
    }

    render(): ReactNode {

        return "";
    }


}

// function Canvas() {
//     useSignals();

//   return (
//     <>
//      <button className='btn btn-primary btn-sm' onClick={() => count.value++}>
//             count asldiajosd is {count.value}
//     </button>
//     <span className='btn btn-danger'> {state.tabs.value.length }</span>
//     </>
//   ) 
// }

export default Canvas
