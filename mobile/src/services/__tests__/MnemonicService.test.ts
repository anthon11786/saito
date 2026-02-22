import {
  generateMnemonicFromKey,
  getPrivateKeyFromMnemonic,
  isValidMnemonic,
} from '../MnemonicService';

// A valid 32-byte (256-bit) hex private key produces a 24-word mnemonic.
const TEST_PRIVATE_KEY = '4a16ffa08e5fc440772ee962c1d730041f12c7008a6e5c704d13dfd3d1905e0d';

describe('MnemonicService', () => {
  describe('generateMnemonicFromKey', () => {
    it('generates a mnemonic from a 32-byte hex private key', () => {
      const mnemonic = generateMnemonicFromKey(TEST_PRIVATE_KEY);
      const words = mnemonic.split(' ');
      // 32 bytes of entropy → 24 words
      expect(words).toHaveLength(24);
    });

    it('generates a valid mnemonic', () => {
      const mnemonic = generateMnemonicFromKey(TEST_PRIVATE_KEY);
      expect(isValidMnemonic(mnemonic)).toBe(true);
    });

    it('is deterministic (same key → same mnemonic)', () => {
      const m1 = generateMnemonicFromKey(TEST_PRIVATE_KEY);
      const m2 = generateMnemonicFromKey(TEST_PRIVATE_KEY);
      expect(m1).toBe(m2);
    });
  });

  describe('getPrivateKeyFromMnemonic', () => {
    it('recovers the original private key from its mnemonic', () => {
      const mnemonic = generateMnemonicFromKey(TEST_PRIVATE_KEY);
      const recovered = getPrivateKeyFromMnemonic(mnemonic);
      expect(recovered).toBe(TEST_PRIVATE_KEY);
    });
  });

  describe('round-trip', () => {
    it('key → mnemonic → key is lossless', () => {
      const mnemonic = generateMnemonicFromKey(TEST_PRIVATE_KEY);
      const recovered = getPrivateKeyFromMnemonic(mnemonic);
      expect(recovered).toBe(TEST_PRIVATE_KEY);
    });
  });

  describe('isValidMnemonic', () => {
    it('returns true for a valid mnemonic', () => {
      const mnemonic = generateMnemonicFromKey(TEST_PRIVATE_KEY);
      expect(isValidMnemonic(mnemonic)).toBe(true);
    });

    it('returns false for garbage input', () => {
      expect(isValidMnemonic('not a valid mnemonic phrase')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidMnemonic('')).toBe(false);
    });

    it('returns false for a mnemonic with a wrong word', () => {
      const mnemonic = generateMnemonicFromKey(TEST_PRIVATE_KEY);
      const words = mnemonic.split(' ');
      words[0] = 'zzzzzzz'; // invalid BIP39 word
      expect(isValidMnemonic(words.join(' '))).toBe(false);
    });
  });
});

