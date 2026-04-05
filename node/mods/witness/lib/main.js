const WitnessMainTemplate = require('./main.template');

class WitnessMain {
  constructor(app, mod) {
    this.app = app;
    this.mod = mod;
  }

  render() {
    document.body.innerHTML = '';
    this.app.browser.addElementToDom(WitnessMainTemplate(this.app, this.mod));

    // Check if we're in verify-by-link mode
    const hash = window.location.hash;
    const match = hash.match(/verify=([A-Za-z0-9+/=]+)/);
    if (match) {
      this.handleVerifyLink(match[1]);
      return;
    }

    this.attachStampEvents();
    this.attachVerifyEvents();
    this.attachTabEvents();
  }

  //
  // ─── TABS ──────────────────────────────────────────────────
  //
  attachTabEvents() {
    let self = this;
    document.querySelectorAll('.witness-tab').forEach((tab) => {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.witness-tab').forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.witness-tab-content').forEach((c) => c.classList.remove('active'));
        this.classList.add('active');
        let target = this.getAttribute('data-tab');
        let el = document.getElementById('witness-tab-' + target);
        if (el) { el.classList.add('active'); }
      });
    });
  }

  //
  // ─── STAMP TAB ────────────────────────────────────────────
  //
  attachStampEvents() {
    let self = this;
    let dropZone = document.getElementById('witness-drop-zone');
    let fileInput = document.getElementById('witness-file-input');

    if (!dropZone || !fileInput) { return; }

    // Click to browse
    dropZone.addEventListener('click', () => fileInput.click());

    // Drag & drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('witness-drop-active');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('witness-drop-active');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('witness-drop-active');
      if (e.dataTransfer.files.length > 0) {
        self.processFileForStamp(e.dataTransfer.files[0]);
      }
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        self.processFileForStamp(e.target.files[0]);
      }
    });

    // Stamp another
    let stampAnother = document.getElementById('witness-stamp-another');
    if (stampAnother) {
      stampAnother.addEventListener('click', () => {
        document.getElementById('witness-drop-zone').style.display = '';
        document.getElementById('witness-receipt').style.display = 'none';
        document.getElementById('witness-status').style.display = 'none';
        fileInput.value = '';
      });
    }
  }

  async processFileForStamp(file) {
    let self = this;
    let dropZone = document.getElementById('witness-drop-zone');
    let statusEl = document.getElementById('witness-status');

    // Hide drop zone, show status
    dropZone.style.display = 'none';
    statusEl.style.display = 'flex';

    // Step 1: Hash the file
    this.showStatus('stamp', 'hashing', `Hashing <strong>${this.escapeHTML(file.name)}</strong> locally...`);

    let fileHash;
    try {
      fileHash = await this.hashFile(file);
    } catch (err) {
      this.showStatus('stamp', 'error', 'Error hashing file: ' + err.message);
      return;
    }

    // Step 2: Create and broadcast transaction
    this.showStatus('stamp', 'broadcasting', 'Anchoring hash on-chain...');

    try {
      let tx = await self.mod.createWitnessTransaction(fileHash, file.name, file.size);

      // Step 3: Show receipt immediately (tx is signed and propagated)
      self.showReceipt(file.name, fileHash, tx.signature);
    } catch (err) {
      this.showStatus('stamp', 'error', 'Error creating transaction: ' + err.message);
    }
  }

  showReceipt(fileName, fileHash, txSig) {
    let statusEl = document.getElementById('witness-status');
    let receiptEl = document.getElementById('witness-receipt');

    statusEl.style.display = 'none';
    receiptEl.style.display = 'block';

    document.getElementById('receipt-filename').textContent = fileName;
    document.getElementById('receipt-hash').textContent = fileHash;
    document.getElementById('receipt-sig').textContent = txSig.substring(0, 16) + '...' + txSig.substring(txSig.length - 16);
    document.getElementById('receipt-sig').setAttribute('title', txSig);
    document.getElementById('receipt-time').textContent = new Date().toLocaleString();

    // Copy link button
    let copyBtn = document.getElementById('witness-copy-link');
    if (copyBtn) {
      copyBtn.onclick = () => {
        let url = window.location.origin + '/witness/#verify=' + txSig;
        navigator.clipboard.writeText(url).then(() => {
          copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fa-solid fa-link"></i> Copy Proof Link';
          }, 2000);
        });
      };
    }
  }

  //
  // ─── VERIFY TAB ───────────────────────────────────────────
  //
  attachVerifyEvents() {
    let self = this;
    let dropZone = document.getElementById('witness-verify-drop-zone');
    let fileInput = document.getElementById('witness-verify-file-input');
    let sigInput = document.getElementById('witness-sig-input');
    let sigBtn = document.getElementById('witness-sig-lookup-btn');

    if (!dropZone || !fileInput) { return; }

    // Click to browse
    dropZone.addEventListener('click', () => fileInput.click());

    // Drag & drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('witness-drop-active');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('witness-drop-active');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('witness-drop-active');
      if (e.dataTransfer.files.length > 0) {
        self.processFileForVerify(e.dataTransfer.files[0]);
      }
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        self.processFileForVerify(e.target.files[0]);
      }
    });

    // Signature lookup
    if (sigBtn) {
      sigBtn.addEventListener('click', () => {
        let sig = sigInput.value.trim();
        if (sig) { self.lookupBySig(sig); }
      });
    }
    if (sigInput) {
      sigInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          let sig = sigInput.value.trim();
          if (sig) { self.lookupBySig(sig); }
        }
      });
    }
  }

  async processFileForVerify(file) {
    this.showStatus('verify', 'hashing', `Hashing <strong>${this.escapeHTML(file.name)}</strong>...`);

    let fileHash;
    try {
      fileHash = await this.hashFile(file);
    } catch (err) {
      this.showStatus('verify', 'error', 'Error hashing file: ' + err.message);
      return;
    }

    this.showStatus('verify', 'broadcasting', 'Searching for on-chain records...');

    // Query server for this hash
    this.mod.sendPeerRequestWithServiceFilter(
      'witness',
      {
        request: 'witness verify hash',
        data: { file_hash: fileHash }
      },
      (res) => {
        this.displayVerifyResults(res, fileHash, file.name);
      }
    );
  }

  async lookupBySig(sig) {
    this.showStatus('verify', 'broadcasting', 'Looking up transaction...');

    this.mod.sendPeerRequestWithServiceFilter(
      'witness',
      {
        request: 'witness verify sig',
        data: { tx_sig: sig }
      },
      (res) => {
        this.displayVerifyResults(res, null, null);
      }
    );
  }

  displayVerifyResults(res, searchHash = null, fileName = null) {
    let statusEl = document.getElementById('witness-verify-status');
    let resultsEl = document.getElementById('witness-verify-results');

    statusEl.style.display = 'none';
    resultsEl.style.display = 'block';

    if (res.err || !res.rows || res.rows.length === 0) {
      resultsEl.innerHTML = `
        <div class="witness-verify-not-found">
          <i class="fa-solid fa-circle-xmark"></i>
          <h3>No Records Found</h3>
          <p>${searchHash
            ? 'This file has not been witnessed on the Saito blockchain.'
            : 'No proof found for this transaction signature.'
          }</p>
        </div>`;
      return;
    }

    let html = `<div class="witness-verify-found">
      <i class="fa-solid fa-circle-check"></i>
      <h3>Proof${res.rows.length > 1 ? 's' : ''} Found</h3>`;

    for (let row of res.rows) {
      let date = new Date(row.created_at).toLocaleString();
      html += `
        <div class="witness-proof-card">
          <div class="witness-receipt-row">
            <span class="witness-label">File</span>
            <span class="witness-value">${this.escapeHTML(row.file_name || 'Unknown')}</span>
          </div>
          <div class="witness-receipt-row">
            <span class="witness-label">SHA-256</span>
            <span class="witness-value witness-mono">${this.escapeHTML(row.file_hash)}</span>
          </div>
          <div class="witness-receipt-row">
            <span class="witness-label">Transaction</span>
            <span class="witness-value witness-mono">${this.escapeHTML(row.tx_sig)}</span>
          </div>
          <div class="witness-receipt-row">
            <span class="witness-label">Signer</span>
            <span class="witness-value witness-mono">${this.escapeHTML(row.sender)}</span>
          </div>
          <div class="witness-receipt-row">
            <span class="witness-label">Block</span>
            <span class="witness-value">#${row.block_id}</span>
          </div>
          <div class="witness-receipt-row">
            <span class="witness-label">Time</span>
            <span class="witness-value">${date}</span>
          </div>
          ${searchHash ? `
          <div class="witness-match-badge witness-match-yes">
            <i class="fa-solid fa-check"></i> Hash matches your file
          </div>` : ''}
        </div>`;
    }
    html += '</div>';
    resultsEl.innerHTML = html;
  }

  //
  // ─── VERIFY LINK MODE ─────────────────────────────────────
  //
  async handleVerifyLink(txSig) {
    let self = this;

    this.mod.sendPeerRequestWithServiceFilter(
      'witness',
      {
        request: 'witness verify sig',
        data: { tx_sig: txSig }
      },
      (res) => {
        let resultEl = document.getElementById('witness-verify-result');
        let reverifyZone = document.getElementById('witness-reverify-zone');

        if (res.err || !res.rows || res.rows.length === 0) {
          resultEl.innerHTML = `
            <div class="witness-verify-not-found">
              <i class="fa-solid fa-circle-xmark"></i>
              <h3>No Proof Found</h3>
              <p>No record found for this transaction signature.</p>
            </div>`;
          return;
        }

        let row = res.rows[0];
        let date = new Date(row.created_at).toLocaleString();

        resultEl.innerHTML = `
          <div class="witness-verify-found">
            <i class="fa-solid fa-circle-check"></i>
            <h3>Proof Verified</h3>
            <div class="witness-proof-card">
              <div class="witness-receipt-row">
                <span class="witness-label">File</span>
                <span class="witness-value">${self.escapeHTML(row.file_name || 'Unknown')}</span>
              </div>
              <div class="witness-receipt-row">
                <span class="witness-label">SHA-256</span>
                <span class="witness-value witness-mono">${self.escapeHTML(row.file_hash)}</span>
              </div>
              <div class="witness-receipt-row">
                <span class="witness-label">Transaction</span>
                <span class="witness-value witness-mono">${self.escapeHTML(row.tx_sig)}</span>
              </div>
              <div class="witness-receipt-row">
                <span class="witness-label">Signer</span>
                <span class="witness-value witness-mono">${self.escapeHTML(row.sender)}</span>
              </div>
              <div class="witness-receipt-row">
                <span class="witness-label">Block</span>
                <span class="witness-value">#${row.block_id}</span>
              </div>
              <div class="witness-receipt-row">
                <span class="witness-label">Time</span>
                <span class="witness-value">${date}</span>
              </div>
            </div>
          </div>`;

        // Show re-verify drop zone
        reverifyZone.style.display = 'flex';
        self.attachReverifyEvents(row.file_hash);
      }
    );
  }

  attachReverifyEvents(expectedHash) {
    let self = this;
    let dropZone = document.getElementById('witness-reverify-zone');
    let fileInput = document.getElementById('witness-reverify-input');
    let resultEl = document.getElementById('witness-reverify-result');

    if (!dropZone || !fileInput) { return; }

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('witness-drop-active');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('witness-drop-active');
    });
    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('witness-drop-active');
      if (e.dataTransfer.files.length > 0) {
        await self.reverifyFile(e.dataTransfer.files[0], expectedHash);
      }
    });

    fileInput.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        await self.reverifyFile(e.target.files[0], expectedHash);
      }
    });
  }

  async reverifyFile(file, expectedHash) {
    let resultEl = document.getElementById('witness-reverify-result');
    resultEl.style.display = 'block';

    let fileHash;
    try {
      fileHash = await this.hashFile(file);
    } catch (err) {
      resultEl.innerHTML = `<div class="witness-match-badge witness-match-no">
        <i class="fa-solid fa-xmark"></i> Error hashing file
      </div>`;
      return;
    }

    if (fileHash === expectedHash) {
      resultEl.innerHTML = `<div class="witness-match-badge witness-match-yes">
        <i class="fa-solid fa-check"></i> Match confirmed — this file matches the on-chain proof
      </div>`;
    } else {
      resultEl.innerHTML = `<div class="witness-match-badge witness-match-no">
        <i class="fa-solid fa-xmark"></i> No match — this file does not match the on-chain proof
      </div>`;
    }
  }

  //
  // ─── UTILITIES ─────────────────────────────────────────────
  //
  async hashFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target.result;
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          resolve(hashHex);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  showStatus(tab, type, message) {
    let statusEl = tab === 'verify'
      ? document.getElementById('witness-verify-status')
      : document.getElementById('witness-status');
    if (!statusEl) { return; }

    statusEl.style.display = 'flex';

    let iconHtml = '';
    if (type === 'hashing') {
      iconHtml = '<img class="spinner" src="/saito/img/spinner.svg" alt="...">';
    } else if (type === 'broadcasting') {
      iconHtml = '<img class="spinner" src="/saito/img/spinner.svg" alt="...">';
    } else if (type === 'error') {
      iconHtml = '<i class="fa-solid fa-circle-exclamation witness-error-icon"></i>';
    }

    statusEl.querySelector('.witness-status-icon').innerHTML = iconHtml;
    statusEl.querySelector('.witness-status-text').innerHTML = message;
  }

  escapeHTML(str) {
    if (!str) { return ''; }
    let div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
}

module.exports = WitnessMain;

