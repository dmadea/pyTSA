import { Colormap, ILut } from "../color";
import { Figure } from "./figure";


export class Colorbar extends Figure {

    public colormap: ILut;

    constructor(figure: Figure, colormap?: ILut) {
        super(figure);
        this.colormap = colormap ?? Colormap.symgrad;
    }



}