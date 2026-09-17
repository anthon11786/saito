import { escapeHtml } from './onboarding-screen';
import type { SendPreview } from '../preview-send';

export interface SendConfirmDisplay {
  preview: SendPreview;
  amountDisplay: string; // SAITO, already converted by the caller
  feeDisplay: string;
  changeDisplay: string;
}

/**
 * Shows exactly what previewSend() planned -- including the dust warning,
 * un-hidden -- before anything is signed. previewSend()/coin-selection.ts
 * deliberately don't decide what to do about dustWarning themselves; this
 * is where that decision actually gets made, by the person sending money,
 * with the real number in front of them rather than a silent default.
 */
export function renderSendConfirm(data: SendConfirmDisplay): string {
  const { preview } = data;

  const dustWarning = preview.dustWarning
    ? `
      <div class="relaypwa-dust-warning">
        Sending leaves ${escapeHtml(data.changeDisplay)} SAITO in change that's below the
        network's rebroadcast threshold -- it will likely be unspendable dust rather than
        usable change.
      </div>`
    : '';

  return `
    <div class="relaypwa-send-confirm">
      <div class="relaypwa-conversation-header">
        <button type="button" id="relaypwa-send-back" class="relaypwa-back" aria-label="Back">&larr;</button>
        <span class="relaypwa-conversation-name">Confirm send</span>
      </div>

      <div class="relaypwa-confirm-row">
        <span class="relaypwa-label">To</span>
        <span class="relaypwa-pubkey">${escapeHtml(preview.recipientPublicKey)}</span>
      </div>
      <div class="relaypwa-confirm-row">
        <span class="relaypwa-label">Amount</span>
        <span>${escapeHtml(data.amountDisplay)} SAITO</span>
      </div>
      <div class="relaypwa-confirm-row">
        <span class="relaypwa-label">Fee</span>
        <span>${escapeHtml(data.feeDisplay)} SAITO</span>
      </div>
      <div class="relaypwa-confirm-row">
        <span class="relaypwa-label">Inputs used</span>
        <span>${preview.inputs.length}</span>
      </div>
      <div class="relaypwa-confirm-row">
        <span class="relaypwa-label">Change</span>
        <span>${escapeHtml(data.changeDisplay)} SAITO</span>
      </div>

      ${dustWarning}

      <button type="button" id="relaypwa-send-confirm" class="saito-button-primary relaypwa-continue">
        ${preview.dustWarning ? 'Send anyway' : 'Confirm and send'}
      </button>
      <div id="relaypwa-send-confirm-error" class="relaypwa-error" hidden></div>
    </div>
  `;
}
