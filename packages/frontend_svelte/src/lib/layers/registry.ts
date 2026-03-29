import type { Layer, GLContext, FigureFrame } from './types';

export class LayerRegistry {
  private layers: Layer[] = [];
  private context: GLContext | null = null;

  public attachContext(context: GLContext) {
    this.context = context;
    // Mount already-registered layers if any were added before context existed
    for (const layer of this.layers) {
      layer.mount(context);
    }
  }

  public detachContext() {
    this.context = null;
  }

  public register(layer: Layer) {
    // Avoid duplicates by id
    if (this.layers.find(l => l.id === layer.id)) return;
    this.layers.push(layer);
    if (this.context) layer.mount(this.context);
    return () => this.unregister(layer.id);
  }

  public unregister(id: string) {
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx === -1) return;
    const [layer] = this.layers.splice(idx, 1);
    try { layer.destroy(); } catch {}
  }

  public clear() {
    for (const layer of this.layers) {
      try { layer.destroy(); } catch {}
    }
    this.layers = [];
  }

  public draw(frame: FigureFrame) {
    for (const layer of this.layers) {
      layer.draw(frame);
    }
  }
}


