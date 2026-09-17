export interface RelayContact {
  publicKey: string;
  identifier: string;
}

export class InvalidPublicKeyError extends Error {
  constructor(publicKey: string) {
    super(`Relay: "${publicKey}" is not a valid Saito public key`);
    this.name = 'InvalidPublicKeyError';
  }
}

/**
 * Contacts are not a separate Relay store -- they're a thin layer over
 * app.keychain, which already has exactly this shape (addKey with an
 * `identifier`, looked up later through returnUsername). Reusing it
 * matters for more than avoiding duplication: `watched: true` is what
 * makes keychain.saveKeys() emit 'keychain-updated', which wallet.ts
 * listens for to refresh the wallet's keylist
 * (setKeyList(keychain.returnWatchedPublicKeys())) -- and the keylist is
 * the mechanism the plan's platform primer describes for how a lite
 * client receives anything at all (the peer node forwards transactions
 * matching keys on it). Adding a contact without `watched: true` would
 * save a nickname that never actually receives messages.
 */
export function addContact(app: any, publicKey: string, nickname: string): void {
  if (!app.crypto.isPublicKey(publicKey)) {
    throw new InvalidPublicKeyError(publicKey);
  }
  app.keychain.addKey(publicKey, { identifier: nickname, watched: true });
}

export function listContacts(app: any): RelayContact[] {
  return app.keychain.returnWatchedPublicKeys().map((publicKey: string) => ({
    publicKey,
    identifier: app.keychain.returnUsername(publicKey)
  }));
}
