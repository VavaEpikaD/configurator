import '../../shared-ui/styles/index.css';
import 'leaflet/dist/leaflet.css';
import './styles/gas.css';
import { RouteElevationController } from './elevation/routeElevation.js';
import { RouteMap } from './map/RouteMap.js';
import { RouteObstacleController } from './obstacles/routeObstacles.js';
import { applyGasTranslations } from './i18n.js';
import { GasConfiguratorStore } from './state.js';
import { renderGasLayout } from './ui/layout.js';
import { profilePointerToDesign, renderGasState } from './ui/renderers.js';
import { mountGasSharedShell } from './ui/sharedShell.js';

const root = document.querySelector('#app');
if (!root) throw new Error('The #app mount element is missing.');

renderGasLayout(root);
const store = new GasConfiguratorStore();
let routeMap = null;
let resizeTimer = 0;
let elevationProfile = { status: 'idle', routeKey: '', samples: [] };
let obstacleScreening = { status: 'idle', routeKey: '', features: [], events: [] };

const elevationController = new RouteElevationController({
  onChange(nextProfile) {
    elevationProfile = nextProfile;
    renderGasState(root, store.get(), elevationProfile, obstacleScreening);
  },
});

const obstacleController = new RouteObstacleController({
  onChange(nextScreening) {
    obstacleScreening = nextScreening;
    const state = store.get();
    renderGasState(root, state, elevationProfile, obstacleScreening);
    routeMap?.sync(state, obstacleScreening);
  },
});

const sharedShellHandle = mountGasSharedShell({
  store,
  onSettingsPanelToggle() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => routeMap?.resize(), 210);
  },
});
const sharedShell = sharedShellHandle.shell;

const mapLoading = root.querySelector('#mapLoading');
const mapError = root.querySelector('#mapError');

try {
  routeMap = new RouteMap(root.querySelector('#routeMap'), store, {
    onLoadingChange(loading) {
      if (mapLoading) mapLoading.hidden = !loading;
    },
    onError(error) {
      if (mapError) mapError.hidden = !error;
    },
  });
} catch (error) {
  console.error('The route map could not be created.', error);
  if (mapLoading) mapLoading.hidden = true;
  if (mapError) mapError.hidden = false;
}

const numericBindings = [
  ['#trenchWidthInput', 'trench.widthM'],
  ['#beddingInput', 'trench.beddingM'],
  ['#startElevationInput', 'data.startElevationM'],
  ['#endElevationInput', 'data.endElevationM'],
];

const selectBindings = [
  ['#beddingMaterialSelect', 'trench.beddingMaterial'],
  ['#groundSourceSelect', 'data.groundSource'],
  ['#utilitySourceSelect', 'data.utilitySource'],
];

root.querySelectorAll('[data-route-mode]').forEach((button) => {
  button.addEventListener('click', () => store.setEditMode(button.dataset.routeMode));
});

root.querySelectorAll('[data-map-layer]').forEach((button) => {
  button.addEventListener('click', () => {
    if (!routeMap) return;
    const visible = routeMap.toggleReferenceLayer(button.dataset.mapLayer);
    button.classList.toggle('is-active', visible);
    button.setAttribute('aria-pressed', String(visible));
  });
});

root.querySelector('#removeWaypointButton')?.addEventListener('click', () => store.removeSelectedWaypoint());
root.querySelector('#clearWaypointsButton')?.addEventListener('click', () => store.clearWaypoints());
root.querySelector('#fitRouteButton')?.addEventListener('click', () => routeMap?.fitRoute());
root.querySelector('#fitExistingNetworkButton')?.addEventListener('click', () => routeMap?.fitExistingNetwork());
root.querySelector('#snapToNearestNetworkButton')?.addEventListener('click', () => {
  if (store.snapStartToNearestNetwork()) store.setEditMode('setB');
});
root.querySelector('#connectionToleranceInput')?.addEventListener('change', (event) => {
  store.update('connection.snapToleranceM', Number(event.target.value), {
    source: 'connection-tolerance',
  });
});
root.querySelector('#retryElevationButton')?.addEventListener('click', () => {
  elevationController.retry(store.get().route.points);
});
root.querySelector('#retryObstacleScreeningButton')?.addEventListener('click', () => {
  const state = store.get();
  obstacleController.retry(state.route.points, {
    enabled: state.screening.obstaclesEnabled,
    proximityThresholdM: state.screening.proximityThresholdM,
  });
});
root.querySelector('#groundTypeSelect')?.addEventListener('change', (event) => store.setSegmentSetting('groundType', event.target.value));
root.querySelector('#surfaceTypeSelect')?.addEventListener('change', (event) => store.setSegmentSetting('surfaceType', event.target.value));
root.querySelector('#stationInput')?.addEventListener('input', (event) => store.setStation(Number(event.target.value)));
root.querySelector('#osdCapacityInput')?.addEventListener('change', (event) => store.update('project.osdCapacityKnown', event.target.checked));
root.querySelector('#obstacleScreeningEnabledInput')?.addEventListener('change', (event) => store.update('screening.obstaclesEnabled', event.target.checked));
root.querySelector('#obstacleProximityInput')?.addEventListener('change', (event) => store.update('screening.proximityThresholdM', Number(event.target.value)));
root.querySelector('#coverOsdAgreementInput')?.addEventListener('change', (event) => store.update('regulatory.reducedCover.osdAgreement', event.target.checked));
root.querySelector('#coverProtectionInput')?.addEventListener('change', (event) => store.update('regulatory.reducedCover.additionalProtection', event.target.checked));
root.querySelector('#materialSelect')?.addEventListener('change', (event) => store.setPipeSelection({ material: event.target.value }));
root.querySelector('#diameterSelect')?.addEventListener('change', (event) => store.setPipeSelection({ diameterMm: Number(event.target.value) }));
root.querySelector('#sdrSelect')?.addEventListener('change', (event) => store.setPipeSelection({ sdr: event.target.value }));
root.querySelector('#pressureInput')?.addEventListener('change', (event) => store.setPipeSelection({ designPressureBar: Number(event.target.value) }));
root.querySelector('#coverInput')?.addEventListener('change', (event) => store.setTrenchCover(Number(event.target.value)));

root.querySelector('#toggleDepthProfileEditButton')?.addEventListener('click', () => {
  store.setProfileEditMode(!store.get().route.profileEditMode);
});
root.querySelector('#addDepthPointButton')?.addEventListener('click', () => {
  const state = store.get();
  store.addDepthPoint(state.route.stationM);
});
[
  '#removeDepthPointButton',
  '#removeDepthPointProfileButton',
].forEach((selector) => {
  root.querySelector(selector)?.addEventListener('click', () => store.removeSelectedDepthPoint());
});
[
  '#resetDepthProfileButton',
  '#resetDepthProfileProfileButton',
].forEach((selector) => {
  root.querySelector(selector)?.addEventListener('click', () => store.resetDepthProfile());
});
root.querySelector('#depthPointList')?.addEventListener('click', (event) => {
  const button = event.target.closest?.('[data-depth-point-id]');
  if (button) store.selectDepthPoint(button.dataset.depthPointId);
});
root.querySelector('#depthPointStationInput')?.addEventListener('change', (event) => {
  store.updateSelectedDepthPoint('stationM', Number(event.target.value));
});
root.querySelector('#depthPointCoverInput')?.addEventListener('change', (event) => {
  store.updateSelectedDepthPoint('coverM', Number(event.target.value));
});
root.querySelector('#depthPointSourceSelect')?.addEventListener('change', (event) => {
  if (event.target.value !== 'default') store.updateSelectedDepthPoint('source', event.target.value);
});

root.querySelector('#addRouteEventButton')?.addEventListener('click', () => store.addRouteEvent());
root.querySelector('#removeRouteEventButton')?.addEventListener('click', () => store.removeSelectedRouteEvent());
root.querySelector('#routeEventList')?.addEventListener('click', (event) => {
  const button = event.target.closest?.('[data-route-event-id]');
  if (button) store.selectRouteEvent(button.dataset.routeEventId);
});
root.querySelector('#routeEventLabelInput')?.addEventListener('change', (event) => store.updateSelectedRouteEvent('label', event.target.value));
root.querySelector('#routeEventStationInput')?.addEventListener('input', (event) => store.setRouteEventStation(Number(event.target.value)));
root.querySelector('#routeEventTypeSelect')?.addEventListener('change', (event) => store.updateSelectedRouteEvent('type', event.target.value));
root.querySelector('#routeEventSourceSelect')?.addEventListener('change', (event) => store.updateSelectedRouteEvent('source', event.target.value));
root.querySelector('#routeEventMethodSelect')?.addEventListener('change', (event) => store.updateSelectedRouteEvent('crossing.installationMethod', event.target.value));
root.querySelector('#routeEventUtilityTypeSelect')?.addEventListener('change', (event) => store.updateSelectedRouteEvent('crossing.utilityType', event.target.value));
root.querySelector('#routeEventGasPositionSelect')?.addEventListener('change', (event) => store.updateSelectedRouteEvent('crossing.gasPosition', event.target.value));
root.querySelector('#routeEventAngleInput')?.addEventListener('change', (event) => store.updateSelectedRouteEvent('crossing.angleDeg', Number(event.target.value)));
root.querySelector('#routeEventWidthInput')?.addEventListener('change', (event) => store.updateSelectedRouteEvent('crossing.obstacleWidthM', Number(event.target.value)));
root.querySelector('#routeEventClearanceInput')?.addEventListener('change', (event) => store.updateSelectedRouteEvent('crossing.verticalClearanceM', Number(event.target.value)));
root.querySelector('#routeEventSleeveInput')?.addEventListener('change', (event) => store.updateSelectedRouteEvent('crossing.protectiveSleeve', event.target.checked));
root.querySelector('#routeEventOwnerApprovalInput')?.addEventListener('change', (event) => store.updateSelectedRouteEvent('crossing.ownerApprovalDocumented', event.target.checked));
root.querySelector('#routeEventConfirmedInput')?.addEventListener('change', (event) => store.updateSelectedRouteEvent('confirmed', event.target.checked));
root.querySelector('#applyRouteEventDepthZoneButton')?.addEventListener('click', () => {
  const state = store.get();
  if (!state.route.selectedEventId) return;
  const coverM = Number(root.querySelector('#routeEventDepthCoverInput')?.value);
  store.createDepthZoneForRouteEvent(state.route.selectedEventId, coverM);
});

numericBindings.forEach(([selector, path]) => {
  root.querySelector(selector)?.addEventListener('change', (event) => store.update(path, Number(event.target.value)));
});

selectBindings.forEach(([selector, path, transform = String]) => {
  root.querySelector(selector)?.addEventListener('change', (event) => store.update(path, transform(event.target.value)));
});

root.querySelector('#obstacleEventList')?.addEventListener('click', (event) => {
  const configuredButton = event.target?.closest?.('[data-obstacle-route-event-id]');
  if (configuredButton) {
    store.selectRouteEvent(configuredButton.dataset.obstacleRouteEventId);
    store.setEditMode('inspect');
    return;
  }

  const addButton = event.target?.closest?.('[data-obstacle-event-add]');
  if (addButton) {
    const screeningEvent = obstacleScreening.events?.find((candidate) => (
      candidate.id === addButton.dataset.obstacleEventAdd
    ));
    if (screeningEvent) store.addRouteEventFromObstacle(screeningEvent);
    return;
  }

  const button = event.target?.closest?.('[data-obstacle-event-station]');
  if (!button) return;
  const stationM = Number(button.dataset.obstacleEventStation);
  const segmentId = button.dataset.obstacleEventSegment;
  if (segmentId) store.selectSegment(segmentId, stationM);
  else store.setStation(stationM);
  store.setEditMode('inspect');
});

const profileSvg = root.querySelector('#profileSvg');
let profileDrag = null;

profileSvg?.addEventListener('pointerdown', (event) => {
  if (event.button !== undefined && event.button !== 0) return;
  const svg = event.currentTarget;
  const current = store.get();
  const pointControl = event.target.closest?.('[data-depth-point-id]');
  const design = profilePointerToDesign(svg, event.clientX, event.clientY);
  if (!design) return;

  if (!current.route.profileEditMode) {
    if (pointControl) store.selectDepthPoint(pointControl.dataset.depthPointId);
    else store.setStation(design.stationM);
    if (current.route.editMode !== 'inspect') store.setEditMode('inspect');
    return;
  }

  event.preventDefault();
  let pointId = pointControl?.dataset.depthPointId || null;
  let historySnapshot = null;
  if (pointId) {
    historySnapshot = store.captureState();
    store.selectDepthPoint(pointId);
  } else {
    pointId = store.addDepthPoint(design.stationM, design.coverM);
  }
  if (!pointId) return;
  profileDrag = {
    pointerId: event.pointerId,
    pointId,
    historySnapshot,
    changed: false,
  };
  svg.setPointerCapture?.(event.pointerId);
  profileDrag.changed = store.moveDepthPoint(
    pointId,
    design.stationM,
    design.coverM,
    { persist: false },
  );
});

profileSvg?.addEventListener('pointermove', (event) => {
  if (!profileDrag || profileDrag.pointerId !== event.pointerId) return;
  const design = profilePointerToDesign(event.currentTarget, event.clientX, event.clientY);
  if (!design) return;
  event.preventDefault();
  if (store.moveDepthPoint(profileDrag.pointId, design.stationM, design.coverM, { persist: false })) {
    profileDrag.changed = true;
  }
});

function finishProfileDrag(event) {
  if (!profileDrag || profileDrag.pointerId !== event.pointerId) return;
  const svg = event.currentTarget;
  svg.releasePointerCapture?.(event.pointerId);
  if (profileDrag.historySnapshot && profileDrag.changed) {
    store.recordTransientHistory(profileDrag.historySnapshot);
  }
  store.persist();
  profileDrag = null;
}

profileSvg?.addEventListener('pointerup', finishProfileDrag);
profileSvg?.addEventListener('pointercancel', finishProfileDrag);
profileSvg?.addEventListener('keydown', (event) => {
  const pointControl = event.target.closest?.('[data-depth-point-id]');
  if (!pointControl || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  store.selectDepthPoint(pointControl.dataset.depthPointId);
});

const unsubscribe = store.subscribe((state) => {
  applyGasTranslations(root, state.preferences.locale);
  document.documentElement.lang = state.preferences.locale.split('-')[0];
  renderGasState(root, state, elevationProfile, obstacleScreening);
  routeMap?.sync(state, obstacleScreening);
  elevationController.request(state.route.points);
  obstacleController.request(state.route.points, {
    enabled: state.screening.obstaclesEnabled,
    proximityThresholdM: state.screening.proximityThresholdM,
  });
  ['locale', 'units', 'currency', 'darkMode'].forEach((preference) => {
    sharedShell.setPreference?.(preference, state.preferences[preference]);
  });
});

const onResize = () => routeMap?.resize();
window.addEventListener('resize', onResize, { passive: true });

window.addEventListener('beforeunload', () => {
  window.clearTimeout(resizeTimer);
  window.removeEventListener('resize', onResize);
  unsubscribe();
  elevationController.destroy();
  obstacleController.destroy();
  routeMap?.destroy();
  sharedShellHandle.destroy();
}, { once: true });
