import {
  hasCompletedOnboarding,
  markOnboardingComplete,
  importWalletKey,
  InvalidPrivateKeyError
} from '../../../mods/relaypwa/lib/onboarding';

describe('onboarding flag', () => {
  it('is false until explicitly marked complete, then persists', () => {
    const app: any = { options: {}, storage: { saveOptions: jest.fn() } };
    expect(hasCompletedOnboarding(app)).toBe(false);

    markOnboardingComplete(app);

    expect(hasCompletedOnboarding(app)).toBe(true);
    expect(app.options.relaypwa.onboarding_complete).toBe(true);
    expect(app.storage.saveOptions).toHaveBeenCalled();
  });
});

describe('importWalletKey', () => {
  function makeFakeApp(resetTracker: { called: boolean }) {
    return {
      crypto: {
        generatePublicKey: (hex: string) => {
          if (hex !== 'validkeyhex') {
            throw new Error('Failed parsing private key string to key');
          }
          return 'derived-pubkey';
        }
      },
      wallet: {
        // Mirrors the real wallet.onUpgrade('import', ...): it resets
        // (wipes browser storage/blockchain/options) BEFORE it derives the
        // public key, so an invalid key must never reach this at all.
        onUpgrade: async (_type: string, privatekey: string) => {
          resetTracker.called = true;
          if (privatekey !== 'validkeyhex') {
            return new Error('should never get here if pre-validation worked');
          }
          return null;
        }
      }
    };
  }

  it('rejects an invalid key before the destructive wallet import path ever runs', async () => {
    const resetTracker = { called: false };
    const app = makeFakeApp(resetTracker);

    await expect(importWalletKey(app, 'garbage-key')).rejects.toBeInstanceOf(InvalidPrivateKeyError);
    expect(resetTracker.called).toBe(false);
  });

  it('imports a valid key through the real wallet path', async () => {
    const resetTracker = { called: false };
    const app = makeFakeApp(resetTracker);

    await expect(importWalletKey(app, 'validkeyhex')).resolves.toBeUndefined();
    expect(resetTracker.called).toBe(true);
  });
});
