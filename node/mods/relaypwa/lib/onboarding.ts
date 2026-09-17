export class InvalidPrivateKeyError extends Error {
  constructor() {
    super('Relay: that is not a valid Saito private key');
    this.name = 'InvalidPrivateKeyError';
  }
}

/**
 * app.wallet.initialize() already generates a fresh keypair on first run
 * for any brand-new install (lib/saito/wallet.ts: if no private/public key
 * exists yet, it calls resetWallet(), which happens before any module,
 * including this one, ever initializes). So Relay's onboarding does not
 * need to generate a key itself -- one already exists by the time this
 * runs. What onboarding actually needs to track is Relay-specific: has
 * *this* first-run screen (show identity, offer import-instead) been
 * shown yet.
 */
export function hasCompletedOnboarding(app: any): boolean {
  return Boolean(app.options.relaypwa?.onboarding_complete);
}

export function markOnboardingComplete(app: any): void {
  if (!app.options.relaypwa) {
    app.options.relaypwa = {};
  }
  app.options.relaypwa.onboarding_complete = true;
  app.storage.saveOptions();
}

/**
 * Importing an existing key is the one onboarding action that can destroy
 * data, so it gets its own careful path rather than calling straight into
 * wallet.onUpgrade('import', ...).
 *
 * wallet.ts's own onUpgrade('import', privatekey) calls resetWallet() --
 * which wipes browser storage, blockchain state and options -- BEFORE it
 * derives the public key via app.crypto.generatePublicKey(). If that
 * derivation throws (an invalid key), the wipe has already happened; the
 * function just returns the error afterwards. Confirmed empirically that
 * generatePublicKey (-> saito-wasm's generate_public_key) does throw
 * cleanly on malformed input ("Failed parsing private key string to
 * key"), so validating with it here, before ever calling onUpgrade,
 * means a bad paste is rejected without touching the existing wallet.
 */
export async function importWalletKey(app: any, privateKeyHex: string): Promise<void> {
  try {
    app.crypto.generatePublicKey(privateKeyHex);
  } catch {
    throw new InvalidPrivateKeyError();
  }

  const err = await app.wallet.onUpgrade('import', privateKeyHex, null);
  if (err) {
    throw err;
  }
}
