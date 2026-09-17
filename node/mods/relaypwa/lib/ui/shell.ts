export type RelayTab = 'chat' | 'wallet' | 'calls';

const TABS: { id: RelayTab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'calls', label: 'Calls' }
];

/**
 * The app shell: a tab bar and a content slot. Each tab's own content is
 * rendered separately and swapped into #relaypwa-tab-content -- this
 * function only owns the chrome around it, so wiring a new tab later
 * doesn't mean re-templating the whole shell.
 */
export function renderShell(activeTab: RelayTab): string {
  const tabButtons = TABS.map(
    (tab) =>
      `<button type="button" class="relaypwa-tab${tab.id === activeTab ? ' relaypwa-tab-active' : ''}" data-tab="${tab.id}">${tab.label}</button>`
  ).join('');

  return `
    <div class="relaypwa-shell">
      <nav class="relaypwa-tabbar">${tabButtons}</nav>
      <div class="relaypwa-tab-content" id="relaypwa-tab-content"></div>
    </div>
  `;
}
