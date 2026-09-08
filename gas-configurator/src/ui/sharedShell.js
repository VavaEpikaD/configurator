import { mountStandaloneConfiguratorShell } from '../../../shared-ui/src/standaloneShell.js';
import brandSrc from '../../../shared-ui/assets/360CONFIGURATOR.png?url';

export function mountGasSharedShell({ store, onSettingsPanelToggle } = {}) {
  const compactViewport = window.matchMedia('(max-width: 760px)');
  const sidebar = document.querySelector('#gasSidebar');

  const shell = mountStandaloneConfiguratorShell({
    productType: 'Gas',
    productId: 'gas',
    storagePrefix: '360-configurator:gas-prototype',
    brandSrc,
    brandAlt: '360 Configurator',
    capabilities: {
      viewAR: false,
      save: false,
      undo: true,
      reset: true,
      share: false,
      profile: false,
    },
    tools: { items: [], placement: {} },
    settingsPanel: {
      panelSelector: '#gasSidebar',
      toggleSelector: '#gasSidebarToggle',
      collapsedClass: 'is-collapsed',
      bodyCollapsedClass: 'gas-sidebar-collapsed',
      initiallyCollapsed: compactViewport.matches,
    },
    callbacks: {
      onUndo() {
        store.undo();
      },
      resetConfiguration() {
        store.reset();
        return true;
      },
      captureState() {
        return store.captureState();
      },
      restoreState(snapshot) {
        return store.restoreState(snapshot);
      },
      onPreferenceChange(path, value) {
        if (!['locale', 'units', 'currency', 'darkMode'].includes(path)) return;
        store.update(`preferences.${path}`, value, { recordHistory: false, source: `preference-${path}` });
      },
      onSettingsPanelToggle(collapsed) {
        if (sidebar) sidebar.inert = Boolean(compactViewport.matches && collapsed);
        onSettingsPanelToggle?.(collapsed);
      },
    },
  });

  const shellPreferences = shell.state;
  const next = store.captureState();
  next.preferences = {
    ...next.preferences,
    locale: shellPreferences.locale,
    units: shellPreferences.units,
    currency: shellPreferences.currency,
    darkMode: shellPreferences.darkMode,
  };
  store.commit(next, { recordHistory: false, source: 'shared-shell-preferences' });
  if (sidebar) sidebar.inert = Boolean(compactViewport.matches && shell.settingsPanelCollapsed);

  const onViewportChange = (event) => {
    shell.setSettingsPanelCollapsed?.(Boolean(event.matches));
    if (sidebar) sidebar.inert = Boolean(event.matches && shell.settingsPanelCollapsed);
    onSettingsPanelToggle?.(shell.settingsPanelCollapsed);
  };
  compactViewport.addEventListener?.('change', onViewportChange);

  return {
    shell,
    destroy() {
      compactViewport.removeEventListener?.('change', onViewportChange);
      shell.destroy();
    },
  };
}
