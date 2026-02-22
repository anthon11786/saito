import { nolanToSaito, saitoToNolan, truncateKey, formatTimestamp } from '../formatting';

describe('nolanToSaito', () => {
  it('converts whole SAITO amounts (no fractional)', () => {
    expect(nolanToSaito('100000000')).toBe('1');
    expect(nolanToSaito('500000000')).toBe('5');
    expect(nolanToSaito('0')).toBe('0');
  });

  it('converts fractional amounts', () => {
    expect(nolanToSaito('150000000')).toBe('1.5');
    expect(nolanToSaito('100000001')).toBe('1.00000001');
    expect(nolanToSaito('123456789')).toBe('1.23456789');
  });

  it('handles sub-1 SAITO amounts', () => {
    expect(nolanToSaito('50000000')).toBe('0.5');
    expect(nolanToSaito('1')).toBe('0.00000001');
  });

  it('accepts bigint input', () => {
    expect(nolanToSaito(BigInt(200000000))).toBe('2');
    expect(nolanToSaito(BigInt(250000000))).toBe('2.5');
  });

  it('accepts number input', () => {
    expect(nolanToSaito(100000000)).toBe('1');
  });

  it('strips trailing zeros from fractional part', () => {
    expect(nolanToSaito('110000000')).toBe('1.1');
    expect(nolanToSaito('100100000')).toBe('1.001');
  });
});

describe('saitoToNolan', () => {
  it('converts whole amounts', () => {
    expect(saitoToNolan('1')).toBe('100000000');
    expect(saitoToNolan('5')).toBe('500000000');
    expect(saitoToNolan('0')).toBe('0');
  });

  it('converts fractional amounts', () => {
    expect(saitoToNolan('1.5')).toBe('150000000');
    expect(saitoToNolan('1.00000001')).toBe('100000001');
    expect(saitoToNolan('0.5')).toBe('50000000');
  });

  it('handles short fractional parts by padding', () => {
    expect(saitoToNolan('1.1')).toBe('110000000');
    expect(saitoToNolan('2.25')).toBe('225000000');
  });

  it('truncates fractional parts longer than 8 digits', () => {
    expect(saitoToNolan('1.123456789')).toBe('112345678');
  });

  it('round-trips with nolanToSaito', () => {
    const nolan = '123456789';
    expect(saitoToNolan(nolanToSaito(nolan))).toBe(nolan);
  });
});

describe('truncateKey', () => {
  it('truncates long keys', () => {
    const key = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop';
    expect(truncateKey(key, 8)).toBe('ABCDEFGH...ijklmnop');
  });

  it('returns short keys unchanged', () => {
    expect(truncateKey('short')).toBe('short');
  });

  it('respects custom char count', () => {
    const key = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop';
    expect(truncateKey(key, 4)).toBe('ABCD...mnop');
  });
});

describe('formatTimestamp', () => {
  it('returns time string for today', () => {
    const now = Date.now();
    const result = formatTimestamp(now);
    // Should be a time like "12:34 PM", not a date
    expect(result).not.toMatch(/\d{4}/); // no year
    expect(result.length).toBeLessThan(15);
  });

  it('returns "Yesterday" for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);
    expect(formatTimestamp(yesterday.getTime())).toBe('Yesterday');
  });

  it('returns short date for older timestamps', () => {
    // A date well in the past
    const old = new Date(2023, 0, 15, 12, 0, 0).getTime();
    const result = formatTimestamp(old);
    // Should contain "Jan" and "15"
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
  });
});

