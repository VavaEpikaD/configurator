import { mountStandaloneConfiguratorShell } from '../../shared-ui/src/standaloneShell.js?v=42';
import { resolveSharedTools } from '../../shared-ui/src/tools/registry.js?v=2';
import { createShareUrl } from '../../shared-ui/src/shareState.js?v=5';
import { applyRoofTranslations, roofT, resolveRoofLocale } from './i18n.js?v=1';
import { requireTenantConfiguratorAccess } from '../../shared-ui/src/tenantBootstrap.js?v=1';

const tenantContext = await requireTenantConfiguratorAccess('roof');


const initialLocale = resolveRoofLocale();
applyRoofTranslations(initialLocale);
const t = (key, variables = {}, locale = null) => roofT(locale ?? window.ROOF_CONFIGURATOR_SHARED_SHELL?.state?.locale ?? initialLocale, key, variables);

const icon = (body) => `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    ${body}
  </svg>
`;

const tools = [
  ...resolveSharedTools([
    {
      id: 'environment',
      icon: icon('<circle cx="12" cy="12" r="3.2"></circle><path d="M12 2.2v2.1M12 19.7v2.1M2.2 12h2.1M19.7 12h2.1M5.1 5.1l1.5 1.5M17.4 17.4l1.5 1.5M18.9 5.1l-1.5 1.5M6.6 17.4l-1.5 1.5"></path>'),
    },
    {
      id: 'dimensions',
      active: true,
      icon: icon('<path d="M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3"></path>'),
    },
    {
      id: 'compass',
      icon: icon('<circle cx="12" cy="12" r="8.5"></circle><path d="m15.4 8.6-2.1 4.7-4.7 2.1 2.1-4.7z"></path><path d="M12 1.7v2M12 20.3v2M1.7 12h2M20.3 12h2"></path>'),
    },
    {
      id: 'camera',
      icon: icon('<circle cx="12" cy="12" r="4.2"></circle><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"></path>'),
    },
  ]),
  {
    id: 'components',
    action: 'toggle-components',
    label: roofT(initialLocale, 'tools.components'),
    icon: icon('<path d="M4 7h11v4H7.5a3.5 3.5 0 0 0 0 7H11"></path><path d="M15 7v4M11 15v6M8.5 21h5"></path>'),
  },
];

const shell = mountStandaloneConfiguratorShell({
  productType: 'Roof',
  productId: 'roof',
  storagePrefix: '360-configurator:roof',
  brandSrc: tenantContext?.logoUrl || '../shared-ui/assets/360CONFIGURATOR.png',
  brandAlt: tenantContext?.companyName || '360 Configurator',
  capabilities: {
    viewAR: false,
    save: true,
    undo: false,
    reset: true,
    share: true,
  },
  tools: {
    items: tools,
    placement: {
      side: 'left',
      direction: 'down',
      offsetX: 0,
      offsetY: 0,
    },
  },
  configuratorPanel: {
    panelSelector: '.sidebar',
    priceSelector: '#headerEstimateTotal',
  },
  callbacks: {
    async resetConfiguration() {
      const api = window.ROOF_CONFIGURATOR_API;
      if (!api?.resetConfiguration) return false;
      return (await api.resetConfiguration()) !== false;
    },
    captureState() {
      return window.ROOF_CONFIGURATOR_API?.captureState?.();
    },
    restoreState(snapshot) {
      return window.ROOF_CONFIGURATOR_API?.restoreState?.(snapshot);
    },
    getShareUrl() {
      const snapshot = window.ROOF_CONFIGURATOR_API?.captureState?.();
      return snapshot
        ? createShareUrl({ productType: 'roof', state: snapshot })
        : window.location.href;
    },
    onPreferenceChange(name, value, preferences) {
      const snapshot = { ...preferences };
      window.ROOF_SHELL_PREFERENCES = snapshot;
      if (name === 'locale') applyRoofTranslations(snapshot.locale);
      window.dispatchEvent(new CustomEvent('roof-preference-change', {
        detail: { name, value, preferences: snapshot },
      }));
    },
  },
});

window.ROOF_SHELL_PREFERENCES = { ...shell.state };
window.dispatchEvent(new CustomEvent('roof-preference-change', {
  detail: { name: 'initial', value: null, preferences: { ...shell.state } },
}));


const sidebar = document.querySelector('.sidebar');
const sidebarToggle = document.querySelector('#roofSidebarToggle');

function setSidebarCollapsed(collapsed) {
  sidebar?.classList.toggle('is-collapsed', collapsed);
  document.body.classList.toggle('roof-sidebar-collapsed', collapsed);
  sidebarToggle?.setAttribute('aria-expanded', String(!collapsed));
  const label = t(collapsed ? 'sidebar.show' : 'sidebar.hide');
  sidebarToggle?.setAttribute('aria-label', label);
  sidebarToggle?.setAttribute('title', label);
}

sidebarToggle?.addEventListener('click', () => {
  setSidebarCollapsed(!sidebar?.classList.contains('is-collapsed'));
});
setSidebarCollapsed(Boolean(sidebar?.classList.contains('is-collapsed')));
window.addEventListener('roof-locale-applied', () => {
  setSidebarCollapsed(Boolean(sidebar?.classList.contains('is-collapsed')));
  syncToolsState();
});

if (sidebar) {
  const markDirty = (event) => {
    if (event.target.closest('[data-shared-configurator-panel-footer]')) return;
    if (event.target.closest('button, input, select, textarea, label')) shell.markDirty();
  };
  sidebar.addEventListener('click', markDirty, true);
  sidebar.addEventListener('input', markDirty, true);
  sidebar.addEventListener('change', markDirty, true);
}

const toolsAnchor = document.querySelector('#roofToolsAnchor');
const viewerStage = document.querySelector('#viewerStage');
const environmentPanel = document.querySelector('#roofEnvironmentPanel');
const environmentClose = document.querySelector('#roofEnvironmentClose');
const sunPositionControl = document.querySelector('#sunPositionControl');
const sunPositionValue = document.querySelector('#sunPositionValue');
const northDirectionControl = document.querySelector('#northDirectionControl');
const northDirectionValue = document.querySelector('#northDirectionValue');
const nightPreviewToggle = document.querySelector('#nightPreviewToggle');
const componentsDrawer = document.querySelector('#roofComponentsDrawer');
const componentsBackdrop = document.querySelector('#roofComponentsBackdrop');
const componentsClose = document.querySelector('#roofComponentsClose');
const componentsSearch = document.querySelector('#roofComponentsSearch');
const componentsEmpty = document.querySelector('#roofComponentsEmpty');
const componentCards = [...document.querySelectorAll('[data-component-card]')];
const mobileLayoutQuery = window.matchMedia('(max-width: 760px)');
let relocatedToolsToolbar = null;
let toolsPositionFrame = 0;

const getApi = () => window.ROOF_CONFIGURATOR_API;
const getToolButton = (toolId) => shell.host.querySelector(`[data-tool-id="${toolId}"]`);

function setToolState(toolId, { active = false, disabled = false, title = null } = {}) {
  const button = getToolButton(toolId);
  if (!button) return;
  button.classList.toggle('is-active', Boolean(active));
  button.disabled = Boolean(disabled);
  button.setAttribute('aria-disabled', String(Boolean(disabled)));
  button.setAttribute('aria-pressed', String(Boolean(active)));
  if (title) {
    button.title = title;
    button.setAttribute('aria-label', title);
  }
}

function positionToolsUi() {
  toolsPositionFrame = 0;
  if (!relocatedToolsToolbar?.isConnected) return;

  // Pin the Roof tools to the 3D stage itself, not to the generic shared
  // top-bar offset. The stage starts below the Roof viewer header/BOM row,
  // so this remains correct on both desktop and mobile.
  const stageRect = viewerStage?.getBoundingClientRect();
  const anchorRect = toolsAnchor?.getBoundingClientRect();
  const compact = mobileLayoutQuery.matches;
  const toolbarLeft = Math.round((stageRect?.left ?? anchorRect?.left ?? 0) + (compact ? 10 : 18));
  const toolbarTop = Math.round((stageRect?.top ?? anchorRect?.top ?? 0) + (compact ? 10 : 16));

  relocatedToolsToolbar.style.setProperty('--roof-tools-left', `${toolbarLeft}px`);
  relocatedToolsToolbar.style.setProperty('--roof-tools-top', `${toolbarTop}px`);
  // Use inline !important values as the final authority. The shared toolbar
  // has its own fixed positioning rule and can be re-rendered after mount.
  relocatedToolsToolbar.style.setProperty('position', 'fixed', 'important');
  relocatedToolsToolbar.style.setProperty('top', `${toolbarTop}px`, 'important');
  relocatedToolsToolbar.style.setProperty('left', `${toolbarLeft}px`, 'important');
  relocatedToolsToolbar.style.setProperty('right', 'auto', 'important');
  relocatedToolsToolbar.style.setProperty('bottom', 'auto', 'important');

  if (!environmentPanel) return;
  const panelWidth = Math.min(390, Math.max(296, window.innerWidth - 24));
  const launcherWidth = relocatedToolsToolbar.querySelector('.tool-launcher')?.getBoundingClientRect().width || 74;
  let panelLeft = toolbarLeft + launcherWidth + 14;
  let panelTop = toolbarTop;

  if (panelLeft + panelWidth > window.innerWidth - 12) {
    panelLeft = 12;
    panelTop = toolbarTop + 58;
  }

  const maximumTop = Math.max(12, window.innerHeight - 430);
  panelTop = Math.min(panelTop, maximumTop);
  environmentPanel.style.setProperty('--roof-environment-left', `${Math.round(panelLeft)}px`);
  environmentPanel.style.setProperty('--roof-environment-top', `${Math.round(panelTop)}px`);
  environmentPanel.style.setProperty('--roof-environment-width', `${Math.round(panelWidth)}px`);
}

function scheduleToolsPosition() {
  if (toolsPositionFrame) return;
  toolsPositionFrame = requestAnimationFrame(positionToolsUi);
}

function relocateToolsToolbar() {
  const toolbar = shell.host.querySelector('[data-shared-tools]');
  if (!toolbar) return false;

  // Shared UI may replace this node when it re-renders. Always reacquire the
  // current toolbar and reapply the Roof-specific class/positioning.
  relocatedToolsToolbar = toolbar;
  toolbar.classList.add('roof-relocated-tools-toolbar');
  scheduleToolsPosition();
  return true;
}

function setEnvironmentPanelOpen(open) {
  if (!environmentPanel) return;
  const isOpen = Boolean(open);
  if (isOpen) setComponentsPanelOpen(false);
  environmentPanel.hidden = !isOpen;
  environmentPanel.classList.toggle('is-open', isOpen);
  setToolState('environment', { active: isOpen, title: t('tools.environmentTitle') });
  scheduleToolsPosition();
}

function setComponentsPanelOpen(open) {
  if (!componentsDrawer || !componentsBackdrop) return;
  const isOpen = Boolean(open);
  if (isOpen) setEnvironmentPanelOpen(false);
  componentsDrawer.classList.toggle('is-open', isOpen);
  componentsDrawer.setAttribute('aria-hidden', String(!isOpen));
  componentsBackdrop.classList.toggle('is-open', isOpen);
  componentsBackdrop.setAttribute('aria-hidden', String(!isOpen));
  document.body.classList.toggle('roof-components-open', isOpen);
  setToolState('components', {
    active: isOpen,
    title: t(isOpen ? 'tools.closeComponents' : 'tools.openComponents'),
  });
  if (isOpen) window.setTimeout(() => componentsSearch?.focus(), 180);
}

function filterComponents(query = '') {
  const normalized = String(query).trim().toLocaleLowerCase(resolveRoofLocale(shell.state.locale));
  let visibleCount = 0;
  componentCards.forEach((card) => {
    const visible = !normalized || card.dataset.search.includes(normalized);
    card.hidden = !visible;
    if (visible) visibleCount += 1;
  });
  if (componentsEmpty) componentsEmpty.hidden = visibleCount !== 0;
}

function syncToolsState(detail = getApi()?.getState?.()) {
  if (!detail) return;

  setToolState('dimensions', {
    active: Boolean(detail.showDimensions) && Boolean(detail.dimensionsAvailable),
    disabled: !detail.dimensionsAvailable,
    title: t(detail.dimensionsAvailable ? 'tools.dimensions' : 'tools.dimensionsUnavailable'),
  });
  setToolState('compass', {
    active: Boolean(detail.showCompass),
    title: t(detail.showCompass ? 'tools.hideCompass' : 'tools.showCompass'),
  });
  setToolState('components', {
    active: Boolean(componentsDrawer?.classList.contains('is-open')),
    title: componentsDrawer?.classList.contains('is-open')
      ? t('tools.closeComponents')
      : t('tools.openComponents'),
  });

  const viewNames = { perspective: '3D', front: t('viewer.front'), top: t('viewer.top') };
  const order = ['perspective', 'front', 'top'];
  const index = Math.max(0, order.indexOf(detail.currentView));
  const nextView = order[(index + 1) % order.length];
  setToolState('camera', {
    active: false,
    title: t('tools.changeOrientation', { view: viewNames[nextView] }),
  });

  if (sunPositionControl) sunPositionControl.value = String(detail.sunPosition ?? 42);
  if (sunPositionValue) sunPositionValue.textContent = `${Math.round(detail.sunPosition ?? 42)}%`;
  if (northDirectionControl) northDirectionControl.value = String(detail.northDirection ?? 108);
  if (northDirectionValue) northDirectionValue.textContent = `${Math.round(detail.northDirection ?? 108)}°`;
  if (nightPreviewToggle) nightPreviewToggle.checked = Boolean(detail.nightPreview);
}

shell.host.addEventListener('click', (event) => {
  const actionTarget = event.target.closest('[data-action]');
  if (actionTarget?.dataset.action === 'toggle-tools') {
    if (!shell.toolsOpen) {
      setEnvironmentPanelOpen(false);
      setComponentsPanelOpen(false);
    }
    scheduleToolsPosition();
    return;
  }

  const button = event.target.closest('[data-tool-id]');
  if (!button || button.disabled) return;
  const toolId = button.dataset.toolId;

  if (toolId === 'components') {
    setComponentsPanelOpen(!componentsDrawer?.classList.contains('is-open'));
    return;
  }

  const api = getApi();
  if (!api) return;

  if (toolId === 'environment') {
    setEnvironmentPanelOpen(environmentPanel?.hidden ?? true);
  } else if (toolId === 'dimensions') {
    setEnvironmentPanelOpen(false);
    api.toggleDimensions();
  } else if (toolId === 'compass') {
    setEnvironmentPanelOpen(false);
    api.toggleCompass();
  } else if (toolId === 'camera') {
    setEnvironmentPanelOpen(false);
    setComponentsPanelOpen(false);
    api.cycleOrientation();
  }
});

environmentClose?.addEventListener('click', () => setEnvironmentPanelOpen(false));
componentsClose?.addEventListener('click', () => setComponentsPanelOpen(false));
componentsBackdrop?.addEventListener('click', () => setComponentsPanelOpen(false));
componentsSearch?.addEventListener('input', () => filterComponents(componentsSearch.value));

sunPositionControl?.addEventListener('input', () => {
  const value = Number(sunPositionControl.value);
  if (sunPositionValue) sunPositionValue.textContent = `${Math.round(value)}%`;
  getApi()?.setSunPosition(value);
});

northDirectionControl?.addEventListener('input', () => {
  const value = Number(northDirectionControl.value);
  if (northDirectionValue) northDirectionValue.textContent = `${Math.round(value)}°`;
  getApi()?.setNorthDirection(value);
});

nightPreviewToggle?.addEventListener('change', () => {
  getApi()?.setNightPreview(nightPreviewToggle.checked);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!environmentPanel?.hidden) setEnvironmentPanelOpen(false);
  if (componentsDrawer?.classList.contains('is-open')) setComponentsPanelOpen(false);
});

window.addEventListener('roof-configurator-ready', (event) => syncToolsState(event.detail));
window.addEventListener('roof-tools-state-change', (event) => syncToolsState(event.detail));
window.addEventListener('resize', scheduleToolsPosition);

relocateToolsToolbar();

// Keep watching the shared host: some shell updates replace the toolbar DOM
// node. Disconnecting after the first match is what allowed the Tools button
// to snap back to the generic shared position.
const toolsObserver = new MutationObserver(() => {
  const currentToolbar = shell.host.querySelector('[data-shared-tools]');
  if (currentToolbar && currentToolbar !== relocatedToolsToolbar) {
    relocateToolsToolbar();
  }
});
toolsObserver.observe(shell.host, { childList: true, subtree: true });

if (toolsAnchor) new ResizeObserver(scheduleToolsPosition).observe(toolsAnchor);
if (viewerStage) new ResizeObserver(scheduleToolsPosition).observe(viewerStage);
requestAnimationFrame(() => {
  scheduleToolsPosition();
  syncToolsState();
});

window.ROOF_CONFIGURATOR_SHARED_SHELL = shell;
