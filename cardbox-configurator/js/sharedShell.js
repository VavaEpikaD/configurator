import { mountStandaloneConfiguratorShell } from '../../shared-ui/src/standaloneShell.js?v=40';
import { SharedUndoManager } from '../../shared-ui/src/history/undoManager.js?v=1';
import { resolveSharedTools } from '../../shared-ui/src/tools/registry.js?v=3';
import { createShareUrl } from '../../shared-ui/src/shareState.js?v=5';
import { requireTenantConfiguratorAccess } from '../../shared-ui/src/tenantBootstrap.js?v=3';

const tenantContext = await requireTenantConfiguratorAccess('cardbox');
const mobileLayoutQuery = window.matchMedia('(max-width: 760px)');

const history = new SharedUndoManager({
  capture: () => window.CARDBOX_CONFIGURATOR_API?.captureState?.(),
  restore: (snapshot) => window.CARDBOX_CONFIGURATOR_API?.restoreState?.(snapshot),
});

const TOOL_LABELS = Object.freeze({
  'en-US': Object.freeze({
    closures: 'Open or close the upper and lower closures',
    lift: 'Lift or lower the box',
    transparent: 'Toggle transparent box view',
    fold: 'Play fold animation',
    artwork: 'Show or hide artwork',
  }),
  'ro-RO': Object.freeze({
    closures: 'Deschide sau închide închiderea superioară și inferioară',
    lift: 'Ridică sau coboară cutia',
    transparent: 'Activează/dezactivează vederea transparentă',
    fold: 'Redă animația de pliere',
    artwork: 'Afișează sau ascunde grafica',
  }),
  'de-DE': Object.freeze({
    closures: 'Obere und untere Verschlüsse öffnen oder schließen',
    lift: 'Box anheben oder absenken',
    transparent: 'Transparente Boxansicht ein-/ausblenden',
    fold: 'Faltanimation abspielen',
    artwork: 'Grafiken ein- oder ausblenden',
  }),
});

function initialToolLocale() {
  const host = window.location.hostname.toLowerCase();
  if (host.includes('360configurator.ro')) return 'ro-RO';
  if (host.includes('360konfigurator.de')) return 'de-DE';
  return 'en-US';
}

function toolLabels(locale = initialToolLocale()) {
  return TOOL_LABELS[locale] || TOOL_LABELS['en-US'];
}

const CUSTOM_TOOL_ICONS = Object.freeze({
  closures: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5 12 4l8 4.5v8L12 21l-8-4.5v-8Z"/><path d="m4 8.5 8 4.5 8-4.5M12 13v8"/><path d="m7 6.8 5 2.8 5-2.8"/></svg>`,
  lift: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11.5 12 8l7 3.5-7 3.5-7-3.5Z"/><path d="M5 11.5V17l7 3.5 7-3.5v-5.5M12 15v5.5"/><path d="M12 2v4M9.5 4.5 12 2l2.5 2.5"/></svg>`,
  transparent: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 7 7.5-4 7.5 4v10L12 21l-7.5-4V7Z"/><path d="m4.5 7 7.5 4 7.5-4M12 11v10"/><path d="M8 8.9v7.5M16 8.9v7.5" stroke-dasharray="2 2"/></svg>`,
  fold: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15V8l8-4 8 4v7l-8 5-8-5Z"/><path d="m4 8 8 4 8-4M12 12v8"/><path d="M6.5 4.5 12 8l5.5-3.5"/><path d="m18 17 2 1.5-2 1.5"/></svg>`,
  artwork: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4" width="17" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m5.5 17 4.5-4.5 3.2 3.2 2.2-2.2 3.1 3.5"/><path d="M12 2v20" stroke-dasharray="2 2"/></svg>`,
});

function customTool(id, action, label, icon, { active = false } = {}) {
  return { id, action, label, icon, active, configurable: true, config: {} };
}

const labels = toolLabels();
const toolItems = [
  ...resolveSharedTools([{ id: 'dimensions', active: true }, 'camera']),
  customTool('box-closures', 'toggle-box-closures', labels.closures, CUSTOM_TOOL_ICONS.closures),
  customTool('box-lift', 'toggle-box-lift', labels.lift, CUSTOM_TOOL_ICONS.lift),
  customTool('box-transparent', 'toggle-box-transparent', labels.transparent, CUSTOM_TOOL_ICONS.transparent),
  customTool('box-fold', 'play-box-fold-animation', labels.fold, CUSTOM_TOOL_ICONS.fold),
  customTool('box-artwork', 'toggle-box-artwork', labels.artwork, CUSTOM_TOOL_ICONS.artwork, { active: true }),
];
const CARD_BOX_TOOL_IDS = Object.freeze(toolItems.map((item) => item.id));

let shell;

function updateToolLabels(locale) {
  if (!shell) return;
  const next = toolLabels(locale);
  shell.setToolState('box-closures', { title: next.closures });
  shell.setToolState('box-lift', { title: next.lift });
  shell.setToolState('box-transparent', { title: next.transparent });
  shell.setToolState('box-fold', { title: next.fold });
  shell.setToolState('box-artwork', { title: next.artwork });
}

function syncCardboxToolState(detail = window.CARDBOX_CONFIGURATOR_API?.getToolState?.() || {}) {
  if (!shell) return;
  shell.setToolActive('box-closures', Boolean(detail.closurePanelOpen));
  shell.setToolActive('box-lift', Boolean(detail.boxLifted));
  shell.setToolActive('box-transparent', Boolean(detail.transparentMode));
  shell.setToolActive('box-fold', Boolean(detail.foldAnimationActive));
  shell.setToolActive('box-artwork', detail.artworkVisible !== false);
  CARD_BOX_TOOL_IDS.forEach((id) => shell.setToolDisabled(id, Boolean(detail.interactionLocked)));
  shell.setActionEnabled('toggle-tools', !detail.interactionLocked);
}

shell = mountStandaloneConfiguratorShell({
  productType: 'Cardbox',
  productId: 'cardbox',
  storagePrefix: '360-configurator:cardbox',
  brandSrc: tenantContext?.logoUrl || '../shared-ui/assets/360CONFIGURATOR.png',
  brandAlt: tenantContext?.companyName || '360 Configurator',
  capabilities: { viewAR: false, save: true, undo: true, reset: true, share: true },
  tools: { items: toolItems, placement: { side: 'left', direction: 'down', offsetX: 12, offsetY: 12 } },
  settingsPanel: {
    panelSelector: '.sidebar', toggleSelector: '#cardboxSidebarToggle', collapsedClass: 'is-collapsed',
    bodyCollapsedClass: 'cardbox-sidebar-collapsed', initiallyCollapsed: mobileLayoutQuery.matches,
  },
  configuratorPanel: { panelSelector: '.sidebar', priceSelector: '#summaryTotal', geometry: 'floating-right' },
  callbacks: {
    onUndo() { history.undo(); },
    async resetConfiguration() { return (await window.CARDBOX_CONFIGURATOR_API?.resetConfiguration?.()) !== false; },
    captureState() { return window.CARDBOX_CONFIGURATOR_API?.captureState?.(); },
    restoreState(snapshot) { return window.CARDBOX_CONFIGURATOR_API?.restoreState?.(snapshot) !== false; },
    getShareUrl() {
      const snapshot = window.CARDBOX_CONFIGURATOR_API?.captureState?.();
      return snapshot ? createShareUrl({ productType: 'cardbox', state: snapshot }) : window.location.href;
    },
    onPreferenceChange(path, value, preferences) {
      if (path === 'darkMode') window.CARDBOX_CONFIGURATOR_API?.setDarkMode?.(Boolean(value));
      if (path === 'locale') {
        window.CARDBOX_CONFIGURATOR_API?.setLocale?.(preferences.locale);
        updateToolLabels(preferences.locale);
      }
      if (path === 'units') window.CARDBOX_CONFIGURATOR_API?.setUnits?.(preferences.units);
      if (path === 'currency') window.CARDBOX_CONFIGURATOR_API?.setCurrency?.(preferences.currency);
    },
    onToolsOpenChange(open) {
      if (mobileLayoutQuery.matches && open) shell?.setSettingsPanelCollapsed?.(true);
      if (!open) window.CARDBOX_CONFIGURATOR_API?.closeToolPanels?.();
    },
    onSettingsPanelToggle(collapsed) {
      syncSidebarAccessibility(collapsed);
      if (mobileLayoutQuery.matches && !collapsed && shell?.toolsOpen) { shell.toolsOpen = false; shell.syncTools(); }
    },
  },
});

const sidebar = document.querySelector('.sidebar');
const appShell = document.querySelector('.app-shell');
history.bindSource(sidebar);

function syncSidebarAccessibility(collapsed = shell?.settingsPanelCollapsed) {
  if (!sidebar) return;
  const hidden = Boolean(collapsed); sidebar.inert = hidden; sidebar.setAttribute('aria-hidden', String(hidden));
}
function syncMobileLayout() {
  document.body.classList.toggle('cardbox-mobile-layout', mobileLayoutQuery.matches);
  shell?.setSettingsPanelCollapsed?.(mobileLayoutQuery.matches);
  syncSidebarAccessibility(shell?.settingsPanelCollapsed);
}
syncSidebarAccessibility(shell?.settingsPanelCollapsed);
document.body.classList.toggle('cardbox-mobile-layout', mobileLayoutQuery.matches);
mobileLayoutQuery.addEventListener?.('change', syncMobileLayout);

appShell?.addEventListener('pointerdown', (event) => {
  if (!mobileLayoutQuery.matches || shell?.settingsPanelCollapsed) return;
  if (event.target.closest('.sidebar, #cardboxSidebarToggle')) return;
  shell.setSettingsPanelCollapsed(true);
}, true);

if (sidebar) {
  const markDirty = (event) => {
    if (event.target.closest('[data-shared-configurator-panel-footer]')) return;
    if (event.target.closest('button, input, select, textarea, label, svg')) shell.markDirty();
  };
  sidebar.addEventListener('click', markDirty, true); sidebar.addEventListener('input', markDirty, true); sidebar.addEventListener('change', markDirty, true);
}

shell.host?.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  const api = window.CARDBOX_CONFIGURATOR_API;
  if (!action || !api) return;

  if (action !== 'toggle-box-closures') api.closeToolPanels?.();

  if (action === 'toggle-dimensions') shell.setToolActive('dimensions', Boolean(api.toggleDimensions?.()));
  else if (action === 'cycle-camera') api.cycleCamera?.();
  else if (action === 'toggle-box-closures') api.toggleClosureToolPanel?.();
  else if (action === 'toggle-box-lift') api.toggleBoxLift?.();
  else if (action === 'toggle-box-transparent') api.toggleTransparentMode?.();
  else if (action === 'play-box-fold-animation') void api.playFoldAnimation?.();
  else if (action === 'toggle-box-artwork') api.toggleArtworkVisibility?.();
  else return;

  syncCardboxToolState();
  if (mobileLayoutQuery.matches && shell?.toolsOpen) { shell.toolsOpen = false; shell.syncTools(); }
});

window.addEventListener('cardbox:tool-state', (event) => syncCardboxToolState(event.detail || {}));

window.CARDBOX_CONFIGURATOR_SHARED_SHELL = shell;
window.CARDBOX_CONFIGURATOR_UNDO_HISTORY = history;
window.CARDBOX_CONFIGURATOR_API?.setDarkMode?.(Boolean(shell.state.darkMode));
window.CARDBOX_CONFIGURATOR_API?.setLocale?.(shell.state.locale);
window.CARDBOX_CONFIGURATOR_API?.setUnits?.(shell.state.units);
window.CARDBOX_CONFIGURATOR_API?.setCurrency?.(shell.state.currency);
updateToolLabels(shell.state.locale);
syncCardboxToolState();
