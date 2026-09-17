import type { Saito } from '../../lib/saito/app';
import { returnOrCreatePeerConfig, type RelayPeer } from './lib/peer-config';
import { saveGroupSnapshot, type GroupRecordStore, type RelayChatGroup } from './lib/message-store';
import { IndexedDbGroupStore } from './lib/indexeddb-store';
import { hasCompletedOnboarding, markOnboardingComplete, importWalletKey } from './lib/onboarding';
import { addContact, listContacts, InvalidPublicKeyError } from './lib/contacts';
import { sendRelayChatMessage } from './lib/send-chat-message';
import { renderOnboardingScreen } from './lib/ui/onboarding-screen';
import { renderShell, type RelayTab } from './lib/ui/shell';
import { renderWalletTab } from './lib/ui/wallet-tab';
import { renderChatTab } from './lib/ui/chat-tab';
import { renderCallsTab } from './lib/ui/calls-tab';

const ModTemplate = require('../../lib/templates/modtemplate');
const HomePage = require('./index');

class RelayPwa extends ModTemplate {
  peers: RelayPeer[];
  messageStore: GroupRecordStore | null;
  activeTab: RelayTab;

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
  }

  async initialize(app: Saito) {
    await super.initialize(app);
    this.peers = returnOrCreatePeerConfig(app);

    if (app.BROWSER) {
      this.messageStore = new IndexedDbGroupStore();

      app.connection.on('chat-popup-render-request', (group: RelayChatGroup) => {
        if (!this.messageStore) {
          return;
        }
        saveGroupSnapshot(this.messageStore, group).catch((err) => {
          console.error('Relay: failed to persist chat history for group', group?.id, err);
        });
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
      const publicKey = await app.wallet.getPublicKey();
      const balance = await app.wallet.getBalance('SAITO');
      content.innerHTML = renderWalletTab({
        publicKey,
        balanceDisplay: app.wallet.convertNolanToSaito(balance)
      });
      content.querySelector('#relaypwa-copy-pubkey-wallet')?.addEventListener('click', () => {
        navigator.clipboard?.writeText(publicKey).catch(() => {});
      });
      return;
    }

    if (this.activeTab === 'calls') {
      content.innerHTML = renderCallsTab();
      return;
    }

    // chat
    const ownPublicKey = await app.wallet.getPublicKey();
    const contacts = listContacts(app, ownPublicKey);
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

    content.querySelector('#relaypwa-send-message-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const toSelect = content.querySelector<HTMLSelectElement>('#relaypwa-send-to');
      const messageInput = content.querySelector<HTMLInputElement>('#relaypwa-message-text');
      const errorBox = content.querySelector<HTMLElement>('#relaypwa-send-error');
      if (!toSelect || !messageInput || !errorBox) {
        return;
      }
      try {
        await sendRelayChatMessage(app, toSelect.value, messageInput.value);
        messageInput.value = '';
        errorBox.hidden = true;
      } catch (err: any) {
        errorBox.textContent = err.message || 'Could not send that message.';
        errorBox.hidden = false;
      }
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
