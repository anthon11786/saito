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
    .map((c) => `<li data-pubkey="${escapeHtml(c.publicKey)}">${escapeHtml(c.identifier)}</li>`)
    .join('');

  return `
    <div class="relaypwa-chat-tab">
      <form id="relaypwa-add-contact-form">
        <input type="text" id="relaypwa-contact-pubkey" placeholder="Contact's public key" />
        <input type="text" id="relaypwa-contact-nickname" placeholder="Nickname" />
        <button type="submit">Add contact</button>
      </form>
      <div id="relaypwa-contact-error" class="relaypwa-error" hidden></div>

      <ul class="relaypwa-contact-list">${contactItems}</ul>

      ${
        contacts.length > 0
          ? `
      <form id="relaypwa-send-message-form">
        <select id="relaypwa-send-to">${contactOptions}</select>
        <input type="text" id="relaypwa-message-text" placeholder="Message" />
        <button type="submit">Send</button>
      </form>
      <div id="relaypwa-send-error" class="relaypwa-error" hidden></div>
      `
          : `<p class="relaypwa-empty-state">Add a contact to start chatting.</p>`
      }
    </div>
  `;
}
