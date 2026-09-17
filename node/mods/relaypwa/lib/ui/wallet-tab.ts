import { escapeHtml } from './onboarding-screen';

export interface WalletTabData {
  publicKey: string;
  balanceDisplay: string; // already converted to SAITO by the caller (app.wallet.convertNolanToSaito)
}

/**
 * Read-only for now: balance and receive (key + QR later). Send is
 * deliberately not wired into this UI yet -- previewSend()/sendFromPreview()
 * are implemented and verified (see lib/preview-send.ts), but a send button
 * needs a real confirmation flow first (showing the dust warning, letting
 * the user decide), and rushing that UI felt like the wrong tradeoff for
 * money-moving code.
 */
export function renderWalletTab(data: WalletTabData): string {
  return `
    <div class="relaypwa-wallet-tab">
      <div class="relaypwa-balance">
        <span class="relaypwa-balance-amount">${escapeHtml(data.balanceDisplay)}</span>
        <span class="relaypwa-balance-ticker">SAITO</span>
      </div>
      <div class="relaypwa-receive">
        <div class="relaypwa-label">Your address</div>
        <div class="relaypwa-pubkey">${escapeHtml(data.publicKey)}</div>
        <button type="button" id="relaypwa-copy-pubkey-wallet">Copy</button>
      </div>
      <p class="relaypwa-coming-soon">Sending SAITO is coming soon.</p>
    </div>
  `;
}
