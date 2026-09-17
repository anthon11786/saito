import {
  upsertTransaction,
  markConfirmed,
  listTransactions,
  sumSlipsToKey,
  type TransactionRecord,
  type TransactionHistoryStore
} from '../../../mods/relaypwa/lib/transaction-history';

function makeFakeStore(initial: TransactionRecord[] = []): TransactionHistoryStore {
  let backing = initial;
  return {
    getAll: async () => backing,
    setAll: async (records: TransactionRecord[]) => {
      backing = records;
    }
  };
}

const sent: TransactionRecord = {
  signature: 'sig1',
  timestamp: 100,
  direction: 'sent',
  counterparty: 'bob',
  amount: 500n,
  confirmed: false
};

const received: TransactionRecord = {
  signature: 'sig2',
  timestamp: 200,
  direction: 'received',
  counterparty: 'alice',
  amount: 900n,
  confirmed: true
};

describe('upsertTransaction', () => {
  it('adds a new record', async () => {
    const store = makeFakeStore();
    await upsertTransaction(store, sent);
    expect(await listTransactions(store)).toEqual([sent]);
  });

  it('sorts newest-first', async () => {
    const store = makeFakeStore();
    await upsertTransaction(store, sent);
    await upsertTransaction(store, received);
    expect(await listTransactions(store)).toEqual([received, sent]);
  });

  it('replaces an existing record with the same signature rather than duplicating it', async () => {
    const store = makeFakeStore([sent]);
    const updated: TransactionRecord = { ...sent, confirmed: true };
    await upsertTransaction(store, updated);
    const all = await listTransactions(store);
    expect(all).toHaveLength(1);
    expect(all[0].confirmed).toBe(true);
  });
});

describe('markConfirmed', () => {
  it('flips a matching pending record to confirmed', async () => {
    const store = makeFakeStore([sent]);
    await markConfirmed(store, sent.signature);
    const all = await listTransactions(store);
    expect(all[0].confirmed).toBe(true);
  });

  it('leaves other records untouched', async () => {
    const store = makeFakeStore([sent, received]);
    await markConfirmed(store, sent.signature);
    const all = await listTransactions(store);
    expect(all.find((r) => r.signature === received.signature)).toEqual(received);
  });

  it('is a no-op when the signature is not known', async () => {
    const store = makeFakeStore([sent]);
    await markConfirmed(store, 'unknown-signature');
    expect(await listTransactions(store)).toEqual([sent]);
  });
});

describe('sumSlipsToKey', () => {
  it('sums only the slips addressed to the given key', () => {
    const slips = [
      { publicKey: 'me', amount: 100n },
      { publicKey: 'someone-else', amount: 900n },
      { publicKey: 'me', amount: 50n }
    ];
    expect(sumSlipsToKey(slips, 'me')).toBe(150n);
  });

  it('returns zero when no slips match', () => {
    expect(sumSlipsToKey([{ publicKey: 'someone-else', amount: 900n }], 'me')).toBe(0n);
  });

  it('returns zero for an empty slip list', () => {
    expect(sumSlipsToKey([], 'me')).toBe(0n);
  });
});
