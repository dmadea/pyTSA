import { IMouseEvent } from "./object";
import { Point, Rect } from "./types";
import { generateRandomPassword } from "./utils";

export class ContextMenu {

    public menu: HTMLDivElement;
    private otherMenus: ContextMenu[] = [];

    constructor() {
        this.menu = this.createMenu();
    }

    protected createMenu(): HTMLDivElement {
        var menu = document.createElement('div');
        menu.classList.add("dropdown-menu");
        // menu.classList.add("dropdown-menu-sm");
        // menu.classList.add("mt-0", "mb-0", "ml-0");

        // prevent showing a default context menu on right click
        menu.addEventListener("contextmenu", e => {
            e.preventDefault();
        })

        document.body.appendChild(menu);
        document.body.addEventListener("click", e => {
            let hide = true;
            for (const menu of [this.menu, ...this.otherMenus.map(m => m.menu)]) {
                if (e.pageX >= menu.offsetLeft && e.pageX <= menu.offsetLeft + menu.offsetWidth
                    && e.pageY >= menu.offsetTop && e.pageY <= menu.offsetTop + menu.offsetHeight) {
                        hide = false;
                    }
            }

            if (hide) this.hide();
        });

        this.menu = menu;
        return menu;
    }

    protected addMenu(text: string, menu: ContextMenu): HTMLButtonElement {
        
        var action = document.createElement('button');
        action.innerText = text + "\t▸";
        action.classList.add("dropdown-item", "small", "pt-0", "pb-0");

        const divMenu = menu.menu;

        document.addEventListener("mousemove", e => {

            var actionRect: Rect = {
                x: this.menu.offsetLeft,
                y: this.menu.offsetTop + action.offsetTop,
                w: action.offsetWidth,
                h: action.offsetHeight
            }

            // console.log(actionRect, e.pageX, e.pageY);


            let show = false;

            if (e.pageX >= actionRect.x && e.pageX <= actionRect.x + actionRect.w 
                && e.pageY >= actionRect.y && e.pageY <= actionRect.y + actionRect.h) {
                    show = true;
                    // console.log('on action');
                }

            if (e.pageX >= divMenu.offsetLeft && e.pageX <= divMenu.offsetLeft + divMenu.offsetWidth
                && e.pageY >= divMenu.offsetTop && e.pageY <= divMenu.offsetTop + divMenu.offsetHeight) {
                    show = true;
                    // console.log('on menu');
                }
            
            if (show) {
                menu.show({x: actionRect.x + actionRect.w, y: actionRect.y});
            } else {
                menu.hide();
            }

        });

        this.otherMenus.push(menu);
        menu.otherMenus.push(this);
        this.menu.appendChild(action);
        return action;
    }

    protected addAction(text: string): HTMLButtonElement {
        var action = document.createElement('button');
        action.innerText = text;
        action.classList.add("dropdown-item", "small", "pt-0", "pb-0");
        action.addEventListener("click", e =>  {
            this.hide();
        });

        this.menu.appendChild(action);
        return action;
    }

    protected addCheckBox(text: string): HTMLInputElement {
        var div = document.createElement('div');
        div.classList.add("form-check");
        div.style.marginLeft = "15px";

        var checkbox = document.createElement('input');
        checkbox.type = "checkbox";
        checkbox.classList.add("form-check-input");
        checkbox.value = "";
        checkbox.id = generateRandomPassword(10);

        div.appendChild(checkbox);

        var label = document.createElement("label");
        label.classList.add("form-check-label", "small");
        label.textContent = text;
        label.htmlFor = checkbox.id;

        div.appendChild(label);
        this.menu.appendChild(div);

        return checkbox;
    }

    protected addSelect(text: string, ...options: string[]): HTMLSelectElement {
        // var div = document.createElement('div');
        // div.classList.add("form-check");
        // div.style.marginLeft = "15px";

        var select = document.createElement("select");
        select.classList.add("form-select", "form-select-sm");

        for (const option of options) {
            let optElement = document.createElement("option");
            optElement.text = option;
            select.appendChild(optElement);
        }
        
        // var label = document.createElement("label");
        // label.classList.add("form-check-label", "small");
        // label.textContent = text;
        
        // div.appendChild(label);
        // div.appendChild(select);

        var header = document.createElement("h6");
        header.classList.add("dropdown-header");
        header.textContent = text;

        this.menu.appendChild(header);
        this.menu.appendChild(select);
        return select;
    }

    protected addNumberInput(text: string, value: number, min?: number, max?: number): HTMLInputElement {

        // <div class="form-outline">
        //     <input type="number" id="typeNumber" class="form-control" />
        //     <label class="form-label" for="typeNumber">Number input</label>
        // </div>

        var div = document.createElement('div');
        div.classList.add("form-outline");
        // div.style.marginLeft = "15px";

        var input = document.createElement('input');
        input.type = "number";
        input.classList.add("form-control", "small");
        input.value = value.toString();
        input.min = (min === undefined) ? "" : min?.toString();
        input.max = (max === undefined) ? "" : max?.toString();
        input.id = generateRandomPassword(10);

        div.appendChild(input);

        var label = document.createElement("label");
        label.classList.add("form-label", "small");
        label.textContent = text;
        label.htmlFor = input.id;

        div.appendChild(label);
        this.menu.appendChild(div);

        return input;

    }

    protected addDivider() {
        var div = document.createElement('div');
        div.classList.add("dropdown-divider");
        this.menu.appendChild(div);
    }

    public show(location: Point) {
        this.menu.classList.add("show");
        const mousex = location.x;
        const mousey = location.y;

        // https://stackoverflow.com/questions/15615552/get-div-height-with-plain-javascript
        let x = mousex;
        let y = mousey;
        if (mousex + this.menu.offsetWidth > document.body.offsetWidth) {
            x -= this.menu.offsetWidth;
        }
        if (mousey + this.menu.offsetHeight > document.body.offsetHeight) {
            y -= this.menu.offsetHeight;
        }

        this.menu.style.cssText = `position: "block"; left: ${x}px; top: ${y}px`;
    }

    public hide() {
        this.menu.classList.remove("show");
    }


}
