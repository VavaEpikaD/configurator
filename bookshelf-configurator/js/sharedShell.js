import { mountStandaloneConfiguratorShell } from '../../shared-ui/src/standaloneShell.js?v=41';
import { SharedUndoManager } from '../../shared-ui/src/history/undoManager.js?v=1';
import { resolveSharedTools } from '../../shared-ui/src/tools/registry.js?v=3';
import { createShareUrl } from '../../shared-ui/src/shareState.js?v=5';
import { resolveTenantContext } from '../../shared-ui/src/tenantBootstrap.js?v=3';

const resolvedTenantContext = await resolveTenantContext();
const tenantContext = resolvedTenantContext?.isTenant && resolvedTenantContext?.exists && resolvedTenantContext?.status === 'active'
  ? resolvedTenantContext
  : null;
const mobileLayoutQuery = window.matchMedia('(max-width: 760px)');

const history = new SharedUndoManager({
  capture: () => window.BOOKSHELF_CONFIGURATOR_API?.captureState?.(),
  restore: (snapshot) => window.BOOKSHELF_CONFIGURATOR_API?.restoreState?.(snapshot),
});

const toolItems = resolveSharedTools([
  { id: 'dimensions', active: true },
  'camera',
]);

let shell;
shell = mountStandaloneConfiguratorShell({
  productType: 'Bookshelf',
  productId: 'bookshelf',
  storagePrefix: '360-configurator:bookshelf',
  brandSrc: tenantContext?.logoUrl || '../shared-ui/assets/360CONFIGURATOR.png',
  brandAlt: tenantContext?.companyName || '360 Configurator',
  capabilities: { viewAR: false, save: true, undo: true, reset: true, share: true },
  tools: { items: toolItems, placement: { side: 'left', direction: 'down', offsetX: 12, offsetY: 12 } },
  settingsPanel: {
    panelSelector: '.sidebar',
    toggleSelector: '#bookshelfSidebarToggle',
    collapsedClass: 'is-collapsed',
    bodyCollapsedClass: 'bookshelf-sidebar-collapsed',
    initiallyCollapsed: mobileLayoutQuery.matches,
  },
  callbacks: {
    onUndo() { history.undo(); },
    async resetConfiguration() { return (await window.BOOKSHELF_CONFIGURATOR_API?.resetConfiguration?.()) !== false; },
    captureState() { return window.BOOKSHELF_CONFIGURATOR_API?.captureState?.(); },
    restoreState(snapshot) { return window.BOOKSHELF_CONFIGURATOR_API?.restoreState?.(snapshot) !== false; },
    getShareUrl() {
      const snapshot = window.BOOKSHELF_CONFIGURATOR_API?.captureState?.();
      return snapshot ? createShareUrl({ productType: 'bookshelf', state: snapshot }) : window.location.href;
    },
    onPreferenceChange(path, value, preferences) {
      if (path === 'darkMode') window.BOOKSHELF_CONFIGURATOR_API?.setDarkMode?.(Boolean(value));
      if (path === 'locale') window.BOOKSHELF_CONFIGURATOR_API?.setLocale?.(preferences.locale);
      if (path === 'units') window.BOOKSHELF_CONFIGURATOR_API?.setUnits?.(preferences.units);
      if (path === 'currency') window.BOOKSHELF_CONFIGURATOR_API?.setCurrency?.(preferences.currency);
    },
    onToolsOpenChange(open) {
      if (mobileLayoutQuery.matches && open) shell?.setSettingsPanelCollapsed?.(true);
    },
    onSettingsPanelToggle(collapsed) {
      syncSidebarAccessibility(collapsed);
      if (mobileLayoutQuery.matches && !collapsed && shell?.toolsOpen) {
        shell.toolsOpen = false;
        shell.syncTools();
      }
    },
  },
});

const sidebar = document.querySelector('.sidebar');
const appShell = document.querySelector('.app-shell');

function syncSidebarAccessibility(collapsed = shell?.settingsPanelCollapsed) {
  if (!sidebar) return;
  const hidden = Boolean(collapsed);
  sidebar.inert = hidden;
  sidebar.setAttribute('aria-hidden', String(hidden));
}
function syncMobileLayout() {
  document.body.classList.toggle('bookshelf-mobile-layout', mobileLayoutQuery.matches);
  shell?.setSettingsPanelCollapsed?.(mobileLayoutQuery.matches);
  syncSidebarAccessibility(shell?.settingsPanelCollapsed);
}

syncSidebarAccessibility(shell?.settingsPanelCollapsed);
document.body.classList.toggle('bookshelf-mobile-layout', mobileLayoutQuery.matches);
mobileLayoutQuery.addEventListener?.('change', syncMobileLayout);

appShell?.addEventListener('pointerdown', (event) => {
  if (!mobileLayoutQuery.matches || shell?.settingsPanelCollapsed) return;
  if (event.target.closest('.sidebar, #bookshelfSidebarToggle')) return;
  shell.setSettingsPanelCollapsed(true);
}, true);

shell.host?.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'toggle-dimensions') {
    const active = window.BOOKSHELF_CONFIGURATOR_API?.toggleDimensions?.();
    shell.setToolActive?.('dimensions', Boolean(active));
  } else if (action === 'cycle-camera') {
    window.BOOKSHELF_CONFIGURATOR_API?.cycleCamera?.();
  } else {
    return;
  }
  if (mobileLayoutQuery.matches && shell?.toolsOpen) {
    shell.toolsOpen = false;
    shell.syncTools();
  }
});

window.BOOKSHELF_CONFIGURATOR_SHARED_SHELL = shell;
window.BOOKSHELF_CONFIGURATOR_UNDO_HISTORY = history;
window.BOOKSHELF_CONFIGURATOR_API?.setDarkMode?.(Boolean(shell.state.darkMode));
window.BOOKSHELF_CONFIGURATOR_API?.setLocale?.(shell.state.locale);
window.BOOKSHELF_CONFIGURATOR_API?.setUnits?.(shell.state.units);
window.BOOKSHELF_CONFIGURATOR_API?.setCurrency?.(shell.state.currency);
