import { escapeHtml } from './onboarding-screen';
import type { RelayContact } from '../contacts';
import type { StoredMessage } from '../message-store';

/**
 * A single contact's thread: history (from message-store.ts, keyed by
 * their public key via resolveContactKey) plus a compose box.
 *
 * A message is "mine" if its `from` array includes my own public key --
 * that's how addTransactionToGroup (chat.js) records the sender, so it's
 * the same signal chat's own UI uses to align bubbles.
 */
export function renderConversation(
  contact: RelayContact,
  messages: StoredMessage[],
  ownPublicKey: string
): string {
  const bubbles = messages
    .map((m) => {
      const mine = m.from.includes(ownPublicKey);
      return `
      <div class="relaypwa-message ${mine ? 'relaypwa-message-mine' : 'relaypwa-message-theirs'}">
        <div class="relaypwa-message-bubble">${escapeHtml(m.msg)}</div>
      </div>`;
    })
    .join('');

  return `
    <div class="relaypwa-conversation">
      <div class="relaypwa-conversation-header">
        <button type="button" id="relaypwa-conversation-back" class="relaypwa-back" aria-label="Back to contacts">&larr;</button>
        <span class="relaypwa-conversation-name">${escapeHtml(contact.identifier)}</span>
      </div>
      <div class="relaypwa-message-list" id="relaypwa-message-list">
        ${messages.length > 0 ? bubbles : '<p class="relaypwa-empty-state">No messages yet. Say hello!</p>'}
      </div>
      <form id="relaypwa-conversation-send-form" class="relaypwa-form relaypwa-send-form">
        <input
          type="text"
          id="relaypwa-conversation-message"
          class="relaypwa-input relaypwa-message-input"
          placeholder="Message"
          autocomplete="off"
        />
        <button type="submit" class="saito-button-primary">Send</button>
      </form>
      <div id="relaypwa-conversation-send-error" class="relaypwa-error" hidden></div>
    </div>
  `;
}
