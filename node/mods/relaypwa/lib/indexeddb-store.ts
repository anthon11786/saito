import type { GroupRecordStore, StoredMessage } from './message-store';
import { openRelayDb, GROUPS_STORE } from './indexeddb';

/**
 * Thin adapter over the shared IndexedDB connection (indexeddb.ts), kept
 * deliberately small: the logic worth testing (mergeGroupSnapshot) lives
 * in message-store.ts and is unit-tested there. This class only has to
 * satisfy GroupRecordStore, and can't be exercised outside a real browser,
 * so it stays a straightforward transcription of the standard IndexedDB
 * transaction dance.
 */
export class IndexedDbGroupStore implements GroupRecordStore {
  async get(groupId: string): Promise<StoredMessage[] | undefined> {
    const db = await openRelayDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(GROUPS_STORE, 'readonly');
      const request = tx.objectStore(GROUPS_STORE).get(groupId);
      request.onsuccess = () => resolve(request.result as StoredMessage[] | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async set(groupId: string, messages: StoredMessage[]): Promise<void> {
    const db = await openRelayDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(GROUPS_STORE, 'readwrite');
      tx.objectStore(GROUPS_STORE).put(messages, groupId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
