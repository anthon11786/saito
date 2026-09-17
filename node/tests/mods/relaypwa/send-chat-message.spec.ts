import { sendRelayChatMessage, EncryptionFailedError } from '../../../mods/relaypwa/lib/send-chat-message';

describe('send-chat-message', () => {
  it('emits chat-message-user through the shared event bus once encryption is confirmed possible', async () => {
    const emit = jest.fn();
    const app = {
      keychain: { encryptMessage: async () => 'ciphertext-string' },
      connection: { emit }
    };

    await sendRelayChatMessage(app, 'recipient-pubkey', 'hello there');

    expect(emit).toHaveBeenCalledWith('chat-message-user', 'recipient-pubkey', 'hello there');
  });

  it('never asks chat to send when encryption would fail open', async () => {
    const emit = jest.fn();
    const app = {
      keychain: { encryptMessage: async (_pk: string, msg: unknown) => msg },
      connection: { emit }
    };

    await expect(sendRelayChatMessage(app, 'recipient-pubkey', 'secret plans')).rejects.toBeInstanceOf(
      EncryptionFailedError
    );
    expect(emit).not.toHaveBeenCalled();
  });
});
