/**
 * Pure template: takes the identity that already exists by the time this
 * runs (wallet.initialize() generates a keypair on first run for ANY
 * install, before any module code executes -- see onboarding.ts) and
 * shows it, with the one-time option to import a different key instead.
 */
export function renderOnboardingScreen(publicKey: string): string {
  return `
    <div class="relaypwa-onboarding">
      <h1>Welcome to Relay</h1>
      <p>This is your Saito identity. Anyone who wants to message or pay you needs this key.</p>
      <div class="relaypwa-pubkey" id="relaypwa-pubkey">${escapeHtml(publicKey)}</div>
      <button type="button" id="relaypwa-copy-pubkey">Copy key</button>
      <details class="relaypwa-import-instead">
        <summary>Already have a Saito key? Import it instead</summary>
        <p class="relaypwa-import-warning">
          Importing replaces this key. Only do this once, before you've used this identity --
          switching later abandons any funds or contacts tied to it.
        </p>
        <input type="text" id="relaypwa-import-key" placeholder="Paste your private key" />
        <button type="button" id="relaypwa-import-submit">Import</button>
        <div id="relaypwa-import-error" class="relaypwa-error" hidden></div>
      </details>
      <button type="button" id="relaypwa-onboarding-continue" class="relaypwa-primary">Continue</button>
    </div>
  `;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
