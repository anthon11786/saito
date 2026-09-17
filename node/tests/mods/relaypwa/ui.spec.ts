import { renderOnboardingScreen, escapeHtml } from '../../../mods/relaypwa/lib/ui/onboarding-screen';
import { renderShell } from '../../../mods/relaypwa/lib/ui/shell';
import { renderWalletTab } from '../../../mods/relaypwa/lib/ui/wallet-tab';
import { renderChatTab } from '../../../mods/relaypwa/lib/ui/chat-tab';
import { renderCallsTab } from '../../../mods/relaypwa/lib/ui/calls-tab';

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
    const html = renderWalletTab({ publicKey: 'myPubKey', balanceDisplay: '12.5' });
    expect(html).toContain('myPubKey');
    expect(html).toContain('12.5');
    expect(html).toContain('SAITO');
  });

  it('does not render a send form yet', () => {
    const html = renderWalletTab({ publicKey: 'myPubKey', balanceDisplay: '0' });
    expect(html).not.toContain('id="relaypwa-send');
  });
});

describe('renderChatTab', () => {
  it('shows an empty state and no send form when there are no contacts', () => {
    const html = renderChatTab([]);
    expect(html).toContain('Add a contact to start chatting');
    expect(html).not.toContain('id="relaypwa-send-message-form"');
  });

  it('lists contacts and includes a send form once there is at least one', () => {
    const html = renderChatTab([
      { publicKey: 'pk1', identifier: 'Alice' },
      { publicKey: 'pk2', identifier: 'Bob' }
    ]);
    expect(html).toContain('data-pubkey="pk1"');
    expect(html).toContain('Alice');
    expect(html).toContain('data-pubkey="pk2"');
    expect(html).toContain('Bob');
    expect(html).toContain('id="relaypwa-send-message-form"');
  });

  it('escapes a hostile nickname', () => {
    const html = renderChatTab([{ publicKey: 'pk1', identifier: '<script>alert(1)</script>' }]);
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('renderCallsTab', () => {
  it('renders a coming-soon placeholder', () => {
    expect(renderCallsTab()).toContain('coming soon');
  });
});
