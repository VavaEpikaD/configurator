import { convertCartMoneyAmount, mountStandaloneConfiguratorShell } from './shared-ui/src/standaloneShell.js?v=40';
import { SharedUndoManager } from './shared-ui/src/history/undoManager.js?v=1';
import { createShareUrl } from './shared-ui/src/shareState.js?v=5';
import { resolveSharedTools } from './shared-ui/src/tools/registry.js?v=12';
import { applyWindowTranslations, resolveWindowLocale, windowT } from './js/i18n.js?v=1';
import { requireTenantConfiguratorAccess } from './shared-ui/src/tenantBootstrap.js?v=1';

const tenantContext = await requireTenantConfiguratorAccess('window');

const initialLocale = resolveWindowLocale();
applyWindowTranslations(initialLocale);
const t = (key, variables = {}, locale = null) => windowT(locale ?? window.WINDOW_CONFIGURATOR_SHARED_SHELL?.state?.locale ?? initialLocale, key, variables);

const CAMERA_VIEW_TEXT = Object.freeze({
  'en-US': Object.freeze({ outside: 'Outside', inside: 'Inside', prefix: 'Camera' }),
  'ro-RO': Object.freeze({ outside: 'Exterior', inside: 'Interior', prefix: 'Cameră' }),
  'de-DE': Object.freeze({ outside: 'Außen', inside: 'Innen', prefix: 'Kamera' }),
});

let shell = null;

function getCameraViewText() {
  return CAMERA_VIEW_TEXT[shell?.state?.locale] || CAMERA_VIEW_TEXT['en-US'];
}

function enableWindowSharedCameraTool() {
  if (document.getElementById('window-shared-camera-tool-styles')) return;
  const style = document.createElement('style');
  style.id = 'window-shared-camera-tool-styles';
  style.textContent = `
/* Window opts into the Common UI camera tool. Override the legacy rule that
   hid the whole shared Tools launcher in this configurator. */
body.shared-ui-mounted .shared-ui-host [data-shared-tools] {
  display: flex !important;
}
`;
  document.head.appendChild(style);
}

function cycleWindowCameraView() {
  const api = window.WINDOW_CAMERA_VIEW_API;
  if (!api?.getViewSide || !api?.setViewSide) return null;
  const nextSide = api.getViewSide() === 'outside' ? 'inside' : 'outside';
  api.setViewSide(nextSide);
  const labels = getCameraViewText();
  shell?.showFeedback?.(`${labels.prefix}: ${labels[nextSide]}`);
  return nextSide;
}

enableWindowSharedCameraTool();

const history = new SharedUndoManager({
  capture: () => window.WINDOW_CONFIGURATOR_API?.captureState?.(),
  restore: (snapshot) => window.WINDOW_CONFIGURATOR_API?.restoreState?.(snapshot),
});

shell = mountStandaloneConfiguratorShell({
  productType: t('project.type'),
  productId: 'window',
  storagePrefix: '360-configurator:window',
  brandSrc: tenantContext?.logoUrl || './shared-ui/assets/360CONFIGURATOR.png',
  brandAlt: tenantContext?.companyName || '360 Configurator',
  capabilities: {
    viewAR: true,
    save: true,
    undo: true,
    reset: true,
    share: true,
  },
  tools: {
    // Use the exact Common UI camera tool used by Pergola and the other
    // configurators. Window intentionally exposes no other shared tool here.
    items: resolveSharedTools(['camera']),
    placement: { side: 'left', direction: 'down', offsetX: 12, offsetY: 12 },
  },
  settingsPanel: {
    panelSelector: '#controls',
    toggleSelector: '#sidebar-toggle',
    collapsedClass: 'sidebar-collapsed',
    bodyCollapsedClass: 'sidebar-is-collapsed',
  },
  configuratorPanel: {
    panelSelector: '#controls',
    fallbackValue: 0,
    getEstimatedTotal({ currency = 'EUR', locale = initialLocale } = {}) {
      const totalEur = window.WINDOW_CONFIGURATOR_API?.getEstimatedTotalEur?.();
      if (totalEur === null || totalEur === undefined || !Number.isFinite(Number(totalEur))) return null;
      const converted = convertCartMoneyAmount(Number(totalEur), 'EUR', currency);
      // Window configurator only: keep the Estimated total at currency precision
      // (two decimals) without changing the shared formatter used by other products.
      // Returning the formatted text also makes cart persistence parse the exact
      // displayed cents instead of storing a separately rounded whole-unit value.
      try {
        return new Intl.NumberFormat(locale || 'en-US', {
          style: 'currency',
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(converted);
      } catch {
        return `${currency} ${converted.toFixed(2)}`;
      }
    },
  },
  callbacks: {
    onViewAR() {
      document.querySelector('#qr-ar-button')?.click();
    },
    captureState() {
      return window.WINDOW_CONFIGURATOR_API?.captureState?.();
    },
    restoreState(snapshot) {
      return window.WINDOW_CONFIGURATOR_API?.restoreState?.(snapshot);
    },
    onUndo() {
      history.undo();
    },
    async resetConfiguration() {
      const api = window.WINDOW_CONFIGURATOR_API;
      if (!api?.resetConfiguration) return false;
      return (await api.resetConfiguration()) !== false;
    },
    onPreferenceChange(path, value, preferences) {
      if (path === 'locale') {
        applyWindowTranslations(value);
      }
      if (path === 'defaultArPlatform') {
        document.querySelector(`.ar-platform-option[data-platform="${value}"]`)?.click();
      }
      window.dispatchEvent(new CustomEvent('window-preference-change', {
        detail: { name: path, value, preferences: { ...preferences } },
      }));
    },
    getShareUrl() {
      const snapshot = window.WINDOW_CONFIGURATOR_API?.captureState?.();
      return snapshot
        ? createShareUrl({ productType: 'window', state: snapshot })
        : window.location.href;
    },
    onToolAction({ toolId }) {
      if (toolId === 'camera') cycleWindowCameraView();
    },
  },
});

// The shared camera tool is present immediately; the scene API arrives a
// moment later when main.js creates the Three.js context.
shell.setToolDisabled('camera', !window.WINDOW_CAMERA_VIEW_API);
window.addEventListener('window-camera-view-api-ready', () => {
  shell.setToolDisabled('camera', false);
});

const controls = document.querySelector('#controls');
history.bindSource(controls);

if (controls) {
  const markDirty = (event) => {
    if (event.target.closest('[data-shared-configurator-panel-footer]')) return;
    if (event.target.closest('button, input, select, textarea, summary')) shell.markDirty();
  };
  controls.addEventListener('click', markDirty, true);
  controls.addEventListener('input', markDirty, true);
  controls.addEventListener('change', markDirty, true);
}

const preferredPlatform = shell.state?.defaultArPlatform;
if (preferredPlatform) {
  window.setTimeout(() => {
    document.querySelector(`.ar-platform-option[data-platform="${preferredPlatform}"]`)?.click();
  }, 0);
}

window.WINDOW_CONFIGURATOR_SHARED_SHELL = shell;
window.WINDOW_CONFIGURATOR_UNDO_HISTORY = history;
window.dispatchEvent(new CustomEvent('window-shared-shell-ready', {
  detail: { currency: shell.state?.currency || 'EUR' },
}));

window.addEventListener('window-pricing-updated', () => {
  shell.refreshConfiguratorPanelFooter();
});
