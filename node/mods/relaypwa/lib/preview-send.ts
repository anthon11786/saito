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
 * NOT YET IMPLEMENTED: building, signing and broadcasting the actual
 * transaction from a SendPreview's chosen inputs.
 *
 * What's verified so far (standalone, offline, against the real
 * saito-wasm/saito-js packages): Slip.fromUtxoKey(existingUtxokey)
 * correctly reconstructs a spendable input slip byte-for-byte (checked
 * against the Rust core's own get_utxoset_key() byte layout in
 * rust/saito-core/src/core/consensus/slip.rs), and a new output Slip only
 * needs publicKey + amount set.
 *
 * What's NOT verified: Transaction.sign() and anything reading
 * tx.from/tx.to require a fully initialized S.getInstance().factory,
 * which only exists after the real app bootstrap
 * (saito-js/index.node.js's initialize(), called from app.ts's
 * constructor with live network config) -- not something a standalone
 * script in this sandbox can safely replicate. This is money-moving
 * code; shipping a sign/broadcast path I couldn't actually exercise
 * end-to-end felt like the wrong tradeoff versus shipping the tested
 * planning half and leaving this as an explicit gap.
 */
export async function sendFromPreview(_app: any, _preview: SendPreview): Promise<never> {
  throw new Error(
    'Relay: sendFromPreview is not implemented yet -- verify the sign/broadcast path inside a running app first'
  );
}
