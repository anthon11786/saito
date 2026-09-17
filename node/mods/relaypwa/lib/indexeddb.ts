/**
 * Single shared IndexedDB connection for all of Relay's local persistence.
 * Every object store must be created in the same onupgradeneeded handler:
 * IndexedDB only fires that event when opening at a version number higher
 * than what's already on disk, so two adapters each opening 'relaypwa' at
 * version 1 independently would race, and whichever store the first one
 * created would win -- the second store would never get created, and any
 * transaction against it would throw "object store not found". Adding a
 * second store here later means bumping DB_VERSION, not adding a second
 * open() call somewhere else.
 */
const DB_NAME = 'relaypwa';
const DB_VERSION = 2;

export const GROUPS_STORE = 'groups';
export const TRANSACTIONS_STORE = 'transactions';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openRelayDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(GROUPS_STORE)) {
          db.createObjectStore(GROUPS_STORE);
        }
        if (!db.objectStoreNames.contains(TRANSACTIONS_STORE)) {
          db.createObjectStore(TRANSACTIONS_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}
