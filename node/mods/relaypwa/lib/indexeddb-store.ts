import type { GroupRecordStore, StoredMessage } from './message-store';

const DB_NAME = 'relaypwa';
const DB_VERSION = 1;
const STORE_NAME = 'groups';

/**
 * Thin adapter over the browser's IndexedDB, kept deliberately small: the
 * logic worth testing (mergeGroupSnapshot) lives in message-store.ts and is
 * unit-tested there. This class only has to satisfy GroupRecordStore, and
 * can't be exercised outside a real browser, so it stays a straightforward
 * transcription of the standard IndexedDB open/transaction dance.
 */
export class IndexedDbGroupStore implements GroupRecordStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  }

  async get(groupId: string): Promise<StoredMessage[] | undefined> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(groupId);
      request.onsuccess = () => resolve(request.result as StoredMessage[] | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async set(groupId: string, messages: StoredMessage[]): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(messages, groupId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
