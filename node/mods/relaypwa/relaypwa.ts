import type { Saito } from '../../lib/saito/app';
import { returnOrCreatePeerConfig, type RelayPeer } from './lib/peer-config';
import { saveGroupSnapshot, type GroupRecordStore, type RelayChatGroup } from './lib/message-store';
import { IndexedDbGroupStore } from './lib/indexeddb-store';

const ModTemplate = require('../../lib/templates/modtemplate');
const HomePage = require('./index');

class RelayPwa extends ModTemplate {
  peers: RelayPeer[];
  messageStore: GroupRecordStore | null;

  constructor(app: Saito) {
    super(app);

    this.name = 'Relay';
    this.slug = 'relaypwa';
    this.description =
      'Relay: encrypted one-to-one chat, calls and a SAITO wallet, built as an installable PWA on the Saito network.';
    this.categories = 'Messaging Wallet Communications';

    this.styles = ['/relaypwa/style.css'];

    this.peers = [];
    this.messageStore = null;
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
