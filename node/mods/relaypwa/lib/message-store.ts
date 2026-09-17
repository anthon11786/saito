export interface StoredMessage {
  signature: string;
  timestamp: number;
  from: string[];
  msg: string;
  mentioned: string[];
}

export interface RelayChatGroup {
  id: string;
  members: string[];
  txs: StoredMessage[];
}

/**
 * On-chain messages age out under ATR unless funded, so the chain cannot be
 * the archive -- IndexedDB is (see the plan's "Local storage is the real
 * archive"). chat.js's in-memory group.txs is what we snapshot from, via
 * its 'chat-popup-render-request' event, each time it changes.
 *
 * That snapshot is only ever the messages chat currently holds in memory
 * (capped in some code paths, and never including older history a user
 * hasn't scrolled back to), so saving it must merge into what is already
 * stored rather than replace it outright -- otherwise restarting the app
 * would silently drop any history chat isn't currently holding in memory.
 * Merging is idempotent and order-independent: the same signature always
 * wins to the same record, so replaying the same snapshot twice, or
 * receiving snapshots out of order, can't duplicate or lose a message.
 */
export function mergeGroupSnapshot(
  existing: StoredMessage[],
  incoming: StoredMessage[]
): StoredMessage[] {
  const bySignature = new Map<string, StoredMessage>();
  for (const m of existing) {
    bySignature.set(m.signature, m);
  }
  for (const m of incoming) {
    bySignature.set(m.signature, m);
  }
  return [...bySignature.values()].sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Minimal key-value persistence Relay's IndexedDB adapter needs to
 * implement. Kept this narrow so the merge logic above -- the part worth
 * getting right -- can be unit-tested against a plain in-memory
 * implementation without a real IndexedDB (unavailable outside a browser).
 */
export interface GroupRecordStore {
  get(groupId: string): Promise<StoredMessage[] | undefined>;
  set(groupId: string, messages: StoredMessage[]): Promise<void>;
}

export async function saveGroupSnapshot(store: GroupRecordStore, group: RelayChatGroup): Promise<void> {
  const existing = (await store.get(group.id)) ?? [];
  const merged = mergeGroupSnapshot(existing, group.txs);
  await store.set(group.id, merged);
}

export async function getGroupMessages(store: GroupRecordStore, groupId: string): Promise<StoredMessage[]> {
  return (await store.get(groupId)) ?? [];
}
