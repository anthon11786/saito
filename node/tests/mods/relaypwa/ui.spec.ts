import { renderOnboardingScreen, escapeHtml } from '../../../mods/relaypwa/lib/ui/onboarding-screen';
import { renderShell } from '../../../mods/relaypwa/lib/ui/shell';
import { renderWalletTab, renderSendForm } from '../../../mods/relaypwa/lib/ui/wallet-tab';
import { renderSendConfirm } from '../../../mods/relaypwa/lib/ui/send-confirm';
import { renderChatTab } from '../../../mods/relaypwa/lib/ui/chat-tab';
import { renderCallsTab } from '../../../mods/relaypwa/lib/ui/calls-tab';
import { renderConversation } from '../../../mods/relaypwa/lib/ui/conversation';
import { renderTransactionHistory } from '../../../mods/relaypwa/lib/ui/history';

describe('escapeHtml', () => {
  it('escapes all five HTML-significant characters', () => {
    expect(escapeHtml(`<script>alert('x')&"y"</script>`)).toBe(
      '&lt;script&gt;alert(&#39;x&#39;)&amp;&quot;y&quot;&lt;/script&gt;'
    );
  });
});

describe('renderOnboardingScreen', () => {
  it('includes the given public key', () => {
    const html = renderOnboardingScreen('somePublicKey123');
    expect(html).toContain('somePublicKey123');
  });

  it('escapes a hostile public key rather than injecting it raw', () => {
    const html = renderOnboardingScreen('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('renderShell', () => {
  it('marks the active tab and includes all three tabs', () => {
    const html = renderShell('wallet');
    expect(html).toContain('data-tab="chat"');
    expect(html).toContain('data-tab="wallet"');
    expect(html).toContain('data-tab="calls"');
    expect(html).toMatch(/relaypwa-tab-active[^>]*>Wallet|Wallet[^<]*<\/button>/);
    // the wallet button specifically carries the active class
    const walletButtonMatch = html.match(/<button[^>]*data-tab="wallet"[^>]*>/)?.[0] ?? '';
    expect(walletButtonMatch).toContain('relaypwa-tab-active');
    const chatButtonMatch = html.match(/<button[^>]*data-tab="chat"[^>]*>/)?.[0] ?? '';
    expect(chatButtonMatch).not.toContain('relaypwa-tab-active');
  });
});

describe('renderWalletTab', () => {
  it('shows the balance and public key', () => {
    const html = renderWalletTab({ publicKey: 'myPubKey', balanceDisplay: '12.5', historyHtml: '' });
    expect(html).toContain('myPubKey');
    expect(html).toContain('12.5');
    expect(html).toContain('SAITO');
  });

  it('includes a send button', () => {
    const html = renderWalletTab({ publicKey: 'myPubKey', balanceDisplay: '0', historyHtml: '' });
    expect(html).toContain('id="relaypwa-send-open"');
  });

  it('embeds the pre-rendered history HTML', () => {
    const html = renderWalletTab({
      publicKey: 'myPubKey',
      balanceDisplay: '0',
      historyHtml: '<div class="marker-from-history">hi</div>'
    });
    expect(html).toContain('marker-from-history');
  });
});

describe('renderSendForm', () => {
  it('includes recipient and amount inputs', () => {
    const html = renderSendForm();
    expect(html).toContain('id="relaypwa-send-recipient"');
    expect(html).toContain('id="relaypwa-send-amount"');
  });
});

describe('renderSendConfirm', () => {
  const basePreview = {
    inputs: [{ utxokey: 'k1', amount: 1000n }],
    changeAmount: 300n,
    recipientPublicKey: 'recipient-key',
    amount: 700n,
    fee: 0n
  };

  it('shows the plan with no dust warning when clean', () => {
    const html = renderSendConfirm({
      preview: { ...basePreview, dustWarning: false },
      amountDisplay: '7',
      feeDisplay: '0',
      changeDisplay: '3'
    });
    expect(html).toContain('recipient-key');
    expect(html).toContain('7 SAITO');
    expect(html).toContain('Confirm and send');
    expect(html).not.toContain('relaypwa-dust-warning');
  });

  it('surfaces the dust warning and changes the button label when dusty', () => {
    const html = renderSendConfirm({
      preview: { ...basePreview, dustWarning: true },
      amountDisplay: '9.98',
      feeDisplay: '0',
      changeDisplay: '0.02'
    });
    expect(html).toContain('relaypwa-dust-warning');
    expect(html).toContain('Send anyway');
    expect(html).not.toContain('Confirm and send');
  });

  it('escapes a hostile recipient key', () => {
    const html = renderSendConfirm({
      preview: { ...basePreview, recipientPublicKey: '<script>alert(1)</script>', dustWarning: false },
      amountDisplay: '1',
      feeDisplay: '0',
      changeDisplay: '0'
    });
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('renderChatTab', () => {
  it('shows an empty state when there are no contacts', () => {
    const html = renderChatTab([]);
    expect(html).toContain('Add a contact to start chatting');
    expect(html).not.toContain('class="relaypwa-contact-list"');
  });

  it('lists contacts, each clickable by public key', () => {
    const html = renderChatTab([
      { publicKey: 'pk1', identifier: 'Alice' },
      { publicKey: 'pk2', identifier: 'Bob' }
    ]);
    expect(html).toContain('data-pubkey="pk1"');
    expect(html).toContain('Alice');
    expect(html).toContain('data-pubkey="pk2"');
    expect(html).toContain('Bob');
  });

  it('escapes a hostile nickname', () => {
    const html = renderChatTab([{ publicKey: 'pk1', identifier: '<script>alert(1)</script>' }]);
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('renderConversation', () => {
  const contact = { publicKey: 'alice-pubkey', identifier: 'Alice' };

  it('shows an empty state with no messages', () => {
    const html = renderConversation(contact, [], 'me-pubkey');
    expect(html).toContain('No messages yet');
  });

  it('aligns a message as mine when my public key is in its from array', () => {
    const html = renderConversation(
      contact,
      [{ signature: 'sig1', timestamp: 100, from: ['me-pubkey'], msg: 'hi', mentioned: [] }],
      'me-pubkey'
    );
    expect(html).toMatch(/relaypwa-message-mine[^>]*>[\s\S]*hi/);
    expect(html).not.toContain('relaypwa-message-theirs');
  });

  it('aligns a message as theirs when my public key is absent from its from array', () => {
    const html = renderConversation(
      contact,
      [{ signature: 'sig1', timestamp: 100, from: ['alice-pubkey'], msg: 'hey there', mentioned: [] }],
      'me-pubkey'
    );
    expect(html).toMatch(/relaypwa-message-theirs[^>]*>[\s\S]*hey there/);
    expect(html).not.toContain('relaypwa-message-mine');
  });

  it('escapes hostile message content', () => {
    const html = renderConversation(
      contact,
      [{ signature: 'sig1', timestamp: 100, from: ['alice-pubkey'], msg: '<script>alert(1)</script>', mentioned: [] }],
      'me-pubkey'
    );
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('renderCallsTab', () => {
  it('renders a coming-soon placeholder', () => {
    expect(renderCallsTab()).toContain('coming soon');
  });
});

describe('renderTransactionHistory', () => {
  it('shows an empty state when there are no transactions', () => {
    const html = renderTransactionHistory([]);
    expect(html).toContain('No transactions yet');
  });

  it('shows a minus-prefixed amount for a sent transaction', () => {
    const html = renderTransactionHistory([
      { signature: 'sig1', direction: 'sent', counterparty: 'bob-pubkey', amountDisplay: '5', confirmed: true }
    ]);
    expect(html).toMatch(/-5/);
    expect(html).toContain('bob-pubkey');
  });

  it('shows a plus-prefixed amount for a received transaction', () => {
    const html = renderTransactionHistory([
      { signature: 'sig1', direction: 'received', counterparty: 'bob-pubkey', amountDisplay: '5', confirmed: true }
    ]);
    expect(html).toMatch(/\+5/);
  });

  it('shows a pending badge for an unconfirmed transaction', () => {
    const html = renderTransactionHistory([
      { signature: 'sig1', direction: 'sent', counterparty: 'bob-pubkey', amountDisplay: '5', confirmed: false }
    ]);
    expect(html).toContain('relaypwa-history-pending');
    expect(html).toContain('Pending');
  });

  it('does not show a pending badge for a confirmed transaction', () => {
    const html = renderTransactionHistory([
      { signature: 'sig1', direction: 'sent', counterparty: 'bob-pubkey', amountDisplay: '5', confirmed: true }
    ]);
    expect(html).not.toContain('relaypwa-history-pending');
  });

  it('truncates a long counterparty key', () => {
    const longKey = 'a'.repeat(44);
    const html = renderTransactionHistory([
      { signature: 'sig1', direction: 'sent', counterparty: longKey, amountDisplay: '5', confirmed: true }
    ]);
    expect(html).not.toContain(longKey);
    expect(html).toContain('…');
  });

  it('escapes a hostile counterparty key', () => {
    const html = renderTransactionHistory([
      {
        signature: 'sig1',
        direction: 'sent',
        counterparty: '<script>alert(1)</script>',
        amountDisplay: '5',
        confirmed: true
      }
    ]);
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
