export type Listener<Payload> = (payload: Payload) => void;

export default class TypedEventEmitter<EventMap extends Record<string, any>> {
    private listeners: Map<keyof EventMap, Set<Listener<any>>> = new Map();

    on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this {
        const existing = this.listeners.get(event) ?? new Set();
        existing.add(listener);
        this.listeners.set(event, existing);
        return this;
    }

    once<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this {
        const wrapped: Listener<EventMap[K]> = (payload) => {
            this.off(event, wrapped);
            listener(payload);
        };
        return this.on(event, wrapped);
    }

    off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this {
        const existing = this.listeners.get(event);
        if (existing) {
            existing.delete(listener as Listener<any>);
            if (existing.size === 0) {
                this.listeners.delete(event);
            }
        }
        return this;
    }

    emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
        const existing = this.listeners.get(event);
        if (!existing) {
            return;
        }
        for (const listener of existing) {
            listener(payload);
        }
    }
}
