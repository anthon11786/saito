"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TypedEventEmitter {
    constructor() {
        this.listeners = new Map();
    }
    on(event, listener) {
        const existing = this.listeners.get(event) ?? new Set();
        existing.add(listener);
        this.listeners.set(event, existing);
        return this;
    }
    once(event, listener) {
        const wrapped = (payload) => {
            this.off(event, wrapped);
            listener(payload);
        };
        return this.on(event, wrapped);
    }
    off(event, listener) {
        const existing = this.listeners.get(event);
        if (existing) {
            existing.delete(listener);
            if (existing.size === 0) {
                this.listeners.delete(event);
            }
        }
        return this;
    }
    emit(event, payload) {
        const existing = this.listeners.get(event);
        if (!existing) {
            return;
        }
        for (const listener of existing) {
            listener(payload);
        }
    }
}
exports.default = TypedEventEmitter;
