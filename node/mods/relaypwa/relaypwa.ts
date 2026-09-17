import type { Saito } from '../../lib/saito/app';
import { returnOrCreatePeerConfig, type RelayPeer } from './lib/peer-config';
import {
  saveGroupSnapshot,
  getGroupMessages,
  resolveContactKey,
  type GroupRecordStore,
  type RelayChatGroup
} from './lib/message-store';
import { IndexedDbGroupStore } from './lib/indexeddb-store';
import { hasCompletedOnboarding, markOnboardingComplete, importWalletKey } from './lib/onboarding';
import { addContact, listContacts, InvalidPublicKeyError } from './lib/contacts';
import { sendRelayChatMessage } from './lib/send-chat-message';
import { previewSend, sendFromPreview, type SendPreview } from './lib/preview-send';
import { renderOnboardingScreen } from './lib/ui/onboarding-screen';
import { renderShell, type RelayTab } from './lib/ui/shell';
import { renderWalletTab, renderSendForm } from './lib/ui/wallet-tab';
import { renderSendConfirm } from './lib/ui/send-confirm';
import { renderChatTab } from './lib/ui/chat-tab';
import { renderConversation } from './lib/ui/conversation';
import { renderCallsTab } from './lib/ui/calls-tab';

const ModTemplate = require('../../lib/templates/modtemplate');
const HomePage = require('./index');

/**
 * The real ATR rebroadcast fee -- the threshold below which change becomes
 * unspendable dust -- is one of Phase 0's open unknowns; it needs a live
 * node to determine (see coin-selection.ts). 0 is a deliberate, documented
 * placeholder rather than a guess: it makes coin-selection.ts's dust
 * avoidance a safe no-op (nothing is "below" a zero threshold) until a
 * real value is available, rather than silently pretending to protect
 * against a number nobody has actually measured.
 */
const PLACEHOLDER_DUST_THRESHOLD = BigInt(0);

type WalletView = 'default' | 'send-form' | 'send-confirm';

class RelayPwa extends ModTemplate {
  peers: RelayPeer[];
  messageStore: GroupRecordStore | null;
  activeTab: RelayTab;
  selectedContactKey: string | null;
  walletView: WalletView;
  sendPreview: SendPreview | null;

  constructor(app: Saito) {
    super(app);

    // ModTemplate's module registry keys uniqueness off .name, not .slug --
    // node/mods/relay/relay.js (an unrelated core off-chain-transport
    // utility) already uses .name = 'Relay', and having both loaded trips
    // "mod Relay is installed more than once!" in lib/saito/modules.ts.
    // .appname is the established way modules separate their internal name
    // from what's shown to users (videocall.js: name 'Videocall', appname
    // 'Saito Talk'; ModTemplate.returnName() prefers appname when set) --
    // so the product stays branded "Relay" everywhere a user sees it while
    // the internal identifier doesn't collide.
    this.name = 'RelayPWA';
    this.appname = 'Relay';
    this.slug = 'relaypwa';
    this.description =
      'Relay: encrypted one-to-one chat, calls and a SAITO wallet, built as an installable PWA on the Saito network.';
    this.categories = 'Messaging Wallet Communications';

    this.styles = ['/relaypwa/style.css'];

    this.peers = [];
    this.messageStore = null;
    this.activeTab = 'chat';
    this.selectedContactKey = null;
    this.walletView = 'default';
    this.sendPreview = null;
  }

  async initialize(app: Saito) {
    await super.initialize(app);
    this.peers = returnOrCreatePeerConfig(app);

    if (app.BROWSER) {
      this.messageStore = new IndexedDbGroupStore();

      app.connection.on('chat-popup-render-request', async (group: RelayChatGroup) => {
        if (!this.messageStore) {
          return;
        }
        try {
          const ownPublicKey = await app.wallet.getPublicKey();
          const contactKey = resolveContactKey(group, ownPublicKey);
          if (!contactKey) {
            return; // not a 1:1 conversation -- out of Relay's MVP scope
          }
          await saveGroupSnapshot(this.messageStore, contactKey, group.txs);

          // Live-update if this is the conversation currently open.
          if (contactKey === this.selectedContactKey && this.activeTab === 'chat') {
            const root = document.getElementById('relaypwa-root');
            if (root) {
              await this.renderActiveTab(app, root);
            }
          }
        } catch (err) {
          console.error('Relay: failed to persist chat history for group', group?.id, err);
        }
      });
    }
  }

  async render(app: Saito) {
    await super.render();

    if (!app.BROWSER) {
      return;
    }

    const root = document.getElementById('relaypwa-root');
    if (!root) {
      return;
    }

    if (!hasCompletedOnboarding(app)) {
      const publicKey = await app.wallet.getPublicKey();
      root.innerHTML = renderOnboardingScreen(publicKey);
      this.wireOnboardingEvents(app, root);
      return;
    }

    root.innerHTML = renderShell(this.activeTab);
    root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        this.activeTab = button.dataset.tab as RelayTab;
        this.render(app);
      });
    });

    await this.renderActiveTab(app, root);
  }

  private wireOnboardingEvents(app: Saito, root: HTMLElement) {
    root.querySelector('#relaypwa-copy-pubkey')?.addEventListener('click', async () => {
      const publicKey = await app.wallet.getPublicKey();
      navigator.clipboard?.writeText(publicKey).catch(() => {});
    });

    root.querySelector('#relaypwa-onboarding-continue')?.addEventListener('click', () => {
      markOnboardingComplete(app);
      this.render(app);
    });

    root.querySelector('#relaypwa-import-submit')?.addEventListener('click', async () => {
      const input = root.querySelector<HTMLInputElement>('#relaypwa-import-key');
      const errorBox = root.querySelector<HTMLElement>('#relaypwa-import-error');
      if (!input || !errorBox) {
        return;
      }
      try {
        await importWalletKey(app, input.value.trim());
        markOnboardingComplete(app);
        this.render(app);
      } catch (err: any) {
        errorBox.textContent = err.message || 'Could not import that key.';
        errorBox.hidden = false;
      }
    });
  }

  private async renderActiveTab(app: Saito, root: HTMLElement) {
    const content = root.querySelector('#relaypwa-tab-content');
    if (!content) {
      return;
    }

    if (this.activeTab === 'wallet') {
      await this.renderWalletView(app, content, root);
      return;
    }

    if (this.activeTab === 'calls') {
      content.innerHTML = renderCallsTab();
      return;
    }

    // chat
    const ownPublicKey = await app.wallet.getPublicKey();
    const contacts = listContacts(app, ownPublicKey);

    if (this.selectedContactKey) {
      const contact = contacts.find((c) => c.publicKey === this.selectedContactKey);
      if (!contact) {
        // Contact no longer exists (e.g. removed elsewhere) -- fall back to the list.
        this.selectedContactKey = null;
        return this.renderActiveTab(app, root);
      }
      await this.renderConversationTab(app, content, contact, ownPublicKey, root);
      return;
    }

    content.innerHTML = renderChatTab(contacts);

    content.querySelector('#relaypwa-add-contact-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const pubkeyInput = content.querySelector<HTMLInputElement>('#relaypwa-contact-pubkey');
      const nicknameInput = content.querySelector<HTMLInputElement>('#relaypwa-contact-nickname');
      const errorBox = content.querySelector<HTMLElement>('#relaypwa-contact-error');
      if (!pubkeyInput || !nicknameInput || !errorBox) {
        return;
      }
      try {
        addContact(app, pubkeyInput.value.trim(), nicknameInput.value.trim());
        this.renderActiveTab(app, root);
      } catch (err) {
        errorBox.textContent = err instanceof InvalidPublicKeyError ? err.message : 'Could not add that contact.';
        errorBox.hidden = false;
      }
    });

    content.querySelectorAll<HTMLLIElement>('.relaypwa-contact').forEach((item) => {
      item.addEventListener('click', () => {
        this.selectedContactKey = item.dataset.pubkey ?? null;
        this.renderActiveTab(app, root);
      });
    });
  }

  private async renderConversationTab(
    app: Saito,
    content: Element,
    contact: { publicKey: string; identifier: string },
    ownPublicKey: string,
    root: HTMLElement
  ) {
    const messages = this.messageStore ? await getGroupMessages(this.messageStore, contact.publicKey) : [];
    content.innerHTML = renderConversation(contact, messages, ownPublicKey);

    content.querySelector('#relaypwa-conversation-back')?.addEventListener('click', () => {
      this.selectedContactKey = null;
      this.renderActiveTab(app, root);
    });

    content.querySelector('#relaypwa-conversation-send-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const messageInput = content.querySelector<HTMLInputElement>('#relaypwa-conversation-message');
      const errorBox = content.querySelector<HTMLElement>('#relaypwa-conversation-send-error');
      if (!messageInput || !errorBox) {
        return;
      }
      const text = messageInput.value.trim();
      if (!text) {
        return;
      }
      try {
        await sendRelayChatMessage(app, contact.publicKey, text);
        messageInput.value = '';
        errorBox.hidden = true;
      } catch (err: any) {
        errorBox.textContent = err.message || 'Could not send that message.';
        errorBox.hidden = false;
      }
    });

    // Scroll to the newest message.
    const list = content.querySelector('#relaypwa-message-list');
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }

  private async renderWalletView(app: Saito, content: Element, root: HTMLElement) {
    if (this.walletView === 'send-form') {
      content.innerHTML = renderSendForm();

      content.querySelector('#relaypwa-send-cancel')?.addEventListener('click', () => {
        this.walletView = 'default';
        this.renderActiveTab(app, root);
      });

      content.querySelector('#relaypwa-send-review-form')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const recipientInput = content.querySelector<HTMLInputElement>('#relaypwa-send-recipient');
        const amountInput = content.querySelector<HTMLInputElement>('#relaypwa-send-amount');
        const errorBox = content.querySelector<HTMLElement>('#relaypwa-send-form-error');
        if (!recipientInput || !amountInput || !errorBox) {
          return;
        }
        try {
          const amountNolan = app.wallet.convertSaitoToNolan(amountInput.value.trim());
          const preview = await previewSend(
            app,
            recipientInput.value.trim(),
            amountNolan,
            app.wallet.default_fee,
            PLACEHOLDER_DUST_THRESHOLD
          );
          this.sendPreview = preview;
          this.walletView = 'send-confirm';
          this.renderActiveTab(app, root);
        } catch (err: any) {
          errorBox.textContent = err.message || 'Could not plan that send.';
          errorBox.hidden = false;
        }
      });
      return;
    }

    if (this.walletView === 'send-confirm' && this.sendPreview) {
      const preview = this.sendPreview;
      content.innerHTML = renderSendConfirm({
        preview,
        amountDisplay: app.wallet.convertNolanToSaito(preview.amount),
        feeDisplay: app.wallet.convertNolanToSaito(preview.fee),
        changeDisplay: app.wallet.convertNolanToSaito(preview.changeAmount)
      });

      content.querySelector('#relaypwa-send-back')?.addEventListener('click', () => {
        this.sendPreview = null;
        this.walletView = 'send-form';
        this.renderActiveTab(app, root);
      });

      content.querySelector('#relaypwa-send-confirm')?.addEventListener('click', async () => {
        const errorBox = content.querySelector<HTMLElement>('#relaypwa-send-confirm-error');
        try {
          await sendFromPreview(app, preview);
          this.sendPreview = null;
          this.walletView = 'default';
          this.renderActiveTab(app, root);
        } catch (err: any) {
          if (errorBox) {
            errorBox.textContent = err.message || 'Send failed.';
            errorBox.hidden = false;
          }
        }
      });
      return;
    }

    // default
    const publicKey = await app.wallet.getPublicKey();
    const balance = await app.wallet.getBalance('SAITO');
    content.innerHTML = renderWalletTab({
      publicKey,
      balanceDisplay: app.wallet.convertNolanToSaito(balance)
    });
    content.querySelector('#relaypwa-copy-pubkey-wallet')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(publicKey).catch(() => {});
    });
    content.querySelector('#relaypwa-send-open')?.addEventListener('click', () => {
      this.walletView = 'send-form';
      this.renderActiveTab(app, root);
    });
  }

  webServer(app: Saito, expressapp, express) {
    const webdir = `${__dirname}/../../mods/${this.dirname}/web`;
    const mod_self = this;

    expressapp.get('/' + encodeURI(this.returnSlug()), async (req, res) => {
      if (!res.finished) {
        res.setHeader('Content-type', 'text/html');
        res.charset = 'UTF-8';
        return res.send(HomePage(app, mod_self, app.build_number));
      }
      return;
    });

    expressapp.use('/' + encodeURI(this.returnSlug()), express.static(webdir));
  }
}

module.exports = RelayPwa;
