import { escapeHtml } from './onboarding-screen';
import type { RelayContact } from '../contacts';

/**
 * Contacts + a send form. Deliberately doesn't render conversation history
 * yet: message-store.ts keys stored history by chat.js's own group.id, and
 * resolving "this contact's public key" -> "their group.id" needs the
 * group.members list chat.js hands over on 'chat-popup-render-request' --
 * real plumbing, but scoped out of this pass rather than rushed.
 */
export function renderChatTab(contacts: RelayContact[]): string {
  const contactOptions = contacts
    .map((c) => `<option value="${escapeHtml(c.publicKey)}">${escapeHtml(c.identifier)}</option>`)
    .join('');

  const contactItems = contacts
    .map(
      (c) => `
      <li class="relaypwa-contact" data-pubkey="${escapeHtml(c.publicKey)}">
        <span class="relaypwa-contact-avatar">${escapeHtml(c.identifier.slice(0, 1).toUpperCase())}</span>
        <span class="relaypwa-contact-name">${escapeHtml(c.identifier)}</span>
      </li>`
    )
    .join('');

  return `
    <div class="relaypwa-chat-tab">
      <details class="relaypwa-add-contact">
        <summary>Add contact</summary>
        <form id="relaypwa-add-contact-form" class="relaypwa-form">
          <input type="text" id="relaypwa-contact-pubkey" class="relaypwa-input" placeholder="Contact's public key" />
          <input type="text" id="relaypwa-contact-nickname" class="relaypwa-input" placeholder="Nickname" />
          <button type="submit" class="saito-button-secondary">Add contact</button>
        </form>
        <div id="relaypwa-contact-error" class="relaypwa-error" hidden></div>
      </details>

      ${
        contacts.length > 0
          ? `
      <ul class="relaypwa-contact-list">${contactItems}</ul>

      <form id="relaypwa-send-message-form" class="relaypwa-form relaypwa-send-form">
        <select id="relaypwa-send-to" class="relaypwa-input">${contactOptions}</select>
        <input type="text" id="relaypwa-message-text" class="relaypwa-input relaypwa-message-input" placeholder="Message" />
        <button type="submit" class="saito-button-primary">Send</button>
      </form>
      <div id="relaypwa-send-error" class="relaypwa-error" hidden></div>
      `
          : `<p class="relaypwa-empty-state">Add a contact to start chatting.</p>`
      }
    </div>
  `;
}
