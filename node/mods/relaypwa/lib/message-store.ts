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

/**
 * Storage is keyed by the OTHER member's public key, not chat.js's own
 * group.id. Relay's UI is contact-centric (a conversation is "with
 * Alice"), and a contact only ever knows the other person's public key --
 * never chat.js's internal group id, which is assigned however chat.js
 * assigns it and isn't otherwise exposed. Only defined for genuine 1:1
 * conversations (exactly two members): Relay's MVP scope explicitly
 * excludes group chat, and there's no single "other member" to key by
 * once a group has more than one.
 */
export function resolveContactKey(group: RelayChatGroup, ownPublicKey: string): string | null {
  if (group.members.length !== 2) {
    return null;
  }
  const other = group.members.find((publicKey) => publicKey !== ownPublicKey);
  return other ?? null;
}

export async function saveGroupSnapshot(store: GroupRecordStore, key: string, txs: StoredMessage[]): Promise<void> {
  const existing = (await store.get(key)) ?? [];
  const merged = mergeGroupSnapshot(existing, txs);
  await store.set(key, merged);
}

export async function getGroupMessages(store: GroupRecordStore, key: string): Promise<StoredMessage[]> {
  return (await store.get(key)) ?? [];
}
