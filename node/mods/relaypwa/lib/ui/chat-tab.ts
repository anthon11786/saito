import { escapeHtml } from './onboarding-screen';
import type { RelayContact } from '../contacts';

/**
 * The contact list -- clicking a contact (wired in relaypwa.ts) opens
 * lib/ui/conversation.ts's per-contact thread view, where messages are
 * actually sent from. This view is just contacts + adding one.
 */
export function renderChatTab(contacts: RelayContact[]): string {
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
          ? `<ul class="relaypwa-contact-list">${contactItems}</ul>`
          : `<p class="relaypwa-empty-state">Add a contact to start chatting.</p>`
      }
    </div>
  `;
}
