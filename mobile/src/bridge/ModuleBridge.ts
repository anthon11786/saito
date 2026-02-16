export interface ModuleBridgeAdapter {
  moduleName: string;
  handleEvent(event: string, data: any): void;
  getMethods(): string[];
}

export class ModuleBridgeRegistry {
  private adapters = new Map<string, ModuleBridgeAdapter>();

  register(adapter: ModuleBridgeAdapter): void {
    this.adapters.set(adapter.moduleName, adapter);
  }

  unregister(moduleName: string): void {
    this.adapters.delete(moduleName);
  }

  getAdapter(moduleName: string): ModuleBridgeAdapter | undefined {
    return this.adapters.get(moduleName);
  }

  dispatchEvent(module: string, event: string, data: any): void {
    const adapter = this.adapters.get(module);
    if (adapter) {
      adapter.handleEvent(event, data);
    }
  }
}
