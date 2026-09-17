export interface SpendableSlip {
  utxokey: string;
  amount: bigint;
}

export interface CoinSelectionResult {
  inputs: SpendableSlip[];
  changeAmount: bigint;
  /**
   * True when the leftover change would fall below the dust threshold and
   * no further slip was available to absorb it. The plan is explicit that
   * this must be surfaced, not silently let evaporate at the next epoch
   * boundary -- so a caller must decide what to do (e.g. warn the user,
   * or add the whole change to the fee instead of minting a doomed slip)
   * rather than this function guessing on their behalf.
   */
  dustWarning: boolean;
}

export class InsufficientBalanceError extends Error {
  constructor(available: bigint, required: bigint) {
    super(`Relay: insufficient balance (have ${available}, need ${required})`);
    this.name = 'InsufficientBalanceError';
  }
}

/**
 * Ground truth for why this exists at all: read the Rust wallet's actual
 * default selection (saito-core/src/core/consensus/wallet.rs,
 * generate_slips()). It just walks unspent slips in whatever order the
 * underlying set yields (sorted only under #[cfg(test)]) and stops the
 * moment the requested amount is covered -- i.e. it minimises input count,
 * the opposite of what the plan calls for, and applies no dust check to
 * the change output at all. The wasm binding's `force_merge` parameter
 * that looked like it might switch this behaviour is dead: the Rust side
 * names it `_force_merge` and never reads it (confirmed in
 * rust/saito-wasm/src/wasm_wallet.rs). So "prefer consolidation" and
 * "avoid creating dust" aren't available by passing a flag -- they have
 * to be a selection Relay does itself, spending explicit slips via
 * Transaction.addFromSlip()/addToSlip() rather than
 * wallet.createTransaction()'s built-in selection.
 *
 * Smallest-first (ascending by amount) is the concrete algorithm for
 * "favour merging fragments over minimising inputs": it preferentially
 * clears out small/fragmented UTXOs before touching larger ones, so
 * repeated sends converge the wallet toward fewer, larger UTXOs over
 * time, and it will tend to use *more* inputs than a naive
 * largest-first/exact-match selector would for the same amount -- which
 * is exactly the plan's stated goal, not a side effect.
 *
 * dustThreshold is the ATR rebroadcast fee: the amount a change output
 * must clear to survive the next epoch. Its real mainnet value is one of
 * Phase 0's open unknowns (needs a live node), so it's a required
 * parameter here rather than a guessed constant.
 */
export function selectCoinsForSend(
  spendableSlips: SpendableSlip[],
  amountToSend: bigint,
  fee: bigint,
  dustThreshold: bigint
): CoinSelectionResult {
  const totalRequired = amountToSend + fee;

  const sorted = [...spendableSlips].sort((a, b) => (a.amount < b.amount ? -1 : a.amount > b.amount ? 1 : 0));

  const inputs: SpendableSlip[] = [];
  let total = BigInt(0);

  for (const slip of sorted) {
    if (total >= totalRequired) {
      break;
    }
    inputs.push(slip);
    total += slip.amount;
  }

  if (total < totalRequired) {
    throw new InsufficientBalanceError(total, totalRequired);
  }

  let changeAmount = total - totalRequired;

  // Change below the dust threshold: try to absorb it by pulling in one
  // more slip (pushing change either to zero-ish or above the line)
  // rather than minting an output that evaporates at the next epoch.
  let dustWarning = false;
  if (changeAmount > BigInt(0) && changeAmount < dustThreshold) {
    const usedKeys = new Set(inputs.map((s) => s.utxokey));
    const nextSlip = sorted.find((s) => !usedKeys.has(s.utxokey));
    if (nextSlip) {
      inputs.push(nextSlip);
      total += nextSlip.amount;
      changeAmount = total - totalRequired;
      // Pulling in one more slip could itself land back in the dust zone;
      // only clear the warning once change is actually zero or safely
      // above the threshold.
      dustWarning = changeAmount > BigInt(0) && changeAmount < dustThreshold;
    } else {
      dustWarning = true;
    }
  }

  return { inputs, changeAmount, dustWarning };
}
