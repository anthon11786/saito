const NOLAN_PER_SAITO = 100_000_000;

export function nolanToSaito(nolan: string | number | bigint): string {
  const val = typeof nolan === 'bigint' ? nolan : BigInt(nolan);
  const whole = val / BigInt(NOLAN_PER_SAITO);
  const frac = val % BigInt(NOLAN_PER_SAITO);
  if (frac === BigInt(0)) {
    return whole.toString();
  }
  const fracStr = frac.toString().padStart(8, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

export function saitoToNolan(saito: string): string {
  const parts = saito.split('.');
  const whole = BigInt(parts[0] || '0') * BigInt(NOLAN_PER_SAITO);
  if (parts.length === 1) {
    return whole.toString();
  }
  const fracStr = (parts[1] || '0').padEnd(8, '0').slice(0, 8);
  return (whole + BigInt(fracStr)).toString();
}

export function truncateKey(key: string, chars = 8): string {
  if (key.length <= chars * 2 + 3) return key;
  return `${key.slice(0, chars)}...${key.slice(-chars)}`;
}

export function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
