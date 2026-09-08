import * as THREE from 'three';
import { createPergolaGeometry } from './pergolaGeometry.js';
import { fitAssetToBox } from './AssetLibrary.js';
import {
  getBoundaryHeaterSegments,
  getHeaterConfig,
  getPoleGrid,
  getRoofRectangles,
  getSpotlightRectangleLayout,
  getSideSegmentConfig,
  poleFaceIsAvailable,
  poleIsAvailable,
  segmentIsAvailable,
} from '../state.js';

const METERS_PER_MM = 0.001;
const SCREEN_TYPES = ['screen', 'motorized-screen'];

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.5,
    metalness: options.metalness ?? 0.65,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
  });
}

function cloneFittedAsset(assets, key, targetSize, alignY = 'center') {
  const model = assets?.clone(key);
  if (!model) return null;
  return fitAssetToBox(model, targetSize, { alignY });
}

function addPost(geometry, group, x, z, height, size, frameMaterial, premium) {
  const post = geometry.box(size, height, size, frameMaterial, { edgeFinish: 'aluminium.frame', axis: 'y', role: 'post' });
  post.position.set(x, height / 2, z);
  group.add(post);

  const foot = geometry.box(size * 1.35, 0.025, size * 1.35, frameMaterial, {
    castShadow: false, edgeFinish: 'aluminium.trim', axis: 'y', role: 'foot',
  });
  foot.position.set(x, 0.0125, z);
  group.add(foot);

  if (premium) {
    const cap = geometry.box(size * 1.06, 0.045, size * 1.06, frameMaterial, { edgeFinish: 'aluminium.trim', axis: 'y', role: 'post-cap' });
    cap.position.set(x, height - 0.0225, z);
    group.add(cap);
  }
}

function addBeam(geometry, group, position, dimensions, frameMaterial, premium) {
  const beam = geometry.box(dimensions.x, dimensions.y, dimensions.z, frameMaterial, {
    edgeFinish: 'aluminium.frame', axis: dimensions.x > dimensions.z ? 'x' : 'z', role: 'beam',
  });
  beam.position.copy(position);
  group.add(beam);

  if (premium) {
    const trimMaterial = material('#111719', { roughness: 0.3, metalness: 0.8 });
    const trim = geometry.box(
      Math.max(0.015, dimensions.x - 0.018),
      0.025,
      Math.max(0.015, dimensions.z - 0.018),
      trimMaterial,
    );
    trim.position.set(position.x, position.y - dimensions.y / 2 + 0.026, position.z);
    group.add(trim);
  }
}

function addLouvers(geometry, group, state, width, depth, topY, louverMaterial) {
  const orientation = state.roof.orientation;
  const tilt = THREE.MathUtils.degToRad(state.roof.louverTilt);
  const bladeWidth = state.model === 'lite' ? 0.115 : 0.135;
  const thickness = state.model === 'premium' ? 0.045 : 0.038;
  const pitch = bladeWidth + 0.018;
  const margin = 0.19;

  if (orientation === 'width') {
    const count = Math.max(4, Math.floor((depth - margin * 2) / pitch));
    const usable = depth - margin * 2;
    for (let index = 0; index < count; index += 1) {
      const pivot = new THREE.Group();
      const z = -usable / 2 + (index + 0.5) * (usable / count);
      pivot.position.set(0, topY, z);
      pivot.rotation.x = tilt;
      const louver = geometry.box(width - margin * 2, thickness, bladeWidth, louverMaterial, { edgeFinish: 'aluminium.louver', axis: 'x', role: 'louver' });
      pivot.add(louver);
      group.add(pivot);
    }
  } else {
    const count = Math.max(4, Math.floor((width - margin * 2) / pitch));
    const usable = width - margin * 2;
    for (let index = 0; index < count; index += 1) {
      const pivot = new THREE.Group();
      const x = -usable / 2 + (index + 0.5) * (usable / count);
      pivot.position.set(x, topY, 0);
      pivot.rotation.z = -tilt;
      const louver = geometry.box(bladeWidth, thickness, depth - margin * 2, louverMaterial, { edgeFinish: 'aluminium.louver', axis: 'z', role: 'louver' });
      pivot.add(louver);
      group.add(pivot);
    }
  }
}

function addDrainage(geometry, group, state, width, depth, height, surfaces) {
  if (state.roof.drainage !== 'integrated') return;

  const gutterMaterial = surfaces ? surfaces.create('aluminium.powderCoated', { color: '#151d20' }) : material('#151d20', { roughness: 0.4, metalness: 0.75 });
  const gutter = geometry.box(width - 0.24, 0.06, 0.08, gutterMaterial, { edgeFinish: 'aluminium.trim', axis: 'x', role: 'gutter' });
  gutter.position.set(0, height - 0.19, depth / 2 - 0.13);
  group.add(gutter);

  if (state.model !== 'lite') {
    const pipe = geometry.cylinder(0.024, height - 0.22, gutterMaterial, 12);
    pipe.position.set(width / 2 - 0.085, (height - 0.22) / 2, depth / 2 - 0.085);
    group.add(pipe);
  }
}

function segmentTransform(state, segment, width, depth, height, postSize) {
  const coordinates = poleCoordinates(state, width, depth, postSize);
  const first = coordinates[segment.a];
  const second = coordinates[segment.b];
  if (!first || !second) return null;

  const top = height - 0.24;
  const bottom = 0.12;
  const usableHeight = top - bottom;
  const midpoint = first.clone().add(second).multiplyScalar(0.5);
  const distance = first.distanceTo(second);
  return {
    span: Math.max(0.18, distance - postSize - 0.04),
    position: new THREE.Vector3(midpoint.x, bottom + usableHeight / 2, midpoint.z),
    rotationY: segment.axis === 'horizontal' ? 0 : Math.PI / 2,
    usableHeight,
  };
}

function screenSettings(config) {
  return config.screenSettings?.[config.type] ?? {
    openness: 50,
    color: config.type === 'motorized-screen' ? '#34444c' : '#67757d',
  };
}

function addScreen(geometry, container, transform, config, motorized, assets) {
  const settings = screenSettings(config);
  const screenMaterial = material(settings.color, {
    roughness: 0.86,
    metalness: 0.02,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  });
  const cassetteMaterial = material('#202b30', { roughness: 0.42, metalness: 0.7 });
  const openness = THREE.MathUtils.clamp(settings.openness, 0, 100) / 100;
  const deployedHeight = transform.usableHeight * (1 - openness);

  const cassetteAsset = cloneFittedAsset(
    assets,
    'screenCassette',
    new THREE.Vector3(transform.span, 0.11, 0.13),
  );
  if (cassetteAsset) {
    cassetteAsset.position.set(0, transform.usableHeight / 2 - 0.055, 0);
    cassetteAsset.traverse((child) => {
      if (!child.isMesh) return;
      child.material = cassetteMaterial.clone();
      if (!motorized && /motor/i.test(child.name)) child.visible = false;
    });
    container.add(cassetteAsset);
  } else {
    const cassette = geometry.box(transform.span, 0.11, 0.12, cassetteMaterial);
    cassette.position.set(0, transform.usableHeight / 2 - 0.055, 0);
    container.add(cassette);
  }

  if (deployedHeight > 0.04) {
    const fabric = geometry.box(transform.span - 0.08, deployedHeight, 0.018, screenMaterial, {
      castShadow: false,
    });
    fabric.position.set(0, transform.usableHeight / 2 - 0.11 - deployedHeight / 2, 0);
    container.add(fabric);

    const bottomRail = geometry.box(transform.span - 0.06, 0.045, 0.045, cassetteMaterial);
    bottomRail.position.set(0, fabric.position.y - deployedHeight / 2, 0);
    container.add(bottomRail);
  }
}

function addPrivacyWall(geometry, container, transform, color, surfaces) {
  const slatMaterial = surfaces ? surfaces.create('aluminium.powderCoated', { color }) : material(color, { roughness: 0.42, metalness: 0.72 });
  const count = Math.max(8, Math.floor(transform.usableHeight / 0.14));
  const spacing = transform.usableHeight / count;
  for (let index = 0; index < count; index += 1) {
    const slat = geometry.box(transform.span - 0.06, 0.075, 0.055, slatMaterial, { edgeFinish: 'aluminium.louver', axis: 'x', role: 'privacy-slat' });
    slat.position.set(0, -transform.usableHeight / 2 + spacing * (index + 0.5), 0);
    slat.rotation.x = THREE.MathUtils.degToRad(-18);
    container.add(slat);
  }
}


function addGlass(geometry, container, transform, frameMaterial, surfaces) {
  const panelCount = Math.max(2, Math.round(transform.span / 1.25));
  const gap = 0.025;
  const panelWidth = (transform.span - gap * (panelCount - 1)) / panelCount;
  const glassMaterial = surfaces ? surfaces.create('glass.clear', { thickness: 0.008 }) : material('#b9d9e4', {
    roughness: 0.06,
    metalness: 0.02,
    transparent: true,
    opacity: 0.26,
    side: THREE.DoubleSide,
  });

  for (let index = 0; index < panelCount; index += 1) {
    const panel = geometry.panel(panelWidth - 0.018, transform.usableHeight - 0.1, 0.018, glassMaterial, {
      castShadow: false,
    });
    panel.position.set(
      -transform.span / 2 + panelWidth / 2 + index * (panelWidth + gap),
      0,
      0,
    );
    container.add(panel);

    const rail = geometry.box(0.025, transform.usableHeight - 0.06, 0.05, frameMaterial, { edgeFinish: 'aluminium.trim', axis: 'y', role: 'glazing-rail' });
    rail.position.set(-transform.span / 2 + index * (panelWidth + gap), 0, 0);
    container.add(rail);
  }

  const topRail = geometry.box(transform.span, 0.045, 0.07, frameMaterial, { edgeFinish: 'aluminium.trim', axis: 'x', role: 'glazing-rail' });
  topRail.position.y = transform.usableHeight / 2 - 0.0225;
  container.add(topRail);
  const bottomRail = topRail.clone();
  bottomRail.position.y = -transform.usableHeight / 2 + 0.0225;
  container.add(bottomRail);
}

function addSideClosings(geometry, group, state, width, depth, height, postSize, frameMaterial, assets, surfaces) {
  const grid = getPoleGrid(state);
  grid.segments.forEach((segment) => {
    const config = getSideSegmentConfig(state, segment.id);
    if (!config || config.type === 'none' || !segmentIsAvailable(state, segment.id)) return;

    const transform = segmentTransform(state, segment, width, depth, height, postSize);
    if (!transform) return;
    const container = new THREE.Group();
    container.position.copy(transform.position);
    container.rotation.y = transform.rotationY;

    if (SCREEN_TYPES.includes(config.type)) {
      addScreen(geometry, container, transform, config, config.type === 'motorized-screen', assets);
    } else if (config.type === 'privacy-wall') {
      addPrivacyWall(geometry, container, transform, config.privacyColor ?? state.roof.frameColor, surfaces);
    } else if (config.type === 'glass') {
      addGlass(geometry, container, transform, frameMaterial, surfaces);
    }

    group.add(container);
  });
}

function styleLedAsset(object, color) {
  const ledColor = new THREE.Color(color);
  object.traverse((child) => {
    if (!child.isMesh) return;
    if (/diffuser|led/i.test(child.name)) {
      child.material = new THREE.MeshStandardMaterial({
        color: ledColor,
        emissive: ledColor,
        emissiveIntensity: 4.5,
        roughness: 0.16,
        metalness: 0,
      });
    } else {
      child.material = new THREE.MeshStandardMaterial({
        color: '#b8c0c3',
        roughness: 0.32,
        metalness: 0.7,
      });
    }
  });
}

function addPerimeterLed(geometry, group, width, depth, height, ledConfig, assets, night = false) {
  const y = height - 0.225;
  const offset = 0.105;
  const specifications = [
    [new THREE.Vector3(width - 0.26, 0.018, 0.022), new THREE.Vector3(0, y, depth / 2 - offset), 0],
    [new THREE.Vector3(width - 0.26, 0.018, 0.022), new THREE.Vector3(0, y, -depth / 2 + offset), 0],
    [new THREE.Vector3(depth - 0.26, 0.018, 0.022), new THREE.Vector3(width / 2 - offset, y, 0), Math.PI / 2],
    [new THREE.Vector3(depth - 0.26, 0.018, 0.022), new THREE.Vector3(-width / 2 + offset, y, 0), Math.PI / 2],
  ];

  specifications.forEach(([size, position, rotationY]) => {
    const strip = cloneFittedAsset(assets, 'ledStrip', size);
    if (strip) {
      styleLedAsset(strip, ledConfig.color);
      strip.position.copy(position);
      strip.rotation.y = rotationY;
      group.add(strip);
    } else {
      const fallbackMaterial = material(ledConfig.color, {
        roughness: 0.15,
        metalness: 0,
        emissive: ledConfig.color,
        emissiveIntensity: 4,
      });
      const fallback = geometry.box(size.x, size.y, size.z, fallbackMaterial, { castShadow: false });
      fallback.position.copy(position);
      fallback.rotation.y = rotationY;
      group.add(fallback);
    }

    const ledLight = new THREE.PointLight(ledConfig.color, night ? 1.8 : 0.12, 4.6, 2);
    ledLight.position.copy(position);
    ledLight.position.y -= 0.08;
    group.add(ledLight);
  });
}

function styleSpotlight(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    if (/lens/i.test(child.name)) {
      child.material = material('#fff4c6', {
        roughness: 0.05,
        metalness: 0,
        emissive: '#ffdf7a',
        emissiveIntensity: 3,
      });
    } else {
      child.material = material('#111719', { roughness: 0.3, metalness: 0.7 });
    }
  });
}

function addSpotlights(geometry, group, state, coordinates, height, beamHeight, frameMaterial, assets, night = false, surfaces = null) {
  const railY = height - beamHeight - 0.022;
  const lightY = railY - 0.016;
  // Allocate only when a rail is actually added; disabled spotlights must not
  // leave an unattached managed material behind on every rebuild.
  let railMaterial = null;

  getRoofRectangles(state).forEach((rectangle) => {
    const layout = getSpotlightRectangleLayout(state, rectangle.id);
    if (!layout.count) return;

    const frontLeft = coordinates[rectangle.frontLeft];
    const frontRight = coordinates[rectangle.frontRight];
    const backLeft = coordinates[rectangle.backLeft];
    if (!frontLeft || !frontRight || !backLeft) return;

    const minX = Math.min(frontLeft.x, frontRight.x) + 0.34;
    const maxX = Math.max(frontLeft.x, frontRight.x) - 0.34;
    const minZ = Math.min(frontLeft.z, backLeft.z) + 0.34;
    const maxZ = Math.max(frontLeft.z, backLeft.z) - 0.34;
    const safeMinX = minX < maxX ? minX : (frontLeft.x + frontRight.x) / 2;
    const safeMaxX = minX < maxX ? maxX : safeMinX;
    const safeMinZ = minZ < maxZ ? minZ : (frontLeft.z + backLeft.z) / 2;
    const safeMaxZ = minZ < maxZ ? maxZ : safeMinZ;

    if (!railMaterial) {
      railMaterial = surfaces ? surfaces.clone(frameMaterial) : frameMaterial.clone();
      railMaterial.color.offsetHSL(0, -0.02, 0.04);
    }
    const rowPositions = layout.usedRows <= 1
      ? [(safeMinZ + safeMaxZ) / 2]
      : Array.from({ length: layout.usedRows }, (_, index) => THREE.MathUtils.lerp(
        safeMinZ,
        safeMaxZ,
        index / (layout.usedRows - 1),
      ));

    rowPositions.forEach((z) => {
      const rail = geometry.box(Math.max(0.18, safeMaxX - safeMinX + 0.18), 0.035, 0.045, railMaterial);
      rail.position.set((safeMinX + safeMaxX) / 2, railY, z);
      group.add(rail);
    });

    let created = 0;
    for (let row = 0; row < layout.usedRows && created < layout.count; row += 1) {
      const remaining = layout.count - created;
      const lightsInRow = Math.min(layout.usedColumns, remaining);
      const xPositions = lightsInRow <= 1
        ? [(safeMinX + safeMaxX) / 2]
        : Array.from({ length: lightsInRow }, (_, index) => THREE.MathUtils.lerp(
          safeMinX,
          safeMaxX,
          index / (lightsInRow - 1),
        ));

      xPositions.forEach((x) => {
        const z = rowPositions[row];
        const model = cloneFittedAsset(assets, 'spotlight', new THREE.Vector3(0.14, 0.065, 0.14));
        if (model) {
          styleSpotlight(model);
          model.position.set(x, lightY, z);
          group.add(model);
        } else {
          const body = geometry.cylinder(0.055, 0.035, material('#111719'), 20);
          body.position.set(x, lightY, z);
          group.add(body);
        }
        const downlight = new THREE.SpotLight(0xffefc2, night ? 4.2 : 0.08, 3.6, Math.PI / 5, 0.48, 1.6);
        downlight.position.set(x, lightY - 0.005, z);
        downlight.target.position.set(x, 0, z);
        group.add(downlight);
        group.add(downlight.target);
        created += 1;
      });
    }
  });
}


function styleHeater(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    if (/element/i.test(child.name)) {
      child.material = material('#ef7b21', {
        roughness: 0.32,
        metalness: 0.1,
        emissive: '#e84c16',
        emissiveIntensity: 2.8,
      });
    } else {
      child.material = material('#171b1d', { roughness: 0.38, metalness: 0.7 });
    }
  });
}

function addHeaterBrackets(geometry, group, segment, heaterPosition, height, beamHeight, frameMaterial, surfaces) {
  const beamBottom = height - beamHeight + 0.012;
  const heaterTop = heaterPosition.y + 0.095;
  const rodThickness = 0.022;
  const hangerMaterial = surfaces ? surfaces.clone(frameMaterial) : frameMaterial.clone();
  hangerMaterial.color.offsetHSL(0, -0.03, 0.03);

  const alongX = segment.axis === 'horizontal';
  const rail = geometry.box(alongX ? 0.76 : 0.045, rodThickness, alongX ? 0.045 : 0.76, hangerMaterial);
  rail.position.set(heaterPosition.x, heaterTop + 0.004, heaterPosition.z);
  group.add(rail);

  [-0.29, 0.29].forEach((offset) => {
    const x = heaterPosition.x + (alongX ? offset : 0);
    const z = heaterPosition.z + (alongX ? 0 : offset);
    const rod = geometry.box(rodThickness, Math.max(0.03, beamBottom - heaterTop), rodThickness, hangerMaterial);
    rod.position.set(x, (heaterTop + beamBottom) / 2, z);
    group.add(rod);
  });
}

function addHeaters(geometry, group, state, coordinates, height, beamHeight, frameMaterial, assets, surfaces) {
  const faceOffset = 0.18;
  const heaterY = height - beamHeight - 0.235;

  const directionPose = (segment, direction) => {
    if (segment.axis === 'horizontal') {
      return direction === 'first'
        ? { offset: new THREE.Vector3(0, 0, faceOffset), rotationY: 0 }
        : { offset: new THREE.Vector3(0, 0, -faceOffset), rotationY: Math.PI };
    }
    return direction === 'first'
      ? { offset: new THREE.Vector3(-faceOffset, 0, 0), rotationY: -Math.PI / 2 }
      : { offset: new THREE.Vector3(faceOffset, 0, 0), rotationY: Math.PI / 2 };
  };

  getBoundaryHeaterSegments(state).forEach((segment) => {
    const config = getHeaterConfig(state, segment.id);
    if (!config) return;
    const a = coordinates[segment.a];
    const b = coordinates[segment.b];
    if (!a || !b) return;

    // Every heater is centered between its two poles. A segment may carry one
    // heater on either beam face or a pair facing opposite directions.
    const center = a.clone().lerp(b, 0.5);
    center.y = heaterY;

    ['first', 'second'].forEach((direction) => {
      if (!config[direction]) return;
      const pose = directionPose(segment, direction);
      const position = center.clone().add(pose.offset);
      const heater = cloneFittedAsset(assets, 'heater', new THREE.Vector3(0.92, 0.18, 0.17));
      if (!heater) return;
      styleHeater(heater);
      heater.position.copy(position);
      heater.rotation.y = pose.rotationY;
      group.add(heater);
      addHeaterBrackets(geometry, group, segment, position, height, beamHeight, frameMaterial, surfaces);
    });
  });
}


function styleWeatherSensor(model, type) {
  model.traverse((child) => {
    if (!child.isMesh) return;
    child.material = type === 'rain'
      ? material(/cap|grid/i.test(child.name) ? '#e8eceb' : '#263238', { roughness: 0.45, metalness: 0.35 })
      : material(/arm/i.test(child.name) ? '#98a4a9' : '#222a2e', { roughness: 0.42, metalness: 0.5 });
  });
}

function addSensors(geometry, group, state, coordinates, height, postSize, assets) {
  const sensors = state.accessories.sensors;
  const mountMaterial = material('#2b353a', { roughness: 0.38, metalness: 0.68 });

  const addSensor = (type, key, size) => {
    const config = sensors[type];
    if (!config?.enabled || !config.pole || !coordinates[config.pole]) return;
    const pole = coordinates[config.pole];
    const plateSize = Math.max(0.16, postSize * 1.04);
    const plate = geometry.box(plateSize, 0.025, plateSize, mountMaterial);
    plate.position.set(pole.x, height + 0.012, pole.z);
    group.add(plate);

    const sensor = cloneFittedAsset(assets, key, size, 'bottom');
    if (!sensor) return;
    styleWeatherSensor(sensor, type);
    sensor.position.set(pole.x, height + 0.035, pole.z);
    group.add(sensor);
  };

  addSensor('rain', 'rainSensor', new THREE.Vector3(0.16, 0.105, 0.16));
  addSensor('wind', 'windSensor', new THREE.Vector3(0.27, 0.31, 0.28));
}


function poleCoordinates(state, width, depth, postSize) {
  const grid = getPoleGrid(state);
  const xLeft = -width / 2 + postSize / 2;
  const xRight = width / 2 - postSize / 2;
  const zFront = depth / 2 - postSize / 2;
  const zBack = -depth / 2 + postSize / 2;
  const coordinates = {};
  grid.poles.forEach((pole) => {
    const x = THREE.MathUtils.lerp(xLeft, xRight, pole.xRatio);
    const z = THREE.MathUtils.lerp(zFront, zBack, pole.zRatio);
    coordinates[pole.id] = new THREE.Vector3(x, 0, z);
  });
  return coordinates;
}

function faceVector(face) {
  return {
    front: new THREE.Vector3(0, 0, 1),
    right: new THREE.Vector3(1, 0, 0),
    back: new THREE.Vector3(0, 0, -1),
    left: new THREE.Vector3(-1, 0, 0),
  }[face];
}

function faceRotation(face) {
  return {
    front: 0,
    right: Math.PI / 2,
    back: Math.PI,
    left: -Math.PI / 2,
  }[face];
}

function placeOnPole(model, base, face, height, postSize, depthOffset = 0.018) {
  const outward = faceVector(face);
  model.position.copy(base).addScaledVector(outward, postSize / 2 + depthOffset);
  model.position.y = height;
  model.rotation.y = faceRotation(face);
}

function styleSpeakerModel(model) {
  model.traverse((child) => {
    if (!child.isMesh) return;
    child.material = material(/grille|driver/i.test(child.name) ? '#3b454a' : '#171d20', {
      roughness: 0.44,
      metalness: 0.45,
    });
  });
}


function buildOutletModel(geometry, type) {
  const outlet = new THREE.Group();
  const plateMaterial = material('#f0f1ed', { roughness: 0.64, metalness: 0.06 });
  const insertMaterial = material('#f7f7f4', { roughness: 0.58, metalness: 0.04 });
  const holeMaterial = material('#1e2529', { roughness: 0.88, metalness: 0.02 });

  const basePlate = geometry.box(0.108, 0.148, 0.012, plateMaterial, { castShadow: false });
  outlet.add(basePlate);
  const innerPlate = geometry.box(0.082, 0.122, 0.006, insertMaterial, { castShadow: false });
  innerPlate.position.z = 0.009;
  outlet.add(innerPlate);

  const addHoleCylinder = (radius, x, y) => {
    const hole = geometry.cylinder(radius, 0.004, holeMaterial, 20);
    hole.rotation.z = Math.PI / 2;
    hole.position.set(x, y, 0.0135);
    outlet.add(hole);
  };

  const addHoleSlot = (w, h, x, y, rotation = 0) => {
    const slot = geometry.box(w, h, 0.004, holeMaterial, { castShadow: false });
    slot.position.set(x, y, 0.0135);
    slot.rotation.z = rotation;
    outlet.add(slot);
  };

  if (type === 'us') {
    const socketYs = [0.031, -0.031];
    socketYs.forEach((centerY) => {
      const bezel = geometry.box(0.047, 0.043, 0.0035, material('#ebece8', { roughness: 0.55, metalness: 0.03 }), { castShadow: false });
      bezel.position.set(0, centerY, 0.0122);
      outlet.add(bezel);
      addHoleSlot(0.007, 0.018, -0.011, centerY + 0.002, 0);
      addHoleSlot(0.007, 0.018, 0.011, centerY + 0.002, 0);
      addHoleCylinder(0.0045, 0, centerY - 0.010);
    });
  } else {
    const bezel = geometry.box(0.055, 0.055, 0.0035, material('#ebece8', { roughness: 0.55, metalness: 0.03 }), { castShadow: false });
    bezel.position.set(0, 0.006, 0.0122);
    outlet.add(bezel);
    addHoleCylinder(0.0068, -0.015, 0.006);
    addHoleCylinder(0.0068, 0.015, 0.006);
    addHoleSlot(0.009, 0.018, 0, -0.012, 0);
    const earthLip = geometry.box(0.038, 0.006, 0.003, material('#c8cbc7', { roughness: 0.6 }), { castShadow: false });
    earthLip.position.set(0, 0.032, 0.012);
    outlet.add(earthLip);
  }
  return outlet;
}

function styleAutomationAsset(model) {
  model.traverse((child) => {
    if (!child.isMesh) return;
    child.material = material(/button/i.test(child.name) ? '#0878c9' : /face/i.test(child.name) ? '#eceeea' : '#566168', {
      roughness: /metal|rod|eye|grip/i.test(child.name) ? 0.28 : 0.58,
      metalness: /metal|rod|eye/i.test(child.name) ? 0.75 : 0.12,
    });
  });
}

function addMotorizedAutomation(geometry, group, state, width, depth, height) {
  if (state.automation === 'manual') return;
  const motorMaterial = material('#111719', { roughness: 0.35, metalness: 0.75 });
  const motor = geometry.box(0.34, 0.13, 0.13, motorMaterial);
  motor.position.set(width / 2 - 0.32, height - 0.11, -depth / 2 + 0.13);
  group.add(motor);
}

function addPoleMounts(geometry, group, state, width, depth, height, postSize, assets) {
  const coordinates = poleCoordinates(state, width, depth, postSize);

  Object.entries(state.poleMounts ?? {}).forEach(([pole, faces]) => {
    if (!poleIsAvailable(state, pole) || !coordinates[pole]) return;
    Object.entries(faces ?? {}).forEach(([face, mounts]) => {
      if (!poleFaceIsAvailable(state, pole, face)) return;
      Object.values(mounts ?? {}).forEach((mount) => {
        if (!mount) return;
        const mountHeight = height * (Number(mount.height) / 100);
        let model = null;
        let depthOffset = 0.02;

        if (mount.type === 'speaker') {
          model = cloneFittedAsset(assets, 'speaker', new THREE.Vector3(0.17, 0.24, 0.16));
          if (model) styleSpeakerModel(model);
          depthOffset = 0.045;
        } else if (mount.type === 'outlet') {
          model = buildOutletModel(geometry, mount.outletType === 'us' ? 'us' : 'eu');
          depthOffset = 0.006;
        } else if (mount.type === 'hand-crank') {
          model = cloneFittedAsset(assets, 'handCrank', new THREE.Vector3(0.23, 0.78, 0.12));
          if (model) styleAutomationAsset(model);
          depthOffset = 0.07;
        } else if (mount.type === 'switch') {
          model = cloneFittedAsset(assets, 'wallSwitch', new THREE.Vector3(0.085, 0.14, 0.045));
          if (model) styleAutomationAsset(model);
          depthOffset = 0.025;
        }

        if (!model) return;
        placeOnPole(model, coordinates[pole], face, mountHeight, postSize, depthOffset);
        group.add(model);
      });
    });
  });
}


export function buildPergola(state, assets = null, surfaces = null, geometryLibrary = null) {
  const geometry = createPergolaGeometry(geometryLibrary);
  const group = new THREE.Group();
  group.name = 'Pergola';

  const width = state.dimensions.width * METERS_PER_MM;
  const depth = state.dimensions.depth * METERS_PER_MM;
  const height = state.dimensions.height * METERS_PER_MM;

  const isPremium = state.model === 'premium';
  const postSize = state.model === 'lite' ? 0.115 : state.model === 'comfort' ? 0.135 : 0.15;
  const beamHeight = state.model === 'lite' ? 0.16 : state.model === 'comfort' ? 0.19 : 0.215;
  const beamDepth = state.model === 'lite' ? 0.13 : 0.155;
  const frameMaterial = surfaces ? surfaces.create('aluminium.powderCoated', { color: state.roof.frameColor }) : material(state.roof.frameColor, {
    roughness: 0.36,
    metalness: 0.78,
  });
  const louverMaterial = surfaces ? surfaces.create('aluminium.powderCoated', { color: state.roof.louverColor }) : material(state.roof.louverColor, {
    roughness: 0.38,
    metalness: 0.72,
  });

  const grid = getPoleGrid(state);
  const coordinates = poleCoordinates(state, width, depth, postSize);
  Object.entries(coordinates).forEach(([key, position]) => {
    if (!poleIsAvailable(state, key)) return;
    addPost(geometry, group, position.x, position.z, height, postSize, frameMaterial, isPremium);
  });

  const beamY = height - beamHeight / 2;
  for (let row = 0; row < grid.rows; row += 1) {
    const rowPole = grid.poles.find((item) => item.row === row && item.column === 0);
    const z = coordinates[rowPole?.id]?.z ?? 0;
    addBeam(geometry, group, new THREE.Vector3(0, beamY, z), new THREE.Vector3(width, beamHeight, beamDepth), frameMaterial, isPremium);
  }
  for (let column = 0; column < grid.columns; column += 1) {
    const columnPole = grid.poles.find((item) => item.row === 0 && item.column === column);
    const x = coordinates[columnPole?.id]?.x ?? 0;
    addBeam(geometry, group, new THREE.Vector3(x, beamY, 0), new THREE.Vector3(beamDepth, beamHeight, depth), frameMaterial, isPremium);
  }

  addLouvers(geometry, group, state, width, depth, height - beamHeight - 0.015, louverMaterial);
  addDrainage(geometry, group, state, width, depth, height, surfaces);
  addSideClosings(geometry, group, state, width, depth, height, postSize, frameMaterial, assets, surfaces);
  addMotorizedAutomation(geometry, group, state, width, depth, height);

  const isNight = Boolean(state.environment?.night);
  if (state.accessories.perimeterLed.enabled) {
    addPerimeterLed(geometry, group, width, depth, height, state.accessories.perimeterLed, assets, isNight);
  }
  addSpotlights(geometry, group, state, coordinates, height, beamHeight, frameMaterial, assets, isNight, surfaces);
  addHeaters(geometry, group, state, coordinates, height, beamHeight, frameMaterial, assets, surfaces);
  addSensors(geometry, group, state, coordinates, height, postSize, assets);
  addPoleMounts(geometry, group, state, width, depth, height, postSize, assets);

  group.userData.dimensions = { width, depth, height };
  group.userData.postSize = postSize;
  return group;
}
