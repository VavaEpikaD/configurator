import './styles/pergola.css';
import '../../shared-ui/styles/index.css';
import './styles/pergola-theme-overrides.css';
import { ConfiguratorStore } from './state.js';
import { readShareState } from '../../shared-ui/src/shareState.js';
import { applyConfiguratorSeo } from '../../shared-ui/src/configuratorSeo.js';
import { getLanguageProfile, getLocaleForHostname } from '../../shared-ui/src/config.js';
import { PergolaScene } from './scene/PergolaScene.js?v=10';
import { ConfiguratorUI } from './ui/ConfiguratorUI.js';
import { mountPergolaSharedShell } from './ui/pergolaSharedShell.js';
import { pergolaT } from './i18n.js';
import { requireTenantConfiguratorAccess } from '../../shared-ui/src/tenantBootstrap.js';
import { mountPergolaEmbedPreviewControls } from './ui/embedPreviewControls.js';
import { initializePergolaColorCatalog } from './color-catalog.js';

const tenantContext = await requireTenantConfiguratorAccess('pergola');

applyConfiguratorSeo('pergola');

const root = document.querySelector('#app');

if (!root) {
  throw new Error('The #app mount element is missing.');
}

const [sharedState] = await Promise.all([
  readShareState({ productType: 'pergola' }),
  initializePergolaColorCatalog(),
]);
const store = new ConfiguratorStore(sharedState);
const domainLocale = getLocaleForHostname(window.location.hostname);
const domainProfile = getLanguageProfile(domainLocale);
if (store.get().locale !== domainLocale) {
  store.patch({
    locale: domainLocale,
    units: domainProfile.units,
    currency: domainProfile.currency,
  }, { path: 'domain-locale', skipHistory: true });
}
const ui = new ConfiguratorUI(root, store);
const sharedShell = mountPergolaSharedShell({ store, ui, tenantContext });
const viewport = root.querySelector('[data-viewport]');

if (!viewport) {
  throw new Error('The 3D viewport mount element is missing.');
}

let scene;
const embedPreviewControls = mountPergolaEmbedPreviewControls({ store, viewport });

try {
  scene = new PergolaScene(viewport, store);
  ui.attachScene(scene);
} catch (error) {
  console.error('The 3D scene could not be initialized.', error);
  viewport.innerHTML = `
    <div class="webgl-error">
      <strong>${pergolaT(domainLocale, 'app.webglTitle')}</strong>
      <p>${pergolaT(domainLocale, 'app.webglBody')}</p>
    </div>
  `;
}

window.addEventListener('beforeunload', () => {
  scene?.destroy();
  embedPreviewControls?.destroy();
  sharedShell?.destroy();
  ui.destroy();
});
