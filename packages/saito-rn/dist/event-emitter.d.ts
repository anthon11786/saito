export type Listener<Payload> = (payload: Payload) => void;
export default class TypedEventEmitter<EventMap extends Record<string, any>> {
    private listeners;
    on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this;
    once<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this;
    off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this;
    emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void;
}
