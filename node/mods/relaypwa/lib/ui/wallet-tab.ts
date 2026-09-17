import { escapeHtml } from './onboarding-screen';

export interface WalletTabData {
  publicKey: string;
  balanceDisplay: string; // already converted to SAITO by the caller (app.wallet.convertNolanToSaito)
}

export function renderWalletTab(data: WalletTabData): string {
  return `
    <div class="relaypwa-wallet-tab">
      <div class="relaypwa-balance">
        <span class="relaypwa-balance-amount">${escapeHtml(data.balanceDisplay)}</span>
        <span class="relaypwa-balance-ticker">SAITO</span>
      </div>

      <button type="button" id="relaypwa-send-open" class="saito-button-primary relaypwa-send-open">Send</button>

      <div class="relaypwa-receive">
        <div class="relaypwa-label">Your address</div>
        <div class="relaypwa-pubkey">${escapeHtml(data.publicKey)}</div>
        <button type="button" id="relaypwa-copy-pubkey-wallet" class="saito-button-secondary">Copy</button>
      </div>
    </div>
  `;
}

/**
 * The compose step, before anything is planned or signed. Amount is asked
 * for in SAITO (display units) -- the caller converts to nolan via
 * app.wallet.convertSaitoToNolan before calling previewSend().
 */
export function renderSendForm(): string {
  return `
    <div class="relaypwa-send-form-screen">
      <div class="relaypwa-conversation-header">
        <button type="button" id="relaypwa-send-cancel" class="relaypwa-back" aria-label="Cancel">&larr;</button>
        <span class="relaypwa-conversation-name">Send SAITO</span>
      </div>
      <form id="relaypwa-send-review-form" class="relaypwa-form">
        <input type="text" id="relaypwa-send-recipient" class="relaypwa-input" placeholder="Recipient's public key" />
        <input type="text" id="relaypwa-send-amount" class="relaypwa-input" placeholder="Amount (SAITO)" inputmode="decimal" />
        <button type="submit" class="saito-button-primary">Review</button>
      </form>
      <div id="relaypwa-send-form-error" class="relaypwa-error" hidden></div>
    </div>
  `;
}
