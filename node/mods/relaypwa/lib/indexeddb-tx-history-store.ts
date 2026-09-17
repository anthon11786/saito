import type { TransactionHistoryStore, TransactionRecord } from './transaction-history';
import { openRelayDb, TRANSACTIONS_STORE } from './indexeddb';

const RECORDS_KEY = 'all';

/**
 * Thin adapter over the shared IndexedDB connection (indexeddb.ts), same
 * shape as IndexedDbGroupStore: the logic worth testing (upsertTransaction,
 * markConfirmed) lives in transaction-history.ts and is unit-tested there
 * against a plain in-memory TransactionHistoryStore. This class just has to
 * satisfy that interface. All records are stored as a single array under one
 * fixed key, matching how transaction-history.ts's getAll/setAll already
 * treat the whole list as one unit.
 */
export class IndexedDbTransactionHistoryStore implements TransactionHistoryStore {
  async getAll(): Promise<TransactionRecord[]> {
    const db = await openRelayDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TRANSACTIONS_STORE, 'readonly');
      const request = tx.objectStore(TRANSACTIONS_STORE).get(RECORDS_KEY);
      request.onsuccess = () => resolve((request.result as TransactionRecord[] | undefined) ?? []);
      request.onerror = () => reject(request.error);
    });
  }

  async setAll(records: TransactionRecord[]): Promise<void> {
    const db = await openRelayDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TRANSACTIONS_STORE, 'readwrite');
      tx.objectStore(TRANSACTIONS_STORE).put(records, RECORDS_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
