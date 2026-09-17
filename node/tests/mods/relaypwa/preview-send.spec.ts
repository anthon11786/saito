import { previewSend } from '../../../mods/relaypwa/lib/preview-send';
import { InvalidPublicKeyError } from '../../../mods/relaypwa/lib/contacts';
import { InsufficientBalanceError } from '../../../mods/relaypwa/lib/coin-selection';

// sendFromPreview (the sign + broadcast half) needs a fully initialized
// S.getInstance().factory from the real saito-js bootstrap, which only
// exists inside a running app -- it's verified separately against a real
// local node, not here. This covers previewSend(): validation and the
// wallet-slip -> coin-selection wiring, which don't need that factory.

function makeFakeApp(rawSlips: any[]) {
  return {
    crypto: { isPublicKey: (k: string) => k === 'validrecipient' },
    wallet: {
      getSlips: async () => rawSlips.map((s) => ({ toJson: () => s }))
    }
  };
}

describe('previewSend', () => {
  it('rejects an invalid recipient before ever calling the wallet', async () => {
    const app = makeFakeApp([]);
    await expect(previewSend(app, 'garbage', 10n, 0n, 5n)).rejects.toBeInstanceOf(InvalidPublicKeyError);
  });

  it('only considers unspent, longest-chain slips, smallest-first', async () => {
    const rawSlips = [
      { utxokey: 'spent1', amount: '1000', spent: true, lc: true },
      { utxokey: 'offchain1', amount: '1000', spent: false, lc: false },
      { utxokey: 'good1', amount: '20', spent: false, lc: true },
      { utxokey: 'good2', amount: '30', spent: false, lc: true }
    ];
    const app = makeFakeApp(rawSlips);

    const preview = await previewSend(app, 'validrecipient', 15n, 0n, 5n);

    expect(preview.inputs.map((s) => s.utxokey)).toEqual(['good1']);
    expect(preview.changeAmount).toBe(5n);
    expect(preview.recipientPublicKey).toBe('validrecipient');
    expect(preview.amount).toBe(15n);
    expect(preview.fee).toBe(0n);
  });

  it('surfaces insufficient balance from the real wallet-shaped slip data', async () => {
    const app = makeFakeApp([{ utxokey: 'good1', amount: '20', spent: false, lc: true }]);
    await expect(previewSend(app, 'validrecipient', 1000n, 0n, 5n)).rejects.toBeInstanceOf(
      InsufficientBalanceError
    );
  });
});
