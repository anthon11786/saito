import Slip from 'saito-js/lib/slip';
import Transaction from 'saito-js/lib/transaction';
import { selectCoinsForSend, type SpendableSlip, type CoinSelectionResult } from './coin-selection';
import { InvalidPublicKeyError } from './contacts';

export interface SendPreview extends CoinSelectionResult {
  recipientPublicKey: string;
  amount: bigint;
  fee: bigint;
}

/**
 * Plans a send without touching the network or signing anything, so a UI
 * can show the user what will actually happen -- including a dust warning
 * -- before they commit. Deliberately does not decide whether a dust
 * warning should block the send: that's a product call the plan doesn't
 * settle (would the user rather eat the dust or pick a different amount?),
 * so it belongs in whatever confirms with the user, not in this plumbing.
 *
 * app.wallet.getSlips() (-> WalletSlip.toJson()) is the real source of
 * spendable UTXOs; filtered to unspent (!spent) and on the longest chain
 * (lc) before coin selection ever sees them.
 */
export async function previewSend(
  app: any,
  recipientPublicKey: string,
  amount: bigint,
  fee: bigint,
  dustThreshold: bigint
): Promise<SendPreview> {
  if (!app.crypto.isPublicKey(recipientPublicKey)) {
    throw new InvalidPublicKeyError(recipientPublicKey);
  }

  const walletSlips = await app.wallet.getSlips();
  const spendable: SpendableSlip[] = walletSlips
    .map((s: any) => s.toJson())
    .filter((s: any) => !s.spent && s.lc)
    .map((s: any) => ({ utxokey: s.utxokey, amount: BigInt(s.amount) }));

  const selection = selectCoinsForSend(spendable, amount, fee, dustThreshold);

  return {
    ...selection,
    recipientPublicKey,
    amount,
    fee
  };
}

/**
 * Builds, signs and broadcasts the transaction planned by previewSend().
 *
 * Verified inside a real, fully-initialized app (not a standalone script --
 * Transaction.sign() needs S.getInstance().factory, which only exists after
 * the real saito-js bootstrap that app.ts's constructor performs): booted a
 * genuine local node via the same sequence scripts/cli.ts uses, and
 * constructed + signed a real transaction from a Slip.fromUtxoKey() input
 * end to end. That run surfaced a real use-after-free gotcha this function
 * is written to avoid: addFromSlip(slip) frees the underlying wasm slip
 * object, so reading any of its fields afterward throws "null pointer
 * passed to rust". Every value this function needs from an input slip
 * (its amount, via SpendableSlip -- already plain data from
 * coin-selection.ts, never re-read off a Slip instance) is captured before
 * that slip is ever handed to addFromSlip.
 *
 * Does not itself decide what to do about preview.dustWarning -- by the
 * time a preview reaches here the caller has already decided to proceed
 * (see previewSend()'s docs on why that's a UI decision, not this
 * plumbing's).
 */
export async function sendFromPreview(app: any, preview: SendPreview): Promise<Transaction> {
  const tx = new Transaction();

  for (const input of preview.inputs) {
    const fromSlip = Slip.fromUtxoKey(input.utxokey);
    if (!fromSlip) {
      throw new Error(`Relay: could not reconstruct slip from utxokey ${input.utxokey}`);
    }
    tx.addFromSlip(fromSlip);
  }

  const toSlip = new Slip();
  toSlip.publicKey = preview.recipientPublicKey;
  toSlip.amount = preview.amount;
  tx.addToSlip(toSlip);

  if (preview.changeAmount > BigInt(0)) {
    const changeSlip = new Slip();
    changeSlip.publicKey = await app.wallet.getPublicKey();
    changeSlip.amount = preview.changeAmount;
    tx.addToSlip(changeSlip);
  }

  tx.timestamp = Date.now();
  await tx.sign();

  await app.network.sendTransactionWithCallback(tx);

  return tx;
}
