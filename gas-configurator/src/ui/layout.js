import {
  PIPE_DIAMETERS_MM,
  PIPE_MATERIALS,
  PIPE_SDRS,
} from '../domain/pipeCatalog.js';
import {
  CROSSING_INSTALLATION_METHODS,
  ROUTE_EVENT_SOURCES,
  ROUTE_EVENT_TYPES,
} from '../domain/routeEvents.js';

const routeIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="5" cy="18" r="2.25"></circle>
    <circle cx="19" cy="6" r="2.25"></circle>
    <path d="M7 17c4.5-1 3.5-7 8-9l1.8-.8"></path>
  </svg>`;

const pinIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"></path>
    <circle cx="12" cy="10" r="2.25"></circle>
  </svg>`;

const addIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5v14M5 12h14"></path>
  </svg>`;

const fitIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"></path>
  </svg>`;

function option(value, translationKey, selected = false) {
  return `<option value="${value}" data-gas-i18n="${translationKey}"${selected ? ' selected' : ''}></option>`;
}

function textOption(value, label, selected = false) {
  return `<option value="${value}"${selected ? ' selected' : ''}>${label}</option>`;
}

function pipeMaterialOptions() {
  return Object.values(PIPE_MATERIALS)
    .map((material, index) => option(material.id, material.labelKey, index === 0))
    .join('');
}

function pipeDiameterOptions() {
  return PIPE_DIAMETERS_MM
    .map((diameterMm) => textOption(diameterMm, `${diameterMm} mm`, diameterMm === 63))
    .join('');
}

function pipeSdrOptions() {
  return PIPE_SDRS.map((sdr) => textOption(sdr, sdr, sdr === 'SDR11')).join('');
}

function routeEventTypeOptions() {
  return Object.values(ROUTE_EVENT_TYPES)
    .map((definition) => option(
      definition.id,
      definition.labelKey,
      definition.id === ROUTE_EVENT_TYPES.utilityCrossing.id,
    ))
    .join('');
}

function routeEventSourceOptions() {
  return ROUTE_EVENT_SOURCES
    .map((source) => option(source, `option.routeEventSource.${source}`, source === 'manual'))
    .join('');
}

function installationMethodOptions() {
  return CROSSING_INSTALLATION_METHODS
    .map((method) => option(method, `option.installationMethod.${method}`, method === 'notSpecified'))
    .join('');
}

function metric(id, labelKey, modifier = '') {
  return `
    <div class="gas-metric ${modifier}">
      <span data-gas-i18n="${labelKey}"></span>
      <strong id="${id}">—</strong>
    </div>`;
}

export function renderGasLayout(root) {
  root.innerHTML = `
    <main class="gas-app app-shell">
      <section class="gas-workspace" aria-label="Gas route workspace">
        <header class="gas-workspace__header">
          <div class="gas-title-lockup">
            <span class="gas-kicker" data-gas-i18n="app.eyebrow"></span>
            <div class="gas-title-row">
              <h1 data-gas-i18n="app.title"></h1>
              <span class="gas-status-chip gas-status-chip--prototype" data-gas-i18n="badge.prototype"></span>
            </div>
            <p data-gas-i18n="app.scope"></p>
          </div>
          <div class="gas-route-summary" aria-live="polite">
            <span data-gas-i18n="metric.routeLength"></span>
            <strong id="headerRouteLength">—</strong>
            <span class="gas-route-summary__terrain" data-gas-i18n="metric.terrainLength"></span>
            <strong id="headerTerrainLength" class="gas-route-summary__terrain">—</strong>
            <small id="headerSegmentCount">—</small>
          </div>
        </header>

        <section class="gas-map-card gas-surface-card" aria-labelledby="gasMapTitle">
          <div class="gas-card-heading gas-map-heading">
            <div>
              <h2 id="gasMapTitle" data-gas-i18n="map.title"></h2>
              <p data-gas-i18n="map.help"></p>
            </div>
            <span class="gas-screening-label" data-gas-i18n="map.screening"></span>
          </div>
          <div class="gas-map-stage">
            <div id="routeMap" class="gas-map" role="application" aria-label="Interactive route map"></div>
            <div class="gas-map-tools" role="toolbar" aria-label="Route editing tools">
              <button type="button" class="gas-map-tool is-active" data-route-mode="inspect" aria-pressed="true">
                ${routeIcon}<span data-gas-i18n="mode.inspect"></span>
              </button>
              <button type="button" class="gas-map-tool" data-route-mode="setA" aria-pressed="false">
                ${pinIcon}<span data-gas-i18n="mode.setA"></span>
              </button>
              <button type="button" class="gas-map-tool" data-route-mode="setB" aria-pressed="false">
                ${pinIcon}<span data-gas-i18n="mode.setB"></span>
              </button>
              <button type="button" class="gas-map-tool" data-route-mode="addWaypoint" aria-pressed="false">
                ${addIcon}<span data-gas-i18n="mode.addWaypoint"></span>
              </button>
            </div>
            <section class="gas-map-layers" data-gas-i18n-aria-label="map.layersAria" aria-label="Map reference layers">
              <button type="button" id="fitExistingNetworkButton" class="gas-map-layers__heading" data-gas-i18n-title="action.fitExistingNetwork" data-gas-i18n-aria-label="action.fitExistingNetwork">
                <span>
                  <small>Vâlcea</small>
                  <strong data-gas-i18n="map.networkFocus"></strong>
                </span>
                ${fitIcon}
              </button>
              <div class="gas-map-layers__toggles" role="group" data-gas-i18n-aria-label="map.layersAria" aria-label="Map reference layers">
                <div class="gas-map-layer-key">
                  <span class="gas-map-layer-swatch gas-map-layer-swatch--proposed" aria-hidden="true"></span>
                  <span data-gas-i18n="map.layer.proposedRoute"></span>
                </div>
                <button type="button" class="gas-map-layer-toggle is-active" data-map-layer="existingNetwork" aria-pressed="true">
                  <span class="gas-map-layer-swatch gas-map-layer-swatch--network" aria-hidden="true"></span>
                  <span data-gas-i18n="map.layer.existingNetwork"></span>
                  <small data-gas-i18n="map.layer.networkLength"></small>
                </button>
                <button type="button" class="gas-map-layer-toggle is-active" data-map-layer="servedUats" aria-pressed="true">
                  <span class="gas-map-layer-swatch gas-map-layer-swatch--uat" aria-hidden="true"></span>
                  <span data-gas-i18n="map.layer.servedUats"></span>
                  <small data-gas-i18n="map.layer.uatCount"></small>
                </button>
                <button type="button" class="gas-map-layer-toggle is-active" data-map-layer="obstacleRoads" aria-pressed="true">
                  <span class="gas-map-layer-swatch gas-map-layer-swatch--road" aria-hidden="true"></span>
                  <span data-gas-i18n="map.layer.roads"></span>
                  <small id="roadObstacleLayerCount">—</small>
                </button>
                <button type="button" class="gas-map-layer-toggle is-active" data-map-layer="obstacleRailways" aria-pressed="true">
                  <span class="gas-map-layer-swatch gas-map-layer-swatch--railway" aria-hidden="true"></span>
                  <span data-gas-i18n="map.layer.railways"></span>
                  <small id="railwayObstacleLayerCount">—</small>
                </button>
                <button type="button" class="gas-map-layer-toggle is-active" data-map-layer="obstacleWaterways" aria-pressed="true">
                  <span class="gas-map-layer-swatch gas-map-layer-swatch--waterway" aria-hidden="true"></span>
                  <span data-gas-i18n="map.layer.waterways"></span>
                  <small id="waterwayObstacleLayerCount">—</small>
                </button>
              </div>
              <p>
                <span data-gas-i18n="map.layer.disclaimer"></span>
                <a href="https://geo-spatial.org/descarcare/date/administrative-boundaries/" target="_blank" rel="noreferrer" data-gas-i18n="map.layer.boundarySource"></a>
                <br />
                <span data-gas-i18n="map.layer.obstacleDisclaimer"></span>
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" data-gas-i18n="map.layer.obstacleSource"></a>
              </p>
            </section>
            <div class="gas-map-actions">
              <button type="button" id="removeWaypointButton" class="gas-icon-action" data-gas-i18n-title="action.removeWaypoint" data-gas-i18n-aria-label="action.removeWaypoint" aria-label="Remove waypoint">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M9 7V4h6v3M8 7l1 13h6l1-13"></path></svg>
              </button>
              <button type="button" id="clearWaypointsButton" class="gas-icon-action" data-gas-i18n-title="action.clearWaypoints" data-gas-i18n-aria-label="action.clearWaypoints" aria-label="Clear waypoints">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M7 18h10M9 12V5h6v10"></path></svg>
              </button>
              <button type="button" id="fitRouteButton" class="gas-icon-action" data-gas-i18n-title="action.fitRoute" data-gas-i18n-aria-label="action.fitRoute" aria-label="Fit route">
                ${fitIcon}
              </button>
            </div>
            <div id="mapLoading" class="gas-map-state">
              <span class="gas-loader" aria-hidden="true"></span>
              <span data-gas-i18n="map.loading"></span>
            </div>
            <div id="mapError" class="gas-map-state gas-map-state--error" hidden>
              <strong data-gas-i18n="map.errorTitle"></strong>
              <span data-gas-i18n="map.errorBody"></span>
            </div>
          </div>
        </section>

        <div class="gas-analysis-grid">
          <section class="gas-analysis-card gas-analysis-card--profile gas-surface-card" aria-labelledby="profileTitle">
            <div class="gas-card-heading">
              <div>
                <h2 id="profileTitle" data-gas-i18n="view.profile"></h2>
                <p class="gas-profile-data-line">
                  <span id="profileDataStatus" class="gas-elevation-status" data-gas-i18n="view.elevationLoading" aria-live="polite"></span>
                  <a class="gas-elevation-source" href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer" data-gas-i18n="view.elevationSource"></a>
                </p>
              </div>
              <div class="gas-profile-heading-actions">
                <button type="button" id="retryElevationButton" class="gas-profile-retry" data-gas-i18n-title="action.retryElevation" data-gas-i18n-aria-label="action.retryElevation" hidden>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.1 9A7 7 0 0 1 18.7 7M17.9 15A7 7 0 0 1 5.3 17"></path></svg>
                </button>
                <button type="button" id="toggleDepthProfileEditButton" class="gas-profile-edit-toggle" aria-pressed="false">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.9-10.9a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z"></path><path d="m14.8 6.4 2.8 2.8"></path></svg>
                  <span data-gas-i18n="action.editDepthProfile"></span>
                </button>
                <span id="profileStationLabel" class="gas-station-pill">—</span>
              </div>
            </div>
            <svg id="profileSvg" class="gas-diagram" viewBox="0 0 720 220" role="img" aria-labelledby="profileTitle"></svg>
            <div class="gas-profile-footer">
              <p id="profileEditHint" class="gas-profile-edit-hint" data-gas-i18n="view.profileReadHint"></p>
              <div class="gas-profile-actions" role="toolbar" data-gas-i18n-aria-label="depthProfile.toolbar">
                <button type="button" id="addDepthPointButton" class="gas-profile-action">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
                  <span data-gas-i18n="action.addDepthPoint"></span>
                </button>
                <button type="button" id="removeDepthPointProfileButton" class="gas-profile-action gas-profile-action--danger" data-gas-i18n="action.removeDepthPoint"></button>
                <button type="button" id="resetDepthProfileProfileButton" class="gas-profile-action" data-gas-i18n="action.resetDepthProfile"></button>
              </div>
              <div class="gas-profile-legend" aria-label="Profile legend">
                <span><i class="gas-profile-legend__line gas-profile-legend__line--terrain"></i><b data-gas-i18n="legend.terrain"></b></span>
                <span><i class="gas-profile-legend__line gas-profile-legend__line--pipe"></i><b data-gas-i18n="legend.designedPipe"></b></span>
                <span><i class="gas-profile-legend__point gas-profile-legend__point--manual"></i><b data-gas-i18n="legend.manualDepth"></b></span>
                <span><i class="gas-profile-legend__point gas-profile-legend__point--surveyed"></i><b data-gas-i18n="legend.surveyedDepth"></b></span>
              </div>
            </div>
          </section>

          <section class="gas-analysis-card gas-surface-card" aria-labelledby="crossSectionTitle">
            <div class="gas-card-heading">
              <div>
                <h2 id="crossSectionTitle" data-gas-i18n="view.crossSection"></h2>
                <p id="crossSectionSegmentLabel">—</p>
              </div>
              <span class="gas-section-scale">NTS</span>
            </div>
            <svg id="crossSectionSvg" class="gas-diagram" viewBox="0 0 480 220" role="img" aria-labelledby="crossSectionTitle"></svg>
          </section>
        </div>
      </section>

      <aside id="gasSidebar" class="gas-sidebar shared-settings-panel shared-settings-panel--light" aria-label="Gas pipe settings">
        <div class="gas-sidebar__intro">
          <div>
            <span class="gas-status-chip gas-status-chip--warning" data-gas-i18n="badge.preliminary"></span>
            <p data-gas-i18n="hint.compliance"></p>
          </div>
        </div>

        <details class="gas-panel" open>
          <summary><span data-gas-i18n="panel.route"></span><span class="gas-panel__chevron" aria-hidden="true"></span></summary>
          <div class="gas-panel__body">
            <label class="gas-field gas-field--range" for="stationInput">
              <span><b data-gas-i18n="field.station"></b><output id="stationValue">—</output></span>
              <input id="stationInput" type="range" min="0" max="100" step="1" value="0" />
            </label>
            <div class="gas-segment-card">
              <span data-gas-i18n="field.selectedSegment"></span>
              <strong id="selectedSegmentLabel">—</strong>
              <small><span data-gas-i18n="field.segmentLength"></span> · <span id="selectedSegmentLength">—</span></small>
            </div>
            <section id="networkConnectionCard" class="gas-connection-card gas-connection-card--unconnected" aria-labelledby="networkConnectionTitle">
              <div class="gas-connection-card__heading">
                <span id="networkConnectionTitle" data-gas-i18n="connection.title"></span>
                <strong id="networkConnectionStatus" aria-live="polite">—</strong>
              </div>
              <strong id="networkConnectionAsset">—</strong>
              <span id="networkConnectionGroup" class="gas-connection-card__group">—</span>
              <dl class="gas-connection-card__details">
                <div><dt data-gas-i18n="connection.gap"></dt><dd id="networkConnectionGap">—</dd></div>
                <div><dt data-gas-i18n="connection.coordinates"></dt><dd id="networkConnectionCoordinates">—</dd></div>
              </dl>
              <div class="gas-connection-card__metrics">
                <div><span data-gas-i18n="connection.planLength"></span><strong id="networkConnectionPlanLength">—</strong></div>
                <div><span data-gas-i18n="connection.terrainLength"></span><strong id="networkConnectionTerrainLength">—</strong></div>
                <div><span data-gas-i18n="connection.cost"></span><strong id="networkConnectionCost">—</strong></div>
              </div>
              <button type="button" id="snapToNearestNetworkButton" class="gas-connection-card__action" data-gas-i18n="action.snapAtoNetwork" hidden></button>
              <small class="gas-connection-card__source" data-gas-i18n="connection.source"></small>
              <small id="networkConnectionHint" class="gas-connection-card__hint"></small>
            </section>
            <label class="gas-field gas-field--range gas-connection-tolerance" for="connectionToleranceInput">
              <span><b data-gas-i18n="field.connectionTolerance"></b><output id="connectionToleranceValue">—</output></span>
              <input id="connectionToleranceInput" type="range" min="1" max="50" step="1" value="8" />
            </label>
            <div class="gas-field-grid">
              <label class="gas-field" for="groundTypeSelect">
                <span data-gas-i18n="field.groundType"></span>
                <select id="groundTypeSelect">
                  ${option('common', 'option.ground.common', true)}
                  ${option('cohesive', 'option.ground.cohesive')}
                  ${option('granular', 'option.ground.granular')}
                  ${option('softRock', 'option.ground.softRock')}
                  ${option('hardRock', 'option.ground.hardRock')}
                </select>
              </label>
              <label class="gas-field" for="surfaceTypeSelect">
                <span data-gas-i18n="field.surfaceType"></span>
                <select id="surfaceTypeSelect">
                  ${option('greenfield', 'option.surface.greenfield', true)}
                  ${option('pavers', 'option.surface.pavers')}
                  ${option('asphalt', 'option.surface.asphalt')}
                  ${option('concrete', 'option.surface.concrete')}
                </select>
              </label>
            </div>
            <p class="gas-field-hint" data-gas-i18n="hint.segment"></p>
          </div>
        </details>

        <details class="gas-panel" open>
          <summary>
            <span data-gas-i18n="panel.obstacles"></span>
            <span id="obstacleSummaryBadge" class="gas-validation-count">—</span>
            <span class="gas-panel__chevron" aria-hidden="true"></span>
          </summary>
          <div class="gas-panel__body">
            <label class="gas-check-row" for="obstacleScreeningEnabledInput">
              <input id="obstacleScreeningEnabledInput" type="checkbox" />
              <span><b data-gas-i18n="field.obstacleScreeningEnabled"></b></span>
            </label>
            <div id="obstacleScreeningFields" class="gas-obstacle-screening">
              <div class="gas-obstacle-status-row">
                <span id="obstacleScreeningStatus" class="gas-obstacle-status" aria-live="polite">—</span>
                <button type="button" id="retryObstacleScreeningButton" class="gas-profile-retry" data-gas-i18n-title="action.retryObstacles" data-gas-i18n-aria-label="action.retryObstacles" hidden>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.1 9A7 7 0 0 1 18.7 7M17.9 15A7 7 0 0 1 5.3 17"></path></svg>
                </button>
              </div>
              <label class="gas-field gas-field--range" for="obstacleProximityInput">
                <span><b data-gas-i18n="field.obstacleProximity"></b><output id="obstacleProximityValue">—</output></span>
                <input id="obstacleProximityInput" type="range" min="0" max="100" step="5" value="25" />
              </label>
              <div class="gas-obstacle-metrics" aria-live="polite">
                <div><span data-gas-i18n="obstacle.metric.crossings"></span><strong id="obstacleCrossingCount">—</strong></div>
                <div><span data-gas-i18n="obstacle.metric.nearby"></span><strong id="obstacleProximityCount">—</strong></div>
                <div><span data-gas-i18n="obstacle.metric.features"></span><strong id="obstacleFeatureCount">—</strong></div>
              </div>
              <div id="obstacleEventList" class="gas-obstacle-list" aria-live="polite"></div>
              <p class="gas-field-hint">
                <span data-gas-i18n="hint.obstacles"></span>
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" data-gas-i18n="map.layer.obstacleSource"></a>
              </p>
            </div>
          </div>
        </details>

        <details class="gas-panel" open>
          <summary><span data-gas-i18n="panel.pipe"></span><span class="gas-panel__chevron" aria-hidden="true"></span></summary>
          <div class="gas-panel__body">
            <div class="gas-field-grid">
              <label class="gas-field" for="materialSelect"><span data-gas-i18n="field.material"></span>
                <select id="materialSelect">${pipeMaterialOptions()}</select>
              </label>
              <label class="gas-field" for="diameterSelect"><span data-gas-i18n="field.diameter"></span>
                <select id="diameterSelect">${pipeDiameterOptions()}</select>
              </label>
              <label class="gas-field" for="sdrSelect"><span data-gas-i18n="field.sdr"></span>
                <select id="sdrSelect">${pipeSdrOptions()}</select>
              </label>
              <label class="gas-field" for="pressureInput"><span data-gas-i18n="field.pressure"></span>
                <span class="gas-input-with-unit"><input id="pressureInput" type="number" min="0.05" max="6" step="0.05" /><em>bar</em></span>
              </label>
              <label class="gas-field" for="coverInput"><span data-gas-i18n="field.cover"></span>
                <span class="gas-input-with-unit"><input id="coverInput" type="number" min="0.3" max="3" step="0.05" /><em>m</em></span>
              </label>
              <label class="gas-field" for="trenchWidthInput"><span data-gas-i18n="field.trenchWidth"></span>
                <span class="gas-input-with-unit"><input id="trenchWidthInput" type="number" min="0.3" max="2" step="0.01" aria-describedby="trenchWidthRequirement" /><em>m</em></span>
                <small id="trenchWidthRequirement" class="gas-field-requirement" aria-live="polite"></small>
              </label>
              <label class="gas-field" for="beddingInput"><span data-gas-i18n="field.bedding"></span>
                <span class="gas-input-with-unit"><input id="beddingInput" type="number" min="0.1" max="0.15" step="0.01" aria-describedby="beddingRequirement" /><em>m</em></span>
                <small id="beddingRequirement" class="gas-field-requirement" aria-live="polite"></small>
              </label>
              <label class="gas-field" for="beddingMaterialSelect"><span data-gas-i18n="field.beddingMaterial"></span>
                <select id="beddingMaterialSelect" aria-describedby="beddingRequirement">
                  ${option('sand03to08', 'option.beddingMaterial.sand03to08', true)}
                  ${option('unspecified', 'option.beddingMaterial.unspecified')}
                  ${option('other', 'option.beddingMaterial.other')}
                </select>
              </label>
            </div>
            <div class="gas-pipe-catalog-card" aria-live="polite">
              <span data-gas-i18n="pipeCatalog.selection"></span>
              <strong id="pipeProductLabel">—</strong>
              <small id="pipeProductDimensions">—</small>
              <code id="pipeCatalogVersion">—</code>
            </div>
            <p class="gas-field-hint" data-gas-i18n="hint.pipe"></p>
          </div>
        </details>

        <details id="depthProfilePanel" class="gas-panel" open>
          <summary>
            <span data-gas-i18n="panel.depthProfile"></span>
            <span id="depthPointCount" class="gas-validation-count">—</span>
            <span class="gas-panel__chevron" aria-hidden="true"></span>
          </summary>
          <div class="gas-panel__body">
            <div class="gas-depth-summary-grid">
              <div><span data-gas-i18n="depthProfile.minimumCover"></span><strong id="minimumCoverResult">—</strong></div>
              <div><span data-gas-i18n="depthProfile.averageCover"></span><strong id="averageCoverResult">—</strong></div>
              <div><span data-gas-i18n="depthProfile.maximumCover"></span><strong id="maximumCoverResult">—</strong></div>
              <div><span data-gas-i18n="depthProfile.maximumTrenchDepth"></span><strong id="maximumTrenchDepthResult">—</strong></div>
            </div>
            <div id="depthPointList" class="gas-depth-point-list" aria-live="polite"></div>
            <p id="depthPointEmpty" class="gas-route-event-empty" data-gas-i18n="depthProfile.empty"></p>
            <div id="depthPointFields" class="gas-conditional-fields" hidden>
              <div class="gas-field-grid">
                <label class="gas-field" for="depthPointStationInput">
                  <span data-gas-i18n="field.depthPointStation"></span>
                  <span class="gas-input-with-unit"><input id="depthPointStationInput" type="number" min="0" step="0.1" /><em>m</em></span>
                </label>
                <label class="gas-field" for="depthPointCoverInput">
                  <span data-gas-i18n="field.depthPointCover"></span>
                  <span class="gas-input-with-unit"><input id="depthPointCoverInput" type="number" min="0.3" max="5" step="0.05" /><em>m</em></span>
                </label>
              </div>
              <label class="gas-field" for="depthPointSourceSelect">
                <span data-gas-i18n="field.depthPointSource"></span>
                <select id="depthPointSourceSelect">
                  ${option('default', 'option.depthPointSource.default', true)}
                  ${option('manual', 'option.depthPointSource.manual')}
                  ${option('surveyed', 'option.depthPointSource.surveyed')}
                </select>
              </label>
              <p id="depthPointLockHint" class="gas-field-hint" data-gas-i18n="depthProfile.editHint"></p>
              <dl class="gas-depth-point-values">
                <div><dt data-gas-i18n="depthProfile.ground"></dt><dd id="depthGroundValue">—</dd></div>
                <div><dt data-gas-i18n="depthProfile.pipeCrown"></dt><dd id="depthCrownValue">—</dd></div>
                <div><dt data-gas-i18n="depthProfile.pipeCenterline"></dt><dd id="depthCenterlineValue">—</dd></div>
                <div><dt data-gas-i18n="depthProfile.pipeInvert"></dt><dd id="depthInvertValue">—</dd></div>
                <div><dt data-gas-i18n="depthProfile.localSlope"></dt><dd id="depthSlopeValue">—</dd></div>
              </dl>
              <button type="button" id="removeDepthPointButton" class="gas-route-event-remove" data-gas-i18n="action.removeDepthPoint"></button>
            </div>
            <div id="depthProfileWarnings" class="gas-depth-warning" aria-live="polite"></div>
            <button type="button" id="resetDepthProfileButton" class="gas-secondary-action" data-gas-i18n="action.resetDepthProfile"></button>
            <p class="gas-field-hint" data-gas-i18n="depthProfile.defaultHint"></p>
          </div>
        </details>

        <details class="gas-panel" open>
          <summary>
            <span data-gas-i18n="panel.rules"></span>
            <span class="gas-panel__chevron" aria-hidden="true"></span>
          </summary>
          <div class="gas-panel__body">
            <div class="gas-rule-pack">
              <span data-gas-i18n="rule.scope"></span>
              <strong data-gas-i18n="rule.packVersion"></strong>
              <a href="https://legislatie.just.ro/Public/DetaliiDocumentAfis/201310" target="_blank" rel="noreferrer" data-gas-i18n="rule.officialSource"></a>
            </div>

            <section class="gas-rule-group" aria-labelledby="coverRuleTitle">
              <div class="gas-rule-group__heading">
                <strong id="coverRuleTitle" data-gas-i18n="rule.coverTitle"></strong>
                <span data-gas-i18n="rule.coverCriterion"></span>
              </div>
              <div id="reducedCoverExceptionFields" class="gas-conditional-fields" hidden>
                <p class="gas-field-hint" data-gas-i18n="rule.coverExceptionHint"></p>
                <label class="gas-check-row" for="coverOsdAgreementInput">
                  <input id="coverOsdAgreementInput" type="checkbox" />
                  <span><b data-gas-i18n="field.coverOsdAgreement"></b></span>
                </label>
                <label class="gas-check-row" for="coverProtectionInput">
                  <input id="coverProtectionInput" type="checkbox" />
                  <span><b data-gas-i18n="field.coverProtection"></b></span>
                </label>
              </div>
            </section>

            <section class="gas-rule-group" aria-labelledby="trenchRuleTitle">
              <div class="gas-rule-group__heading">
                <strong id="trenchRuleTitle" data-gas-i18n="rule.trenchTitle"></strong>
                <span data-gas-i18n="rule.trenchCriterion"></span>
              </div>
              <p class="gas-field-hint" data-gas-i18n="rule.trenchHint"></p>
            </section>

            <section class="gas-rule-group" aria-labelledby="routeEventRuleTitle">
              <div class="gas-rule-group__heading">
                <strong id="routeEventRuleTitle" data-gas-i18n="rule.routeEventsTitle"></strong>
                <span data-gas-i18n="rule.routeEventsCriterion"></span>
              </div>
              <div class="gas-route-event-toolbar">
                <span id="routeEventCount">—</span>
                <button type="button" id="addRouteEventButton" class="gas-route-event-add">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
                  <span data-gas-i18n="action.addRouteEvent"></span>
                </button>
              </div>
              <div id="routeEventList" class="gas-route-event-list" aria-live="polite"></div>
              <p id="routeEventEmpty" class="gas-route-event-empty" data-gas-i18n="empty.routeEvents"></p>
              <div id="routeEventFields" class="gas-conditional-fields" hidden>
                <label class="gas-field" for="routeEventLabelInput">
                  <span data-gas-i18n="field.routeEventLabel"></span>
                  <input id="routeEventLabelInput" type="text" maxlength="80" autocomplete="off" />
                </label>
                <div class="gas-field-grid">
                  <label class="gas-field" for="routeEventTypeSelect">
                    <span data-gas-i18n="field.routeEventType"></span>
                    <select id="routeEventTypeSelect">${routeEventTypeOptions()}</select>
                  </label>
                  <label class="gas-field" for="routeEventSourceSelect">
                    <span data-gas-i18n="field.routeEventSource"></span>
                    <select id="routeEventSourceSelect">${routeEventSourceOptions()}</select>
                  </label>
                </div>
                <label class="gas-field gas-field--range" for="routeEventStationInput">
                  <span><b data-gas-i18n="field.routeEventStation"></b><output id="routeEventStationValue">—</output></span>
                  <input id="routeEventStationInput" type="range" min="0" max="100" step="1" value="0" />
                </label>
                <div class="gas-field-grid">
                  <label class="gas-field" for="routeEventAngleInput">
                    <span data-gas-i18n="field.routeEventAngle"></span>
                    <span class="gas-input-with-unit"><input id="routeEventAngleInput" type="number" min="0" max="90" step="1" /><em>°</em></span>
                  </label>
                  <label class="gas-field" for="routeEventWidthInput">
                    <span data-gas-i18n="field.routeEventWidth"></span>
                    <span class="gas-input-with-unit"><input id="routeEventWidthInput" type="number" min="0" max="500" step="0.1" /><em>m</em></span>
                  </label>
                </div>
                <label class="gas-field" for="routeEventMethodSelect">
                  <span data-gas-i18n="field.routeEventMethod"></span>
                  <select id="routeEventMethodSelect">${installationMethodOptions()}</select>
                </label>
                <div id="routeEventDepthZoneFields" class="gas-route-event-depth-zone">
                  <div class="gas-route-event-depth-zone__heading">
                    <strong data-gas-i18n="depthProfile.crossingZone"></strong>
                    <span id="routeEventDepthZoneStatus">—</span>
                  </div>
                  <label class="gas-field" for="routeEventDepthCoverInput">
                    <span data-gas-i18n="field.routeEventDepthCover"></span>
                    <span class="gas-input-with-unit"><input id="routeEventDepthCoverInput" type="number" min="0.3" max="5" step="0.05" /><em>m</em></span>
                  </label>
                  <button type="button" id="applyRouteEventDepthZoneButton" class="gas-secondary-action" data-gas-i18n="action.applyCrossingDepthZone"></button>
                  <p class="gas-field-hint" data-gas-i18n="depthProfile.crossingZoneHint"></p>
                </div>
                <div id="utilityRouteEventFields" class="gas-conditional-fields">
                  <div class="gas-field-grid">
                    <label class="gas-field" for="routeEventUtilityTypeSelect">
                      <span data-gas-i18n="field.crossingUtilityType"></span>
                      <select id="routeEventUtilityTypeSelect">
                        ${option('water', 'option.crossingUtility.water', true)}
                        ${option('sewer', 'option.crossingUtility.sewer')}
                        ${option('electric', 'option.crossingUtility.electric')}
                        ${option('telecom', 'option.crossingUtility.telecom')}
                        ${option('districtHeating', 'option.crossingUtility.districtHeating')}
                        ${option('other', 'option.crossingUtility.other')}
                      </select>
                    </label>
                    <label class="gas-field" for="routeEventGasPositionSelect">
                      <span data-gas-i18n="field.crossingGasPosition"></span>
                      <select id="routeEventGasPositionSelect">
                        ${option('above', 'option.crossingPosition.above', true)}
                        ${option('below', 'option.crossingPosition.below')}
                      </select>
                    </label>
                    <label class="gas-field" for="routeEventClearanceInput">
                      <span data-gas-i18n="field.crossingClearance"></span>
                      <span class="gas-input-with-unit"><input id="routeEventClearanceInput" type="number" min="0" max="5" step="0.01" /><em>m</em></span>
                    </label>
                  </div>
                  <label class="gas-check-row" for="routeEventOwnerApprovalInput">
                    <input id="routeEventOwnerApprovalInput" type="checkbox" />
                    <span><b data-gas-i18n="field.crossingOwnerApproval"></b></span>
                  </label>
                </div>
                <label class="gas-check-row" for="routeEventSleeveInput">
                  <input id="routeEventSleeveInput" type="checkbox" />
                  <span><b data-gas-i18n="field.crossingSleeve"></b></span>
                </label>
                <label class="gas-check-row" for="routeEventConfirmedInput">
                  <input id="routeEventConfirmedInput" type="checkbox" />
                  <span><b data-gas-i18n="field.routeEventConfirmed"></b></span>
                </label>
                <button type="button" id="removeRouteEventButton" class="gas-route-event-remove" data-gas-i18n="action.removeRouteEvent"></button>
                <p class="gas-field-hint" data-gas-i18n="rule.routeEventsHint"></p>
              </div>
            </section>
          </div>
        </details>

        <details class="gas-panel">
          <summary><span data-gas-i18n="panel.data"></span><span class="gas-panel__chevron" aria-hidden="true"></span></summary>
          <div class="gas-panel__body">
            <label class="gas-field" for="groundSourceSelect"><span data-gas-i18n="field.groundSource"></span>
              <select id="groundSourceSelect">
                ${option('assumption', 'option.groundSource.assumption', true)}
                ${option('publicScreening', 'option.groundSource.publicScreening')}
                ${option('verifiedSurvey', 'option.groundSource.verifiedSurvey')}
              </select>
            </label>
            <label class="gas-field" for="utilitySourceSelect"><span data-gas-i18n="field.utilitySource"></span>
              <select id="utilitySourceSelect">
                ${option('missing', 'option.utilitySource.missing', true)}
                ${option('ownerPlan', 'option.utilitySource.ownerPlan')}
                ${option('fieldVerified', 'option.utilitySource.fieldVerified')}
              </select>
            </label>
            <div class="gas-field-grid">
              <label class="gas-field" for="startElevationInput"><span data-gas-i18n="field.startElevation"></span>
                <span class="gas-input-with-unit"><input id="startElevationInput" type="number" min="-50" max="2500" step="0.1" /><em>m</em></span>
              </label>
              <label class="gas-field" for="endElevationInput"><span data-gas-i18n="field.endElevation"></span>
                <span class="gas-input-with-unit"><input id="endElevationInput" type="number" min="-50" max="2500" step="0.1" /><em>m</em></span>
              </label>
            </div>
            <label class="gas-check-row" for="osdCapacityInput">
              <input id="osdCapacityInput" type="checkbox" />
              <span><b data-gas-i18n="field.osdCapacity"></b></span>
            </label>
            <p class="gas-field-hint" data-gas-i18n="hint.elevation"></p>
          </div>
        </details>

        <details class="gas-panel" open>
          <summary><span data-gas-i18n="panel.results"></span><span class="gas-panel__chevron" aria-hidden="true"></span></summary>
          <div class="gas-panel__body">
            <div class="gas-primary-result">
              <span data-gas-i18n="metric.costRange"></span>
              <strong id="costRangeResult">—</strong>
              <small data-gas-i18n="hint.cost"></small>
            </div>
            <div class="gas-metrics-grid">
              ${metric('routeLengthResult', 'metric.routeLength')}
              ${metric('designedPipeLengthResult', 'metric.designedPipeLength')}
              ${metric('pipeLengthResult', 'metric.pipeLength')}
              ${metric('excavationResult', 'metric.excavation')}
              ${metric('beddingResult', 'metric.bedding')}
              ${metric('backfillResult', 'metric.backfill')}
              ${metric('restorationResult', 'metric.restoration')}
              ${metric('dataConfidenceResult', 'metric.dataConfidence')}
            </div>
            <div class="gas-excavation-delta-row">
              <span data-gas-i18n="metric.excavationDelta"></span>
              <strong id="excavationDifferenceResult">—</strong>
              <small id="excavationDifferenceDetail">—</small>
            </div>
            <div class="gas-terrain-distance-row">
              <span data-gas-i18n="metric.terrainLength"></span>
              <strong id="terrainLengthResult">—</strong>
              <small id="terrainLengthDetail" data-gas-i18n="metric.terrainLengthPending"></small>
            </div>
            <div class="gas-throughput-row">
              <span data-gas-i18n="metric.throughput"></span>
              <strong id="throughputResult" data-gas-i18n="metric.throughputPending"></strong>
            </div>
          </div>
        </details>

        <details class="gas-panel" open>
          <summary>
            <span data-gas-i18n="panel.compliance"></span>
            <span id="validationSummary" class="gas-validation-count">—</span>
            <span class="gas-panel__chevron" aria-hidden="true"></span>
          </summary>
          <div class="gas-panel__body">
            <p class="gas-field-hint" data-gas-i18n="hint.compliance"></p>
            <div id="validationList" class="gas-validation-list" aria-live="polite"></div>
          </div>
        </details>
      </aside>

      <button id="gasSidebarToggle" class="shared-settings-toggle shared-settings-toggle--light" type="button" aria-label="Hide gas pipe settings" aria-expanded="true" title="Hide gas pipe settings">
        <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    </main>
  `;
}
