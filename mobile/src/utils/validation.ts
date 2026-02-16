export function isValidPublicKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  // Saito public keys are base58-encoded, typically 43-44 characters
  return /^[1-9A-HJ-NP-Za-km-z]{32,50}$/.test(trimmed);
}

export function isValidAmount(amount: string): boolean {
  if (!amount || typeof amount !== 'string') return false;
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && /^\d+(\.\d{1,8})?$/.test(amount);
}
