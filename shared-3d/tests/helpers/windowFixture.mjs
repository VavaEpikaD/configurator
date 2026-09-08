import { createWindowModuleLoader } from './windowModules.mjs';

/** Real Window assembly code with a minimal DOM double and synthetic CAD sections.
 * This is a geometry regression, not a WebGL or customer-save browser test. */
export async function createWindowFixture(options = {}) {
  const elements = new Map();
  const values = { widthA: '1.2', heightB: '1.5', glassThickness: '24', openAngle: '0', cadProfile: '2_4_Oeffnungselemnt_Vertikal' };
  const element = id => {
    if (!elements.has(id)) elements.set(id, { id, value: values[id] ?? '', checked: !['cShowHouse', 'cExplode', 'mOscilo'].includes(id),
      style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {}, removeEventListener() {}, closest() { return null; }, setAttribute() {},
    });
    return elements.get(id);
  };
  const canvasContext = new Proxy({ measureText: text => ({ width: String(text).length * 10 }) }, { get: (obj, key) => obj[key] ?? (() => {}) });
  const document = {
    documentElement: { lang: 'en-US' }, body: { dataset: {}, classList: { add() {}, remove() {} } },
    getElementById: element, querySelector: () => null, querySelectorAll: () => [],
    createElement: tag => tag === 'canvas' ? { width: 0, height: 0, getContext: () => canvasContext } : element(tag),
  };
  const window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, location: { pathname: '/window-configurator/', search: '' } };
  const loader = createWindowModuleLoader({ ...options, globals: { document, window, CustomEvent: class { constructor(type, config) { this.type = type; this.detail = config?.detail; } },
    console: { ...console, log() {} }, ...options.globals } });
  const THREE = await loader.import('window-configurator/src/client/lib/three.module.js');
  const { createWindowBuilder } = await loader.import('window-configurator/src/client/js/window-builder.js');
  const { createWindowLayoutController } = await loader.import('window-configurator/src/client/js/window-layout-controller.js');
  const layout = options.layout ? createWindowLayoutController({ initialSelection: { layoutId: options.layout } }) : null;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), ground = new THREE.Object3D(), gridHelper = new THREE.Object3D();
  camera.position.set(2, 1, 3); ground.position.y = -1.2;
  const { MaterialLibrary } = await loader.import('shared-3d/src/index.js');
  const materials = new MaterialLibrary(THREE);
  const mat = materials.create('aluminium.powderCoated');
  function section(x, y, width, height) {
    const shape = new THREE.Shape(); shape.moveTo(x, -y); shape.lineTo(x + width, -y); shape.lineTo(x + width, -y - height); shape.lineTo(x, -y - height); shape.closePath();
    return shape;
  }
  const profiles = [
    { index: 1, role: 'frame', componentId: '575760', layer: 'Aluminium', section: 'top', shape: section(0, 0, 65, 57), bbox: { minX: 0, maxX: 65, minY: 0, maxY: 57 }, material: mat },
    { index: 2, role: 'sash', componentId: '575790', layer: 'Aluminium', section: 'top', shape: section(10, 50, 45, 55), bbox: { minX: 10, maxX: 55, minY: 50, maxY: 105 }, material: mat },
  ];
  if (layout) profiles.push({ index: 3, role: 'divider', componentId: '575800', layer: 'Aluminium', shape: section(56, 135, 88, 65), bbox: { minX: 56, maxX: 144, minY: 135, maxY: 200 }, dividerSourceBounds: { minX: 56, maxX: 144, minY: 135, maxY: 200, centerX: 100, centerY: 167.5 }, material: mat });
  const metadata = { globalCenterX: 32.5, globalMinX: 0, globalMaxX: 65, globalMinY: 0, globalMaxY: 105, isVertical: false, hasSplit: false };
  const builder = createWindowBuilder({ scene, camera, ground, gridHelper, isARMode: false, captureMode: false,
    pageParams: new URLSearchParams(), componentSelection: { add() {}, reset() {} },
    glassMat: materials.create('glass.clear'), handleMat: mat,
    profileInput: element('cadProfile'), glassThicknessInput: element('glassThickness'), glassThicknessLabel: element('valGlassThickness'),
    isGlazingBeadProfile: () => false, getProfileGroup: p => p.role, getProfileShape: p => p.shape,
    getProfileCadXShiftMm: () => 0, getActiveGlazingBeadCode: () => '573940', getActiveGasketCode: () => '224350',
    getProfileComponentNumber: p => p.componentId, getEffectiveProfileBbox: p => p.bbox,
    updateComponentPictures() {}, getFinishState: () => ({ aluminiumFinishMode: 'uniform', outsideFinishSelection: { type: 'coated', color: '#26343c' }, insideFinishSelection: { type: 'coated', color: '#26343c' } }), getSelectedHandleSide: () => 'right',
    ...(layout ? { getWindowLayoutState: () => layout.getConfigurationSnapshot() } : {}),
    ...options.builderOptions,
  });
  builder.setProfileData(metadata, profiles);
  return { builder, scene, camera, elements, materials, profiles, metadata, THREE, loader, layout };
}
