import { readShareState } from '../../shared-ui/src/shareState.js?v=4';
import { createFenceState, deriveFenceMetrics, normalizeFenceState } from './state.js?v=4';
import { FenceScene } from './scene.js?v=20';
import { FenceUI } from './ui.js?v=4';
import { resolveFenceLocale } from './i18n.js?v=4';
import { initializeFenceFinishCatalog } from './finish-catalog.js?v=1';
import { requireTenantConfiguratorAccess } from '../../shared-ui/src/tenantBootstrap.js?v=1';

await requireTenantConfiguratorAccess('fence');
await initializeFenceFinishCatalog();

const initialLocale = resolveFenceLocale(window.FENCE_CONFIGURATOR_SHARED_SHELL?.state?.locale);
let state = createFenceState();
const sharedState = await readShareState({ productType: 'fence' });
if (sharedState && typeof sharedState === 'object') state = createFenceState(sharedState);

const scene = new FenceScene(document.querySelector('#canvasHost'));
const compactViewport = window.matchMedia('(max-width: 760px)');
const isCompactViewport = () => compactViewport.matches;

let environmentPanelOpen = false;
let currentBuild = null;
let rebuildTimer = 0;
let fitOnNextBuild = false;

const ui = new FenceUI(state, {
  onModelChange(options = {}) {
    scheduleRebuild(options);
  },
  onDisplayChange() {
    scene.applyDisplayState(state);
    syncToolButtons();
    markDirty();
  },
}, initialLocale);

function rebuildNow({ fitCamera = false } = {}) {
  window.clearTimeout(rebuildTimer);
  rebuildTimer = 0;
  normalizeFenceState(state);
  currentBuild = scene.rebuild(state, { fitCamera: fitCamera || fitOnNextBuild });
  fitOnNextBuild = false;
  ui.update(currentBuild);
  syncEnvironmentControls();
  syncToolButtons();
  markDirty();
  return currentBuild;
}

function scheduleRebuild({ fitCamera = false, immediate = false } = {}) {
  fitOnNextBuild ||= Boolean(fitCamera);
  if (immediate) {
    rebuildNow({ fitCamera: fitOnNextBuild });
    return;
  }
  window.clearTimeout(rebuildTimer);
  rebuildTimer = window.setTimeout(() => rebuildNow({ fitCamera: fitOnNextBuild }), 70);
}

function markDirty() {
  window.FENCE_CONFIGURATOR_SHARED_SHELL?.markDirty?.();
}

function syncToolButtons() {
  const shell = window.FENCE_CONFIGURATOR_SHARED_SHELL;
  if (!shell) return;
  shell.setToolState('environment', { active: environmentPanelOpen });
  shell.setToolState('dimensions', { active: state.showDimensions });
  shell.setToolState('compass', { active: state.compassVisible });
  shell.setToolState('technical-edges', { active: state.technicalEdges });
}

function setEnvironmentPanelOpen(open) {
  const nextOpen = Boolean(open);
  if (nextOpen && isCompactViewport()) {
    const shell = window.FENCE_CONFIGURATOR_SHARED_SHELL;
    shell?.setSettingsPanelCollapsed?.(true);
    if (shell?.toolsOpen) {
      shell.toolsOpen = false;
      shell.syncTools?.();
    }
  }

  environmentPanelOpen = nextOpen;
  const panel = document.querySelector('#environmentPanel');
  if (panel) {
    panel.hidden = !environmentPanelOpen;
    panel.classList.toggle('is-open', environmentPanelOpen);
  }
  syncToolButtons();
}

function syncEnvironmentControls() {
  const sun = document.querySelector('#sunPositionControl');
  const sunValue = document.querySelector('#sunPositionValue');
  const north = document.querySelector('#northDirectionControl');
  const northValue = document.querySelector('#northDirectionValue');
  const night = document.querySelector('#nightPreviewToggle');
  if (sun) sun.value = String(state.sunPosition);
  if (sunValue) sunValue.textContent = `${Math.round(state.sunPosition)}%`;
  if (north) north.value = String(state.northDirection);
  if (northValue) northValue.textContent = `${Math.round(state.northDirection)}°`;
  if (night) night.checked = state.nightPreview;
}

function applyEnvironmentFromControls() {
  const sun = document.querySelector('#sunPositionControl');
  const north = document.querySelector('#northDirectionControl');
  const night = document.querySelector('#nightPreviewToggle');
  state.sunPosition = Number(sun?.value ?? state.sunPosition);
  state.northDirection = Number(north?.value ?? state.northDirection);
  state.nightPreview = Boolean(night?.checked);
  scene.applyEnvironment(state);
  scene.updateCompass(state);
  syncEnvironmentControls();
  markDirty();
}

document.querySelector('#sunPositionControl')?.addEventListener('input', applyEnvironmentFromControls);
document.querySelector('#northDirectionControl')?.addEventListener('input', applyEnvironmentFromControls);
document.querySelector('#nightPreviewToggle')?.addEventListener('change', applyEnvironmentFromControls);
document.querySelector('#environmentClose')?.addEventListener('click', () => setEnvironmentPanelOpen(false));

currentBuild = scene.rebuild(state, { fitCamera: true });
ui.update(currentBuild);
syncEnvironmentControls();

function setPreferences(preferences = {}) {
  ui.setPreferences(preferences);
  scene.setPreferences({ units: preferences.units, locale: preferences.locale }, state);
}

const shellPreferences = window.FENCE_CONFIGURATOR_SHARED_SHELL?.state;
if (shellPreferences) setPreferences(shellPreferences);

function resetConfiguration() {
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, createFenceState());
  normalizeFenceState(state);
  setEnvironmentPanelOpen(false);
  rebuildNow({ fitCamera: true });
  window.history.replaceState({}, '', window.location.pathname);
  return true;
}

function restoreState(snapshot) {
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, structuredClone(snapshot));
  normalizeFenceState(state);
  rebuildNow({ fitCamera: true });
}

function toggleDimensions() {
  state.showDimensions = !state.showDimensions;
  scene.updateDimensions(state);
  syncToolButtons();
  markDirty();
}

function toggleCompass() {
  state.compassVisible = !state.compassVisible;
  scene.updateCompass(state);
  syncToolButtons();
  markDirty();
}

function cycleCamera() {
  const order = ['3d', 'front', 'top'];
  const index = Math.max(0, order.indexOf(state.cameraPreset));
  state.cameraPreset = order[(index + 1) % order.length];
  scene.setView(state.cameraPreset);
  markDirty();
}

function toggleTechnicalEdges() {
  state.technicalEdges = !state.technicalEdges;
  scene.applyDisplayState(state);
  syncToolButtons();
  markDirty();
}

function setDarkMode(enabled) {
  scene.setDarkMode(Boolean(enabled), state);
  scene.updateDimensions(state);
  scene.updateCompass(state);
}

window.addEventListener('fence-preference-change', (event) => {
  const preferences = event.detail?.preferences ?? window.FENCE_CONFIGURATOR_SHARED_SHELL?.state ?? {};
  if (event.detail?.name === 'darkMode') setDarkMode(Boolean(preferences.darkMode));
  if (event.detail?.name === 'locale' && preferences.locale) ui.setLocale(preferences.locale);
  setPreferences(preferences);
});

window.FENCE_CONFIGURATOR_API = {
  captureState: () => structuredClone(state),
  restoreState,
  getState: () => structuredClone(state),
  getMetrics: () => deriveFenceMetrics(state),
  resetConfiguration,
  rebuild: () => rebuildNow(),
  setDarkMode,
  setPreferences,
  toggleEnvironmentPanel: () => setEnvironmentPanelOpen(!environmentPanelOpen),
  closeToolPanels: () => setEnvironmentPanelOpen(false),
  toggleDimensions,
  toggleCompass,
  cycleCamera,
  toggleTechnicalEdges,
  syncToolButtons,
};

setDarkMode(Boolean(window.FENCE_CONFIGURATOR_SHARED_SHELL?.state?.darkMode));
syncToolButtons();
