import { selectCoinsForSend, InsufficientBalanceError, type SpendableSlip } from '../../../mods/relaypwa/lib/coin-selection';

const slip = (utxokey: string, amount: number): SpendableSlip => ({ utxokey, amount: BigInt(amount) });

describe('selectCoinsForSend', () => {
  it('prefers merging fragments (smallest-first) over minimising input count', () => {
    const slips = [slip('big', 1000), slip('tiny1', 5), slip('tiny2', 7), slip('mid', 50)];
    // A largest-first/exact-match selector would grab just "big" (1 input).
    const result = selectCoinsForSend(slips, 10n, 0n, 1n);
    expect(result.inputs.map((s) => s.utxokey).sort()).toEqual(['tiny1', 'tiny2']);
    expect(result.changeAmount).toBe(2n);
  });

  it('produces no dust warning on an exact match', () => {
    const result = selectCoinsForSend([slip('a', 10)], 10n, 0n, 5n);
    expect(result.changeAmount).toBe(0n);
    expect(result.dustWarning).toBe(false);
  });

  it('pulls in another slip rather than minting change below the dust threshold', () => {
    const slips = [slip('only', 12), slip('spare', 90)];
    const result = selectCoinsForSend(slips, 10n, 0n, 5n);
    expect(result.inputs).toHaveLength(2);
    expect(result.changeAmount).toBe(92n);
    expect(result.dustWarning).toBe(false);
  });

  it('flags dust honestly when no further slip is available to absorb it', () => {
    const result = selectCoinsForSend([slip('only', 12)], 10n, 0n, 5n);
    expect(result.dustWarning).toBe(true);
    expect(result.changeAmount).toBe(2n);
  });

  it('throws when funds are insufficient', () => {
    expect(() => selectCoinsForSend([slip('a', 5)], 10n, 0n, 1n)).toThrow(InsufficientBalanceError);
  });

  it('includes the fee in the required total', () => {
    expect(() => selectCoinsForSend([slip('a', 10)], 10n, 1n, 1n)).toThrow(InsufficientBalanceError);
  });
});
