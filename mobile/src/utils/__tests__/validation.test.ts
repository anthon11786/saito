import { isValidPublicKey, isValidAmount } from '../validation';

describe('isValidPublicKey', () => {
  it('accepts valid base58 public keys', () => {
    // 44-char base58 string (typical Saito key)
    expect(isValidPublicKey('28Mh8nEhxymH9bFMhSKU51pnSQAnqURuPYkXTUqY2ueDM')).toBe(true);
    // 43-char base58 string
    expect(isValidPublicKey('2Mh8nEhxymH9bFMhSKU51pnSQAnqURuPYkXTUqY2ue')).toBe(true);
  });

  it('rejects empty or missing input', () => {
    expect(isValidPublicKey('')).toBe(false);
    expect(isValidPublicKey(null as any)).toBe(false);
    expect(isValidPublicKey(undefined as any)).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidPublicKey(12345 as any)).toBe(false);
  });

  it('rejects keys that are too short', () => {
    expect(isValidPublicKey('abc')).toBe(false);
    expect(isValidPublicKey('1234567890')).toBe(false);
  });

  it('rejects keys with invalid base58 characters', () => {
    // 0, O, I, l are not in base58
    expect(isValidPublicKey('0OIl' + 'a'.repeat(40))).toBe(false);
  });

  it('trims whitespace before checking', () => {
    const key = '28Mh8nEhxymH9bFMhSKU51pnSQAnqURuPYkXTUqY2ueDM';
    expect(isValidPublicKey('  ' + key + '  ')).toBe(true);
  });
});

describe('isValidAmount', () => {
  it('accepts valid whole amounts', () => {
    expect(isValidAmount('1')).toBe(true);
    expect(isValidAmount('100')).toBe(true);
  });

  it('accepts valid decimal amounts up to 8 places', () => {
    expect(isValidAmount('1.5')).toBe(true);
    expect(isValidAmount('0.00000001')).toBe(true);
    expect(isValidAmount('123.12345678')).toBe(true);
  });

  it('rejects zero', () => {
    expect(isValidAmount('0')).toBe(false);
    expect(isValidAmount('0.0')).toBe(false);
  });

  it('rejects negative amounts', () => {
    expect(isValidAmount('-1')).toBe(false);
    expect(isValidAmount('-0.5')).toBe(false);
  });

  it('rejects empty or non-string input', () => {
    expect(isValidAmount('')).toBe(false);
    expect(isValidAmount(null as any)).toBe(false);
    expect(isValidAmount(undefined as any)).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    expect(isValidAmount('abc')).toBe(false);
    expect(isValidAmount('1.2.3')).toBe(false);
  });

  it('rejects amounts with more than 8 decimal places', () => {
    expect(isValidAmount('1.123456789')).toBe(false);
  });
});

