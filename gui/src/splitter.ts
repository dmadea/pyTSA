
export class Splitter {

    public leftdif: HTMLDivElement;
    public split: HTMLDivElement;


    constructor(leftdiv: HTMLDivElement, split: HTMLDivElement) {
        this.leftdif = leftdiv;
        this.split = split;

        this.split.addEventListener('mousedown', e => this.resizer(e, this.leftdif));
    }

    private resizer(e: MouseEvent, pane: HTMLDivElement) {
        
        let lastX = e.clientX;
        const rect = pane.getBoundingClientRect();

        let mousemove = (e: MouseEvent) => {

            let distX = lastX - e.clientX;
            pane.style.width = `${rect.width - distX}px`;
        }
        
        let mouseup = (e: MouseEvent) => {
            window.removeEventListener('mousemove', mousemove);
            window.removeEventListener('mouseup', mouseup);
        }

        window.addEventListener('mousemove', mousemove);
        window.addEventListener('mouseup', mouseup);
      }

}