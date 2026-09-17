import { addContact, listContacts, InvalidPublicKeyError } from '../../../mods/relaypwa/lib/contacts';

function makeFakeApp() {
  const keys: any[] = [];
  return {
    crypto: { isPublicKey: (k: string) => k === 'validkey123' },
    keychain: {
      keys,
      addKey(pk: string, data: any) {
        keys.push({ publicKey: pk, ...data });
      },
      returnWatchedPublicKeys() {
        return keys.filter((k) => k.watched).map((k) => k.publicKey);
      },
      returnUsername(pk: string) {
        const k = keys.find((x) => x.publicKey === pk);
        return k && k.identifier ? k.identifier : pk;
      }
    }
  };
}

describe('contacts', () => {
  it('rejects an invalid public key before touching the keychain', () => {
    const app = makeFakeApp();
    expect(() => addContact(app, 'garbage-not-a-key', 'Eve')).toThrow(InvalidPublicKeyError);
    expect(app.keychain.keys).toHaveLength(0);
  });

  it('adds a valid contact as watched, since only watched keys ever receive anything', () => {
    const app = makeFakeApp();
    addContact(app, 'validkey123', 'Alice');
    expect(app.keychain.keys).toEqual([{ publicKey: 'validkey123', identifier: 'Alice', watched: true }]);
  });

  it('lists contacts by watched keys with their nicknames', () => {
    const app = makeFakeApp();
    addContact(app, 'validkey123', 'Alice');
    expect(listContacts(app)).toEqual([{ publicKey: 'validkey123', identifier: 'Alice' }]);
  });
});
