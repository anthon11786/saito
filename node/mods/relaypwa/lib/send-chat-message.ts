import { encryptMessageOrThrow, EncryptionFailedError } from './encrypt-guard';

export { EncryptionFailedError };

/**
 * Sends a one-to-one message through the existing `chat` module via its
 * public event-bus API ('chat-message-user'), rather than forking chat.js
 * or wallet.ts to add fail-closed behaviour there.
 *
 * chat.js's own send path calls keychain.encryptMessage internally but
 * fails open (see encrypt-guard.ts), and that call lives in wallet.ts,
 * which is core library and must not be forked to fix it. Instead this
 * pre-flight-checks encryption for the recipient before ever asking chat
 * to send. Whether encryption succeeds depends only on key material for
 * that recipient, not on message content, so probing with the real
 * plaintext reliably predicts whether chat's own encryption call a moment
 * later would also succeed. If it can't, this throws and chat is never
 * asked to send -- fail closed at the Relay module boundary.
 */
export async function sendRelayChatMessage(
  app: any,
  recipientPublicKey: string,
  message: string
): Promise<void> {
  await encryptMessageOrThrow(app, recipientPublicKey, message);
  app.connection.emit('chat-message-user', recipientPublicKey, message);
}
