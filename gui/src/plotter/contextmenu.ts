import { IMouseEvent } from "./object";
import { Point, Rect } from "./types";
import { generateRandomPassword } from "./utils";

export class ContextMenu {

    public menu: HTMLDivElement;
    private otherMenus: ContextMenu[] = [];
    private constructed: boolean = false;
    public gridClass: string = "col-3";

    public parentMenu?: ContextMenu;
    private updateUIFuncs: (() => void)[] = [];
    private showingMenu = false;

    constructor() {
        this.menu = this.createMenu();
    }

    private createMenu(): HTMLDivElement {
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

            if (hide && !this.showingMenu) this.hide();
        });

        // this.menu = menu;
        return menu;
    }

    protected addMenu(text: string, menu: ContextMenu): HTMLButtonElement {
        
        var action = document.createElement('button');
        action.innerText = text + "\t▸";
        action.classList.add("dropdown-item", "small", "pt-0", "pb-0");

        // menu._order = this._order + 1;
        const divMenu = menu.menu;

        document.addEventListener("mousemove", e => {

            var actionRect: Rect = {
                x: this.menu.offsetLeft,
                y: this.menu.offsetTop + action.offsetTop + 0.5,
                w: action.offsetWidth,
                h: action.offsetHeight - 1
            }

            let show = false;

            if (e.pageX >= actionRect.x && e.pageX <= actionRect.x + actionRect.w 
                && e.pageY >= actionRect.y && e.pageY <= actionRect.y + actionRect.h) {
                    show = true;
                }

            if (e.pageX >= divMenu.offsetLeft && e.pageX <= divMenu.offsetLeft + divMenu.offsetWidth
                && e.pageY >= divMenu.offsetTop && e.pageY <= divMenu.offsetTop + divMenu.offsetHeight) {
                    show = true;
                }
            
            if (show) {
                if (!menu.isVisible()) {
                    setTimeout(() => menu.show({x: actionRect.x + actionRect.w, y: actionRect.y}), 400);
                } 
            } else {
                setTimeout(() => menu.hide(), 400);
            }

        });

        this.otherMenus.push(menu);
        menu.otherMenus.push(this);
        menu.parentMenu = this;
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

        var divrow = document.createElement('div');
        divrow.classList.add("row");
        divrow.style.marginLeft = "10px";

        var divcol1 = document.createElement('div');
        divcol1.classList.add("col");
        // div.style.marginLeft = "15px";

        var select = document.createElement("select");
        select.classList.add("col-form-input", "small");

        for (const option of options) {
            let optElement = document.createElement("option");
            optElement.text = option;
            select.appendChild(optElement);
        }

        divcol1.appendChild(select);

        var divcol2 = document.createElement('div');
        divcol2.classList.add(this.gridClass);

        var label = document.createElement("label");
        label.classList.add("col-form-label", "col-form-label-sm", "text-nowrap");
        label.textContent = text;

        divcol2.appendChild(label);
        divrow.appendChild(divcol2);
        divrow.appendChild(divcol1);
        this.menu.appendChild(divrow);
        return select;
    }

    protected addNumberInput(text: string, value: number, min?: number, max?: number, step?: number): HTMLInputElement {
        var divrow = document.createElement('div');
        divrow.classList.add("row");
        divrow.style.marginLeft = "10px";

        var divcol1 = document.createElement('div');
        divcol1.classList.add("col");

        var input = document.createElement('input');
        input.type = "number";
        input.classList.add("col-form-input", "small");
        input.value = value.toString();
        input.min = (min === undefined) ? "" : min?.toString();
        input.max = (max === undefined) ? "" : max?.toString();
        input.step = (step === undefined) ? "" : step?.toString();
        input.id = generateRandomPassword(10);

        divcol1.appendChild(input);

        var divcol2 = document.createElement('div');
        divcol2.classList.add(this.gridClass);

        var label = document.createElement("label");
        label.classList.add("col-form-label", "col-form-label-sm");
        label.textContent = text;
        label.htmlFor = input.id;

        divcol2.appendChild(label);
        divrow.appendChild(divcol2);
        divrow.appendChild(divcol1);
        this.menu.appendChild(divrow);
        return input;
    }

    protected addTextInput(text: string, value: string): HTMLInputElement {
        var divrow = document.createElement('div');
        divrow.classList.add("row");
        divrow.style.marginLeft = "10px";

        var divcol1 = document.createElement('div');
        divcol1.classList.add("col");

        var input = document.createElement('input');
        input.type = "text";
        input.classList.add("col-form-input", "small");
        input.value = value;

        divcol1.appendChild(input);

        var divcol2 = document.createElement('div');
        divcol2.classList.add(this.gridClass);

        var label = document.createElement("label");
        label.classList.add("col-form-label", "col-form-label-sm");
        label.textContent = text;

        divcol2.appendChild(label);
        divrow.appendChild(divcol2);
        divrow.appendChild(divcol1);
        this.menu.appendChild(divrow);
        return input;
    }

    protected addDivider() {
        var div = document.createElement('div');
        div.classList.add("dropdown-divider");
        this.menu.appendChild(div);
    }

    protected constructMenu() {
        throw Error('Not implemented');
    }

    public addUpdateUICallback(callback: () => void) {
        this.updateUIFuncs.push(callback);  // will run before showing the context menu
    }

    public isVisible() {
        return this.menu.classList.contains("show");
    }

    public show(location: Point) {
        if (!this.constructed) {
            this.constructMenu();
            this.constructed = true;
        }

        for (const f of this.updateUIFuncs) {
            f();
        }

        this.showingMenu = true;
        setTimeout(() => {
            this.showingMenu = false;
        }, 100);

        this.menu.classList.add("show");
        const mousex = location.x;
        const mousey = location.y;

        // https://stackoverflow.com/questions/15615552/get-div-height-with-plain-javascript
        let x = mousex;
        let y = mousey;
        if (mousex + this.menu.offsetWidth > document.body.offsetWidth) {
            var diffx = (this.parentMenu) ? this.parentMenu.menu.offsetWidth : 0;
            x -= diffx + this.menu.offsetWidth;
        }
        if (mousey + this.menu.offsetHeight > document.body.offsetHeight) {
            // var diffy = (this.parentMenu) ? this.parentMenu.menu.offsetHeight : 0;

            y -= mousey + this.menu.offsetHeight - document.body.offsetHeight;
        }

        this.menu.style.cssText = `position: "block"; left: ${x}px; top: ${y}px`;
    }

    public hide() {
        this.menu.classList.remove("show");
    }
}
