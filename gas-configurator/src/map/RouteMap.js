import L from 'leaflet';
import servedUatData from '../data/valcea-served-uats.json';
import {
  buildRouteSegments,
  coordinateBounds,
  crossingLineCoordinates,
  interpolateRoute,
  nearestPointOnSegmentRatio,
} from '../domain/geometry.js';
import { gasT } from '../i18n.js';
import {
  getRouteEvents,
  legacyCrossingToRouteEvent,
  matchingRouteEventForObstacle,
  routeEventDisplayIndex,
  routeEventTypeDefinition,
} from '../domain/routeEvents.js';
import { routeObstacleRouteKey } from '../obstacles/routeObstacles.js';
import {
  assessNetworkConnection,
  EXISTING_NETWORK_DATA,
  getExistingNetworkAsset,
  projectCoordinateToNetworkAsset,
} from '../network/networkConnection.js';
import { toLeafletBounds, toLeafletLatLng } from './leafletCoordinates.js';

const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const TILE_URL = import.meta.env.VITE_GAS_TILE_URL?.trim() || DEFAULT_TILE_URL;
const TILE_ATTRIBUTION = import.meta.env.VITE_GAS_TILE_ATTRIBUTION?.trim()
  || DEFAULT_TILE_ATTRIBUTION;
const REFERENCE_LAYER_IDS = Object.freeze({
  existingNetwork: 'existingNetwork',
  servedUats: 'servedUats',
  obstacleRoads: 'obstacleRoads',
  obstacleRailways: 'obstacleRailways',
  obstacleWaterways: 'obstacleWaterways',
});

const OBSTACLE_LAYER_ID_BY_TYPE = Object.freeze({
  road: REFERENCE_LAYER_IDS.obstacleRoads,
  railway: REFERENCE_LAYER_IDS.obstacleRailways,
  waterway: REFERENCE_LAYER_IDS.obstacleWaterways,
});

const OBSTACLE_STYLE_BY_TYPE = Object.freeze({
  road: Object.freeze({ color: '#8a6848', weight: 4, dashArray: null }),
  railway: Object.freeze({ color: '#4f5961', weight: 4, dashArray: '9 5' }),
  waterway: Object.freeze({ color: '#2389b5', weight: 4, dashArray: null }),
});

const SERVICE_STATS_BY_GROUP = new globalThis.Map(
  servedUatData.features.map((feature) => [feature.properties.groupId, feature.properties]),
);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function localeNumber(value, locale, maximumFractionDigits = 3) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function markerSize(point) {
  return point.kind === 'waypoint' ? 24 : 29;
}

function makeMarkerElement(point) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `gas-route-marker${point.kind === 'waypoint' ? ' gas-route-marker--waypoint' : ''}`;
  element.dataset.pointId = point.id;
  element.setAttribute('aria-label', point.kind === 'waypoint' ? `Waypoint ${point.label}` : `Point ${point.label}`);
  const label = document.createElement('span');
  label.textContent = point.label;
  element.append(label);
  return element;
}

export class RouteMap {
  constructor(container, store, { onLoadingChange, onError } = {}) {
    if (!container) throw new Error('The route map container is missing.');
    this.container = container;
    this.store = store;
    this.onLoadingChange = onLoadingChange;
    this.onError = onError;
    this.markers = new globalThis.Map();
    this.routeLayers = new globalThis.Map();
    this.referenceLayers = new globalThis.Map();
    this.obstacleLayers = new globalThis.Map();
    this.referenceLayerVisibility = new globalThis.Map();
    this.networkLayerEntries = new globalThis.Map();
    this.uatLayerEntries = [];
    this.selectedReferenceAssetId = undefined;
    this.connectionMapKey = null;
    this.obstacleScreeningMapKey = null;
    this.stationLayer = null;
    this.crossingLayerGroup = null;
    this.connectionLayerGroup = null;
    this.ready = false;
    this.destroyed = false;
    this.lastState = store.get();
    this.tileErrorReported = false;

    onLoadingChange?.(true);

    // Leaflet renders the route as SVG and does not require WebGL. That keeps
    // route editing available on browsers where a GPU context cannot be kept.
    this.map = L.map(container, {
      center: [44.4288, 26.1025],
      zoom: 13,
      minZoom: 2,
      maxZoom: 19,
      zoomControl: false,
      preferCanvas: false,
      attributionControl: true,
    });

    this.onTileError = (event) => {
      if (this.destroyed || this.tileErrorReported) return;
      this.tileErrorReported = true;
      console.warn(
        'A base-map tile could not be loaded. Route editing remains available.',
        event?.error || event,
      );
    };

    this.zoomControl = L.control.zoom({ position: 'topright' }).addTo(this.map);
    this.baseLayer = L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: TILE_ATTRIBUTION,
      updateWhenIdle: true,
      keepBuffer: 2,
    });
    this.baseLayer.on('tileerror', this.onTileError);
    this.baseLayer.addTo(this.map);
    this.createMapPanes();
    this.createReferenceLayers();
    this.routeLayerGroup = L.layerGroup().addTo(this.map);
    this.connectionLayerGroup = L.layerGroup().addTo(this.map);
    this.crossingLayerGroup = L.layerGroup().addTo(this.map);

    this.onNetworkActionClick = (event) => {
      const button = event.target?.closest?.('[data-gas-network-connect]');
      if (!button || !this.container.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      const coordinate = [Number(button.dataset.longitude), Number(button.dataset.latitude)];
      const changed = this.store.connectToNetwork(button.dataset.assetId, coordinate);
      if (changed) this.store.setEditMode('setB');
      this.map.closePopup();
    };
    this.container.addEventListener('click', this.onNetworkActionClick);

    this.onMapClick = (event) => {
      const coordinate = [event.latlng.lng, event.latlng.lat];
      this.applyRouteEdit(coordinate);
    };

    this.map.on('click', this.onMapClick);
    this.ready = true;
    this.sync(this.lastState);
    this.fitRoute({ animate: false });
    this.onLoadingChange?.(false);
    this.onError?.(null);
  }

  createMapPanes() {
    [
      ['gas-served-uats', 340],
      ['gas-existing-network', 410],
      ['gas-public-obstacles', 420],
      ['gas-proposed-route', 430],
      ['gas-connection', 435],
      ['gas-obstacle-events', 438],
      ['gas-crossing', 440],
    ].forEach(([name, zIndex]) => {
      const pane = this.map.createPane(name);
      pane.style.zIndex = String(zIndex);
    });
  }

  createReferenceLayers() {
    const servedUats = L.geoJSON(servedUatData, {
      pane: 'gas-served-uats',
      style: (feature) => this.uatStyle(feature),
      onEachFeature: (feature, layer) => {
        this.uatLayerEntries.push({ feature, layer });
        layer.bindTooltip(escapeHtml(feature.properties.name), {
          className: 'gas-reference-tooltip',
          direction: 'top',
          sticky: true,
        });
        layer.bindPopup(() => this.uatPopupContent(feature), {
          className: 'gas-reference-popup-shell',
          maxWidth: 310,
        });
        layer.on('click', (event) => {
          if (this.store.get().route.editMode === 'inspect') return;
          this.applyRouteEdit([event.latlng.lng, event.latlng.lat]);
          layer.closePopup();
        });
      },
    });

    const existingNetwork = L.geoJSON(EXISTING_NETWORK_DATA, {
      pane: 'gas-existing-network',
      style: (feature) => this.networkStyle(feature),
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
        pane: 'gas-existing-network',
        radius: feature.properties.geometryRole === 'service-uat' ? 5 : 3.5,
        color: '#ffffff',
        weight: 1.5,
        fillColor: '#b84218',
        fillOpacity: 1,
        bubblingMouseEvents: false,
      }),
      onEachFeature: (feature, layer) => {
        let connectionCandidate = null;
        if (feature.geometry?.type === 'LineString') {
          this.networkLayerEntries.set(feature.properties.assetId, { feature, layer });
          layer.on('click', (event) => {
            connectionCandidate = projectCoordinateToNetworkAsset(
              [event.latlng.lng, event.latlng.lat],
              feature,
            );
          });
        }
        layer.bindTooltip(escapeHtml(feature.properties.name), {
          className: 'gas-reference-tooltip',
          direction: 'top',
          sticky: true,
        });
        layer.bindPopup(() => this.networkPopupContent(feature, connectionCandidate), {
          className: 'gas-reference-popup-shell',
          maxWidth: 310,
        });
        layer.on('click', (event) => {
          if (this.store.get().route.editMode === 'inspect') return;
          this.applyRouteEdit([event.latlng.lng, event.latlng.lat]);
          layer.closePopup();
        });
      },
    });

    this.referenceLayers.set(REFERENCE_LAYER_IDS.servedUats, servedUats);
    this.referenceLayers.set(REFERENCE_LAYER_IDS.existingNetwork, existingNetwork);
    Object.values(OBSTACLE_LAYER_ID_BY_TYPE).forEach((layerId) => {
      const layer = L.layerGroup();
      this.obstacleLayers.set(layerId, layer);
      this.referenceLayers.set(layerId, layer);
    });
    this.setReferenceLayerVisibility(REFERENCE_LAYER_IDS.servedUats, true);
    this.setReferenceLayerVisibility(REFERENCE_LAYER_IDS.existingNetwork, true);
    Object.values(OBSTACLE_LAYER_ID_BY_TYPE).forEach((layerId) => {
      this.setReferenceLayerVisibility(layerId, true);
    });
  }

  translation(key, variables = {}) {
    return gasT(this.store.get().preferences.locale, key, variables);
  }

  applyRouteEdit(coordinate) {
    const mode = this.store.get().route.editMode;
    if (mode === 'setA') return this.store.setEndpoint('a', coordinate);
    if (mode === 'setB') return this.store.setEndpoint('b', coordinate);
    if (mode === 'addWaypoint') return this.store.addWaypoint(coordinate);
    return false;
  }

  networkStyle(feature, selectedAssetId = null) {
    const selectable = feature.geometry?.type === 'LineString';
    const selected = selectable && feature.properties?.assetId === selectedAssetId;
    const hasSelection = Boolean(selectedAssetId);
    return {
      pane: 'gas-existing-network',
      color: selected ? '#087f5b' : '#cf5a21',
      weight: selected ? 8 : hasSelection ? 3.5 : 4,
      opacity: selected ? 1 : hasSelection ? 0.5 : 0.94,
      lineCap: 'round',
      lineJoin: 'round',
      bubblingMouseEvents: false,
    };
  }

  uatStyle(feature, selectedGroupId = null) {
    const selected = selectedGroupId && feature.properties?.groupId === selectedGroupId;
    const hasSelection = Boolean(selectedGroupId);
    return {
      pane: 'gas-served-uats',
      color: selected ? '#087f5b' : '#96510f',
      weight: selected ? 3 : hasSelection ? 1.5 : 2,
      opacity: selected ? 1 : hasSelection ? 0.45 : 0.92,
      fillColor: selected ? '#46b98a' : '#f4b63f',
      fillOpacity: selected ? 0.3 : hasSelection ? 0.08 : 0.2,
      bubblingMouseEvents: false,
    };
  }

  uatPopupContent(feature) {
    const { properties } = feature;
    const locale = this.store.get().preferences.locale;
    const scopeKey = properties.figuresScope === 'service-area'
      ? 'map.popup.scopeServiceArea'
      : 'map.popup.scopeUat';
    return `
      <div class="gas-reference-popup">
        <span class="gas-reference-popup__eyebrow">${escapeHtml(this.translation('map.popup.servedUat'))}</span>
        <strong>${escapeHtml(properties.administrativeType)} ${escapeHtml(properties.name)}</strong>
        <span>${escapeHtml(this.translation('map.popup.siruta'))} ${escapeHtml(properties.siruta)}</span>
        <dl>
          <div><dt>${escapeHtml(this.translation('map.popup.reportedNetwork'))}</dt><dd>${localeNumber(properties.reportedNetworkKm, locale)} km</dd></div>
          <div><dt>${escapeHtml(this.translation('map.popup.captiveConsumers'))}</dt><dd>${localeNumber(properties.captiveConsumers, locale, 0)}</dd></div>
        </dl>
        <small>${escapeHtml(this.translation(scopeKey))} · ${escapeHtml(this.translation('map.popup.reportedNote'))}</small>
      </div>`;
  }

  networkPopupContent(feature, connectionCandidate = null) {
    const { properties } = feature;
    const group = SERVICE_STATS_BY_GROUP.get(properties.groupId);
    const action = connectionCandidate ? `
      <button
        type="button"
        class="gas-reference-popup__action"
        data-gas-network-connect
        data-asset-id="${escapeHtml(connectionCandidate.assetId)}"
        data-longitude="${connectionCandidate.coordinate[0]}"
        data-latitude="${connectionCandidate.coordinate[1]}"
      >${escapeHtml(this.translation('action.startRouteHere'))}</button>
      <small>${escapeHtml(this.translation('map.popup.connectionHint'))}</small>` : '';
    return `
      <div class="gas-reference-popup">
        <span class="gas-reference-popup__eyebrow">${escapeHtml(this.translation('map.popup.existingFeature'))}</span>
        <strong>${escapeHtml(properties.name)}</strong>
        ${group ? `<span>${escapeHtml(this.translation('map.popup.group'))}: ${escapeHtml(group.serviceGroup)}</span>` : ''}
        ${action}
      </div>`;
  }

  syncReferenceSelection(state) {
    const selectedAssetId = state.connection?.assetId || null;
    if (this.selectedReferenceAssetId === selectedAssetId) return;
    this.selectedReferenceAssetId = selectedAssetId;
    const selectedGroupId = getExistingNetworkAsset(selectedAssetId)?.properties?.groupId || null;
    this.networkLayerEntries.forEach(({ feature, layer }, assetId) => {
      layer.setStyle(this.networkStyle(feature, selectedAssetId));
      if (assetId === selectedAssetId) layer.bringToFront();
    });
    this.uatLayerEntries.forEach(({ feature, layer }) => {
      layer.setStyle(this.uatStyle(feature, selectedGroupId));
    });
  }

  syncConnection(state) {
    const startCoordinate = state.route.points[0].coordinate;
    const connectionMapKey = JSON.stringify([
      startCoordinate,
      state.connection?.assetId || null,
      state.preferences.locale,
    ]);
    if (this.connectionMapKey === connectionMapKey) return;
    this.connectionMapKey = connectionMapKey;
    this.connectionLayerGroup.clearLayers();
    const assessment = assessNetworkConnection(state);
    if (!assessment.candidate || (!assessment.connected && !assessment.canSnap)) return;

    const candidateCoordinate = assessment.candidate.coordinate;
    if (!assessment.connected) {
      L.polyline([
        toLeafletLatLng(startCoordinate),
        toLeafletLatLng(candidateCoordinate),
      ], {
        pane: 'gas-connection',
        color: '#087f5b',
        weight: 3,
        opacity: 0.9,
        dashArray: '6 6',
        interactive: false,
      }).addTo(this.connectionLayerGroup);
    }

    const connectionMarker = L.circleMarker(toLeafletLatLng(candidateCoordinate), {
      pane: 'gas-connection',
      radius: assessment.connected ? 10 : 7,
      color: '#ffffff',
      weight: 3,
      fillColor: assessment.connected ? '#087f5b' : '#cf5a21',
      fillOpacity: 1,
      interactive: true,
      bubblingMouseEvents: false,
    })
      .bindTooltip(this.translation(
        assessment.connected ? 'map.connection.connected' : 'map.connection.nearest',
      ), {
        className: 'gas-reference-tooltip',
        direction: 'top',
      })
      .addTo(this.connectionLayerGroup);
    if (!assessment.connected) {
      connectionMarker.on('click', () => {
        if (this.store.connectToNetwork(
          assessment.candidate.assetId,
          assessment.candidate.coordinate,
        )) {
          this.store.setEditMode('setB');
        }
      });
    }
  }

  setReferenceLayerVisibility(layerId, visible) {
    const layer = this.referenceLayers.get(layerId);
    if (!layer) return false;
    const shouldShow = Boolean(visible);
    const isShown = this.map.hasLayer(layer);
    if (shouldShow && !isShown) layer.addTo(this.map);
    else if (!shouldShow && isShown) layer.removeFrom(this.map);
    this.referenceLayerVisibility.set(layerId, shouldShow);
    return shouldShow;
  }

  toggleReferenceLayer(layerId) {
    return this.setReferenceLayerVisibility(
      layerId,
      !this.referenceLayerVisibility.get(layerId),
    );
  }

  applyCursor() {
    const mode = this.store.get().route.editMode;
    this.container.style.cursor = mode === 'inspect' ? '' : 'crosshair';
  }

  obstacleFeatureLabel(feature) {
    const typeLabel = this.translation(`obstacle.type.${feature.type}`);
    return feature.name || this.translation('obstacle.unnamed', { type: typeLabel });
  }

  obstacleEventTooltip(event) {
    const locale = this.store.get().preferences.locale;
    const units = this.store.get().preferences.units;
    const station = units === 'imperial' ? event.stationM * 3.28084 : event.stationM;
    const distance = units === 'imperial' ? event.distanceM * 3.28084 : event.distanceM;
    const unit = units === 'imperial' ? 'ft' : 'm';
    const stationLabel = `${localeNumber(station, locale, 1)} ${unit}`;
    const detail = event.relation === 'crossing'
      ? this.translation('obstacle.detail.crossing', {
        station: stationLabel,
        angle: `${localeNumber(event.angleDeg || 0, locale, 0)}°`,
      })
      : this.translation('obstacle.detail.proximity', {
        station: stationLabel,
        distance: `${localeNumber(distance, locale, 1)} ${unit}`,
      });
    return `<strong>${escapeHtml(this.obstacleFeatureLabel(event))}</strong><br><span>${escapeHtml(detail)}</span>`;
  }

  obstacleFeatureStyle(feature, hasCrossing, hasProximity) {
    const base = OBSTACLE_STYLE_BY_TYPE[feature.type] || OBSTACLE_STYLE_BY_TYPE.road;
    return {
      pane: 'gas-public-obstacles',
      color: base.color,
      weight: hasCrossing ? base.weight + 2 : hasProximity ? base.weight + 1 : base.weight,
      opacity: hasCrossing ? 0.98 : hasProximity ? 0.82 : 0.48,
      dashArray: base.dashArray,
      lineCap: 'round',
      lineJoin: 'round',
      bubblingMouseEvents: false,
    };
  }

  syncObstacleScreening(state, obstacleScreening = null) {
    const routeKey = routeObstacleRouteKey(state.route.points);
    const screeningMatchesRoute = obstacleScreening?.routeKey === routeKey;
    const mapKey = JSON.stringify([
      routeKey,
      obstacleScreening?.status || 'idle',
      screeningMatchesRoute ? obstacleScreening?.requestKey || obstacleScreening?.fetchedAt || null : null,
      state.preferences.locale,
      state.preferences.units,
      getRouteEvents(state)
        .filter((event) => event.source === 'publicScreening')
        .map((event) => [event.sourceFeatureId, event.type, Math.round(event.stationM)])
        .sort(),
    ]);
    if (this.obstacleScreeningMapKey === mapKey) return;
    this.obstacleScreeningMapKey = mapKey;
    this.obstacleLayers.forEach((layer) => layer.clearLayers());
    if (!screeningMatchesRoute || obstacleScreening?.status !== 'ready') return;

    const visibleEvents = (obstacleScreening.events || []).filter((event) => (
      !matchingRouteEventForObstacle(state, event)
    ));
    const eventsByFeature = new globalThis.Map();
    (obstacleScreening.events || []).forEach((event) => {
      const events = eventsByFeature.get(event.featureId) || [];
      events.push(event);
      eventsByFeature.set(event.featureId, events);
    });

    (obstacleScreening.features || []).forEach((feature) => {
      const layerId = OBSTACLE_LAYER_ID_BY_TYPE[feature.type];
      const group = this.obstacleLayers.get(layerId);
      if (!group || !Array.isArray(feature.coordinates) || feature.coordinates.length < 2) return;
      const events = eventsByFeature.get(feature.id) || [];
      const hasCrossing = events.some((event) => event.relation === 'crossing');
      const hasProximity = events.some((event) => event.relation === 'proximity');
      L.polyline(feature.coordinates.map(toLeafletLatLng), this.obstacleFeatureStyle(
        feature,
        hasCrossing,
        hasProximity,
      ))
        .bindTooltip(escapeHtml(this.obstacleFeatureLabel(feature)), {
          className: 'gas-reference-tooltip',
          direction: 'top',
          sticky: true,
        })
        .addTo(group);
    });

    visibleEvents.forEach((event) => {
      const layerId = OBSTACLE_LAYER_ID_BY_TYPE[event.type];
      const group = this.obstacleLayers.get(layerId);
      const style = OBSTACLE_STYLE_BY_TYPE[event.type] || OBSTACLE_STYLE_BY_TYPE.road;
      if (!group) return;
      const marker = L.circleMarker(toLeafletLatLng(event.coordinate), {
        pane: 'gas-obstacle-events',
        radius: event.relation === 'crossing' ? 7 : 5.5,
        color: style.color,
        weight: event.relation === 'crossing' ? 3 : 2,
        fillColor: event.relation === 'crossing' ? '#ffffff' : style.color,
        fillOpacity: event.relation === 'crossing' ? 1 : 0.32,
        dashArray: event.relation === 'proximity' ? '3 3' : null,
        interactive: true,
        bubblingMouseEvents: false,
      })
        .bindTooltip(this.obstacleEventTooltip(event), {
          className: 'gas-reference-tooltip gas-obstacle-tooltip',
          direction: 'top',
        })
        .addTo(group);
      marker.on('click', () => {
        this.store.selectSegment(event.segmentId, event.stationM);
        this.store.setEditMode('inspect');
      });
    });
  }

  syncRouteLayers(state) {
    this.routeLayerGroup.clearLayers();
    this.routeLayers.clear();

    buildRouteSegments(state.route.points).forEach((segment) => {
      const selected = segment.id === state.route.selectedSegmentId;
      const coordinates = [
        toLeafletLatLng(segment.startPoint.coordinate),
        toLeafletLatLng(segment.endPoint.coordinate),
      ];
      const halo = L.polyline(coordinates, {
        pane: 'gas-proposed-route',
        color: '#ffffff',
        weight: selected ? 12 : 9,
        opacity: 0.92,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(this.routeLayerGroup);
      const line = L.polyline(coordinates, {
        pane: 'gas-proposed-route',
        color: selected ? '#055a93' : '#0878c9',
        weight: selected ? 7 : 5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: true,
        bubblingMouseEvents: true,
      }).addTo(this.routeLayerGroup);

      const onClick = (event) => {
        if (this.store.get().route.editMode !== 'inspect') return;
        const ratio = nearestPointOnSegmentRatio(
          [event.latlng.lng, event.latlng.lat],
          segment,
        );
        this.store.selectSegment(
          segment.id,
          segment.startChainageM + (segment.lengthM * ratio),
        );
      };
      const onMouseOver = () => { this.container.style.cursor = 'pointer'; };
      const onMouseOut = () => this.applyCursor();
      line.on('click', onClick);
      line.on('mouseover', onMouseOver);
      line.on('mouseout', onMouseOut);
      this.routeLayers.set(segment.id, {
        halo,
        line,
        onClick,
        onMouseOver,
        onMouseOut,
      });
    });
  }

  syncStation(state) {
    const station = interpolateRoute(state.route.points, state.route.stationM);
    if (!station.segment) {
      this.stationLayer?.remove();
      this.stationLayer = null;
      return;
    }

    const position = toLeafletLatLng(station.coordinate);
    if (!this.stationLayer) {
      this.stationLayer = L.circleMarker(position, {
        pane: 'gas-crossing',
        radius: 7,
        color: '#14212b',
        weight: 3,
        fillColor: '#ffffff',
        fillOpacity: 1,
        interactive: false,
      }).addTo(this.map);
      return;
    }
    this.stationLayer.setLatLng(position);
    this.stationLayer.bringToFront();
  }

  routeEventTooltip(state, event) {
    const definition = routeEventTypeDefinition(event.type);
    const index = routeEventDisplayIndex(state, event);
    const locale = state.preferences.locale;
    const units = state.preferences.units;
    const station = units === 'imperial' ? event.stationM * 3.28084 : event.stationM;
    const unit = units === 'imperial' ? 'ft' : 'm';
    const title = event.label || `${this.translation(definition.labelKey)} ${index}`;
    const source = this.translation(`option.routeEventSource.${event.source}`);
    return `<strong>${escapeHtml(title)}</strong><br><span>${escapeHtml(this.translation(definition.labelKey))} · ${escapeHtml(localeNumber(station, locale, 1))} ${unit}</span><br><small>${escapeHtml(source)}</small>`;
  }

  syncRouteEvents(state) {
    this.crossingLayerGroup.clearLayers();
    const configuredEvents = getRouteEvents(state);
    const legacyEvent = configuredEvents.length === 0
      ? legacyCrossingToRouteEvent(state.crossing)
      : null;
    const events = configuredEvents.length > 0
      ? configuredEvents
      : legacyEvent ? [legacyEvent] : [];

    events.forEach((event) => {
      const definition = routeEventTypeDefinition(event.type);
      const widthM = Number(event.crossing?.obstacleWidthM) || 0;
      const lineLengthM = widthM > 0 ? Math.max(28, widthM + 16) : 70;
      const crossing = crossingLineCoordinates(
        state.route.points,
        event.stationM,
        event.crossing?.angleDeg,
        lineLengthM,
      );
      if (!crossing) return;
      const coordinates = [
        toLeafletLatLng(crossing.start),
        toLeafletLatLng(crossing.end),
      ];
      const selected = state.route.selectedEventId === event.id;
      const dashArray = event.type === 'road-crossing'
        ? null
        : event.type === 'railway-crossing' ? '10 5' : '7 6';
      L.polyline(coordinates, {
        pane: 'gas-crossing',
        color: '#ffffff',
        weight: selected ? 10 : 8,
        opacity: 0.94,
        interactive: false,
      }).addTo(this.crossingLayerGroup);
      const line = L.polyline(coordinates, {
        pane: 'gas-crossing',
        color: definition.color,
        weight: selected ? 6 : 4,
        opacity: event.confirmed ? 1 : 0.76,
        dashArray,
        interactive: true,
        bubblingMouseEvents: false,
      }).addTo(this.crossingLayerGroup);
      const marker = L.circleMarker(toLeafletLatLng(crossing.center), {
        pane: 'gas-crossing',
        radius: selected ? 8 : 6,
        color: definition.color,
        weight: selected ? 3 : 2,
        fillColor: selected ? definition.color : '#ffffff',
        fillOpacity: 1,
        interactive: true,
        bubblingMouseEvents: false,
      }).addTo(this.crossingLayerGroup);
      const tooltip = this.routeEventTooltip(state, event);
      line.bindTooltip(tooltip, {
        className: 'gas-reference-tooltip gas-route-event-tooltip',
        direction: 'top',
      });
      marker.bindTooltip(tooltip, {
        className: 'gas-reference-tooltip gas-route-event-tooltip',
        direction: 'top',
      });
      const onSelect = () => {
        if (configuredEvents.some((candidate) => candidate.id === event.id)) {
          this.store.selectRouteEvent(event.id);
        } else {
          this.store.selectSegment(crossing.station.segment.id, crossing.station.chainageM);
        }
        this.store.setEditMode('inspect');
      };
      line.on('click', onSelect);
      marker.on('click', onSelect);
    });
  }

  syncMarkers(state) {
    const currentIds = new Set(state.route.points.map((point) => point.id));
    this.markers.forEach((entry, id) => {
      if (currentIds.has(id)) return;
      entry.element.removeEventListener('click', entry.onClick);
      entry.marker.off('dragend', entry.onDragEnd);
      entry.marker.remove();
      this.markers.delete(id);
    });

    state.route.points.forEach((point) => {
      let entry = this.markers.get(point.id);
      if (!entry) {
        const element = makeMarkerElement(point);
        const size = markerSize(point);
        const icon = L.divIcon({
          className: 'gas-route-marker-host',
          html: element,
          iconSize: [size, size],
          iconAnchor: [size / 2, size],
        });
        const marker = L.marker(toLeafletLatLng(point.coordinate), {
          icon,
          draggable: true,
          keyboard: false,
          riseOnHover: true,
        }).addTo(this.map);
        const onClick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.store.selectPoint(point.id);
          if (point.kind === 'waypoint') {
            const segments = buildRouteSegments(this.store.get().route.points);
            const adjacent = segments.find((segment) => segment.endPoint.id === point.id)
              || segments.find((segment) => segment.startPoint.id === point.id);
            if (adjacent) this.store.selectSegment(adjacent.id, adjacent.endChainageM);
          }
        };
        const onDragEnd = () => {
          const location = marker.getLatLng();
          this.store.movePoint(point.id, [location.lng, location.lat]);
        };
        element.addEventListener('click', onClick);
        marker.on('dragend', onDragEnd);
        entry = { marker, element, onClick, onDragEnd };
        this.markers.set(point.id, entry);
      }
      entry.marker.setLatLng(toLeafletLatLng(point.coordinate));
      entry.marker.setZIndexOffset(state.route.selectedPointId === point.id ? 1000 : 0);
      entry.element.classList.toggle('is-selected', state.route.selectedPointId === point.id);
      const label = entry.element.querySelector('span');
      if (label) label.textContent = point.label;
    });
  }

  sync(state, obstacleScreening = null) {
    this.lastState = state;
    if (!this.ready || this.destroyed) return;
    this.syncReferenceSelection(state);
    this.syncRouteLayers(state);
    this.syncConnection(state);
    this.syncObstacleScreening(state, obstacleScreening);
    this.syncRouteEvents(state);
    this.syncStation(state);
    this.syncMarkers(state);
    this.applyCursor();
  }

  fitRoute({ animate = true } = {}) {
    const state = this.store.get();
    const bounds = coordinateBounds(state.route.points);
    if (!bounds || !this.ready) return;
    const samePoint = bounds.minLon === bounds.maxLon && bounds.minLat === bounds.maxLat;
    if (samePoint) {
      this.map.setView([bounds.minLat, bounds.minLon], 17, { animate });
      return;
    }
    this.map.fitBounds(
      toLeafletBounds(bounds),
      {
        padding: [72, 72],
        maxZoom: 17,
        animate,
        duration: animate ? 0.45 : 0,
      },
    );
  }

  fitExistingNetwork({ animate = true } = {}) {
    if (!this.ready) return;
    const network = this.referenceLayers.get(REFERENCE_LAYER_IDS.existingNetwork);
    const uats = this.referenceLayers.get(REFERENCE_LAYER_IDS.servedUats);
    const bounds = L.latLngBounds([]);
    if (network?.getBounds().isValid()) bounds.extend(network.getBounds());
    if (uats?.getBounds().isValid()) bounds.extend(uats.getBounds());
    if (!bounds.isValid()) return;
    this.map.fitBounds(bounds, {
      padding: [34, 34],
      maxZoom: 13,
      animate,
      duration: animate ? 0.45 : 0,
    });
  }

  resize() {
    this.map?.invalidateSize({ animate: false, pan: false });
  }

  destroy() {
    this.destroyed = true;
    this.baseLayer?.off('tileerror', this.onTileError);
    this.map?.off('click', this.onMapClick);
    this.container.removeEventListener('click', this.onNetworkActionClick);
    this.markers.forEach((entry) => {
      entry.element.removeEventListener('click', entry.onClick);
      entry.marker.off('dragend', entry.onDragEnd);
      entry.marker.remove();
    });
    this.markers.clear();
    this.routeLayers.clear();
    this.referenceLayers.clear();
    this.obstacleLayers.clear();
    this.referenceLayerVisibility.clear();
    this.networkLayerEntries.clear();
    this.uatLayerEntries = [];
    this.selectedReferenceAssetId = undefined;
    this.connectionMapKey = null;
    this.obstacleScreeningMapKey = null;
    this.map?.remove();
  }
}
