import { encryptMessageOrThrow, EncryptionFailedError } from '../../../mods/relaypwa/lib/encrypt-guard';

describe('encrypt-guard', () => {
  it('returns the ciphertext string on success', async () => {
    const app = { keychain: { encryptMessage: async () => 'ciphertext-string' } };
    await expect(encryptMessageOrThrow(app, 'pk', { module: 'Chat', message: 'hi' })).resolves.toBe(
      'ciphertext-string'
    );
  });

  it('throws when keychain.encryptMessage fails open with an object message', async () => {
    // Mirrors the real bug: on failure, keychain.encryptMessage returns the
    // exact msg it was given, unencrypted, instead of refusing to send.
    const app = { keychain: { encryptMessage: async (_pk: string, msg: unknown) => msg } };
    await expect(encryptMessageOrThrow(app, 'pk', { module: 'Chat', message: 'secret' })).rejects.toBeInstanceOf(
      EncryptionFailedError
    );
  });

  it('throws when keychain.encryptMessage fails open with a plain string message', async () => {
    // This is the case a typeof-based check would miss: fail-open on a
    // string message "looks like" a successful string result too.
    const app = { keychain: { encryptMessage: async (_pk: string, msg: unknown) => msg } };
    await expect(encryptMessageOrThrow(app, 'pk', 'secret plans')).rejects.toBeInstanceOf(EncryptionFailedError);
  });
});
