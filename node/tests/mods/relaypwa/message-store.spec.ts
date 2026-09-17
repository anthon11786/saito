import {
  mergeGroupSnapshot,
  saveGroupSnapshot,
  getGroupMessages,
  resolveContactKey,
  type StoredMessage,
  type GroupRecordStore
} from '../../../mods/relaypwa/lib/message-store';

const m1: StoredMessage = { signature: 'sig1', timestamp: 100, from: ['a'], msg: 'hi', mentioned: [] };
const m2: StoredMessage = { signature: 'sig2', timestamp: 200, from: ['b'], msg: 'yo', mentioned: [] };
const m3: StoredMessage = { signature: 'sig3', timestamp: 150, from: ['a'], msg: 'between', mentioned: [] };

describe('mergeGroupSnapshot', () => {
  it('sorts a first snapshot by timestamp', () => {
    expect(mergeGroupSnapshot([], [m1, m2])).toEqual([m1, m2]);
  });

  it('does not drop older history missing from a smaller later snapshot', () => {
    // chat's in-memory snapshot is capped/partial -- it may not include
    // history a user hasn't scrolled back to. Saving a smaller snapshot
    // must not delete what's already stored.
    expect(mergeGroupSnapshot([m1, m2], [m2])).toEqual([m1, m2]);
  });

  it('merges an out-of-order message into the correct chronological position', () => {
    expect(mergeGroupSnapshot([m1, m2], [m3])).toEqual([m1, m3, m2]);
  });

  it('is idempotent when the same snapshot is saved twice', () => {
    expect(mergeGroupSnapshot([m1, m2], [m1, m2])).toEqual([m1, m2]);
  });
});

describe('saveGroupSnapshot / getGroupMessages', () => {
  function makeFakeStore(): GroupRecordStore {
    const backing = new Map<string, StoredMessage[]>();
    return {
      get: async (id: string) => backing.get(id),
      set: async (id: string, msgs: StoredMessage[]) => {
        backing.set(id, msgs);
      }
    };
  }

  it('round-trips through a store, merging on repeated saves', async () => {
    const store = makeFakeStore();

    await saveGroupSnapshot(store, 'contact-b', [m1]);
    expect(await getGroupMessages(store, 'contact-b')).toEqual([m1]);

    await saveGroupSnapshot(store, 'contact-b', [m2]);
    expect(await getGroupMessages(store, 'contact-b')).toEqual([m1, m2]);
  });

  it('returns an empty array for a key that was never saved', async () => {
    const store = makeFakeStore();
    expect(await getGroupMessages(store, 'nonexistent-contact')).toEqual([]);
  });
});

describe('resolveContactKey', () => {
  it('returns the other member of a genuine 1:1 conversation', () => {
    const group = { id: 'group1', members: ['me', 'alice'], txs: [] };
    expect(resolveContactKey(group, 'me')).toBe('alice');
  });

  it('works regardless of member order', () => {
    const group = { id: 'group1', members: ['alice', 'me'], txs: [] };
    expect(resolveContactKey(group, 'me')).toBe('alice');
  });

  it('returns null for a group chat (more than two members)', () => {
    const group = { id: 'group1', members: ['me', 'alice', 'bob'], txs: [] };
    expect(resolveContactKey(group, 'me')).toBeNull();
  });

  it('returns null for a group of one (e.g. a self-only or malformed group)', () => {
    const group = { id: 'group1', members: ['me'], txs: [] };
    expect(resolveContactKey(group, 'me')).toBeNull();
  });
});
