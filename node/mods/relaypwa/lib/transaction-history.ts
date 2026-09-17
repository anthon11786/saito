export interface TransactionRecord {
  signature: string;
  timestamp: number;
  direction: 'sent' | 'received';
  counterparty: string;
  amount: bigint;
  confirmed: boolean;
}

/**
 * Minimal persistence Relay's IndexedDB adapter needs to implement --
 * narrow like GroupRecordStore in message-store.ts, so the merge/update
 * logic below can be unit-tested against a plain in-memory implementation.
 */
export interface TransactionHistoryStore {
  getAll(): Promise<TransactionRecord[]>;
  setAll(records: TransactionRecord[]): Promise<void>;
}

/**
 * Upserts by signature and keeps newest-first. Used both when we send (a
 * record starts here as unconfirmed, from the amount we already know from
 * the SendPreview -- no need to wait for or parse anything back off the
 * chain) and when we receive (a record starts here already confirmed,
 * since receipt is only ever detected via onConfirmation in the first
 * place -- there's no "pending received" state to represent).
 */
export async function upsertTransaction(
  store: TransactionHistoryStore,
  record: TransactionRecord
): Promise<void> {
  const all = await store.getAll();
  const bySignature = new Map(all.map((r) => [r.signature, r]));
  bySignature.set(record.signature, record);
  const merged = [...bySignature.values()].sort((a, b) => b.timestamp - a.timestamp);
  await store.setAll(merged);
}

/**
 * Flips a sent record from pending to confirmed once onConfirmation fires
 * for it. A no-op if the signature isn't known (e.g. history was cleared)
 * rather than an error -- there's nothing useful to do about a
 * confirmation for a record we don't have.
 */
export async function markConfirmed(store: TransactionHistoryStore, signature: string): Promise<void> {
  const all = await store.getAll();
  const updated = all.map((r) => (r.signature === signature ? { ...r, confirmed: true } : r));
  await store.setAll(updated);
}

export async function listTransactions(store: TransactionHistoryStore): Promise<TransactionRecord[]> {
  return store.getAll();
}

/**
 * Sums the amount of a set of (already-plain, via Slip.toJson()) output
 * slips addressed to a given key. Used to figure out how much a received
 * payment was actually worth to us specifically -- a transaction's other
 * outputs (e.g. the sender's own change) aren't ours to count.
 */
export function sumSlipsToKey(slips: { publicKey: string; amount: bigint }[], key: string): bigint {
  return slips.filter((s) => s.publicKey === key).reduce((sum, s) => sum + s.amount, BigInt(0));
}
