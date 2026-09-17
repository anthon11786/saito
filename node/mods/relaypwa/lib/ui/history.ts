import { escapeHtml } from './onboarding-screen';

export interface TransactionHistoryEntry {
  signature: string;
  direction: 'sent' | 'received';
  counterparty: string;
  amountDisplay: string; // SAITO, already converted by the caller
  confirmed: boolean;
}

function truncateKey(key: string): string {
  if (key.length <= 18) {
    return key;
  }
  return `${key.slice(0, 10)}…${key.slice(-6)}`;
}

/**
 * A row per entry, newest first (the order transaction-history.ts's
 * upsertTransaction already maintains). Sent amounts get a "-" prefix,
 * received a "+", so the direction reads at a glance without relying on
 * color alone. A pending (unconfirmed) sent entry shows a badge rather than
 * being hidden -- the user just spent that money and should see it reflected
 * immediately, not wonder where it went until the next block confirms it.
 */
export function renderTransactionHistory(entries: TransactionHistoryEntry[]): string {
  if (entries.length === 0) {
    return '<div class="relaypwa-empty-state">No transactions yet.</div>';
  }

  const rows = entries
    .map((entry) => {
      const sign = entry.direction === 'sent' ? '-' : '+';
      const directionClass =
        entry.direction === 'sent' ? 'relaypwa-history-sent' : 'relaypwa-history-received';
      const statusBadge = entry.confirmed
        ? ''
        : '<span class="relaypwa-history-pending">Pending</span>';

      return `
        <li class="relaypwa-history-row">
          <div class="relaypwa-history-main">
            <span class="relaypwa-history-counterparty">${escapeHtml(truncateKey(entry.counterparty))}</span>
            ${statusBadge}
          </div>
          <span class="relaypwa-history-amount ${directionClass}">${sign}${escapeHtml(entry.amountDisplay)}</span>
        </li>
      `;
    })
    .join('');

  return `<ul class="relaypwa-history-list">${rows}</ul>`;
}
