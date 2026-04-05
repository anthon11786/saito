module.exports = (app, mod) => {

  let verifyMode = '';
  if (typeof window !== 'undefined') {
    const hash = window.location.hash;
    const match = hash.match(/verify=([A-Za-z0-9+/=]+)/);
    if (match) {
      verifyMode = match[1];
    }
  }

  if (verifyMode) {
    return `
    <div id="witness-main" class="witness-container">
      <div class="witness-card">
        <div class="witness-header">
          <i class="fa-solid fa-shield-halved witness-icon"></i>
          <h1>Verify Proof</h1>
          <p class="witness-subtitle">Confirm a document's proof-of-existence on the Saito blockchain</p>
        </div>

        <div id="witness-verify-result" class="witness-verify-result">
          <div class="witness-loading">
            <img class="spinner" src="/saito/img/spinner.svg" alt="Loading...">
            <p>Looking up proof for transaction...</p>
          </div>
        </div>

        <div id="witness-reverify-zone" class="witness-drop-zone witness-drop-zone-small" style="display:none;">
          <i class="fa-solid fa-file-circle-check"></i>
          <p>Drop the file here to confirm it matches</p>
          <input type="file" id="witness-reverify-input" class="witness-file-input" />
        </div>

        <div id="witness-reverify-result" style="display:none;"></div>

        <div class="witness-footer">
          <a href="/witness" class="witness-link">Stamp a new document</a>
        </div>
      </div>
    </div>`;
  }

  return `
  <div id="witness-main" class="witness-container">
    <div class="witness-card">
      <div class="witness-header">
        <i class="fa-solid fa-shield-halved witness-icon"></i>
        <h1>Witness</h1>
        <p class="witness-subtitle">Prove a document exists at this moment in time — permanently, on-chain.</p>
      </div>

      <div class="witness-tabs">
        <button class="witness-tab active" data-tab="stamp">
          <i class="fa-solid fa-stamp"></i> Stamp
        </button>
        <button class="witness-tab" data-tab="verify">
          <i class="fa-solid fa-magnifying-glass"></i> Verify
        </button>
      </div>

      <div id="witness-tab-stamp" class="witness-tab-content active">
        <div id="witness-drop-zone" class="witness-drop-zone">
          <i class="fa-solid fa-cloud-arrow-up"></i>
          <p>Drag a file here<br><span class="witness-drop-hint">or click to browse</span></p>
          <input type="file" id="witness-file-input" class="witness-file-input" />
        </div>

        <div id="witness-status" class="witness-status" style="display:none;">
          <div class="witness-status-icon"></div>
          <div class="witness-status-text"></div>
        </div>

        <div id="witness-receipt" class="witness-receipt" style="display:none;">
          <h3><i class="fa-solid fa-circle-check"></i> Proof Anchored</h3>
          <div class="witness-receipt-details">
            <div class="witness-receipt-row">
              <span class="witness-label">File</span>
              <span id="receipt-filename" class="witness-value"></span>
            </div>
            <div class="witness-receipt-row">
              <span class="witness-label">SHA-256</span>
              <span id="receipt-hash" class="witness-value witness-mono"></span>
            </div>
            <div class="witness-receipt-row">
              <span class="witness-label">Transaction</span>
              <span id="receipt-sig" class="witness-value witness-mono"></span>
            </div>
            <div class="witness-receipt-row">
              <span class="witness-label">Time</span>
              <span id="receipt-time" class="witness-value"></span>
            </div>
          </div>
          <div class="witness-receipt-actions">
            <button id="witness-copy-link" class="witness-btn witness-btn-primary">
              <i class="fa-solid fa-link"></i> Copy Proof Link
            </button>
            <button id="witness-stamp-another" class="witness-btn witness-btn-secondary">
              <i class="fa-solid fa-plus"></i> Stamp Another
            </button>
          </div>
        </div>

        <div class="witness-info">
          <p><i class="fa-solid fa-lock"></i> Your file never leaves this browser. Only its hash is recorded on-chain.</p>
        </div>
      </div>

      <div id="witness-tab-verify" class="witness-tab-content">
        <div id="witness-verify-drop-zone" class="witness-drop-zone">
          <i class="fa-solid fa-file-circle-question"></i>
          <p>Drop a file to check if it has been witnessed<br><span class="witness-drop-hint">or click to browse</span></p>
          <input type="file" id="witness-verify-file-input" class="witness-file-input" />
        </div>

        <div class="witness-divider">
          <span>or</span>
        </div>

        <div class="witness-sig-lookup">
          <input type="text" id="witness-sig-input" class="witness-text-input" placeholder="Paste a transaction signature to look up..." />
          <button id="witness-sig-lookup-btn" class="witness-btn witness-btn-primary">
            <i class="fa-solid fa-search"></i> Look Up
          </button>
        </div>

        <div id="witness-verify-status" class="witness-status" style="display:none;">
          <div class="witness-status-icon"></div>
          <div class="witness-status-text"></div>
        </div>

        <div id="witness-verify-results" style="display:none;"></div>
      </div>
    </div>
  </div>`;
};

