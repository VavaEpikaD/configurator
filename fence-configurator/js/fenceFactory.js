import * as THREE from 'three';
import { calculateClosedFenceGeometry, calculateClosedFiveFenceGeometry, deriveFenceMetrics } from './state.js?v=5';

import { DEFAULT_FENCE_FINISHES, resolveFenceFinish } from './finish-catalog.js?v=1';

const TEXTURE_LOADER = new THREE.TextureLoader();
const TEXTURE_CACHE = new Map();

function surfaceTexture(path, { color = false, repeatX = 1, repeatY = 1 } = {}) {
  const key = `${path}:${color}:${repeatX}:${repeatY}`;
  if (TEXTURE_CACHE.has(key)) return TEXTURE_CACHE.get(key);
  const texture = TEXTURE_LOADER.load(path);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  TEXTURE_CACHE.set(key, texture);
  return texture;
}

// White is the original wood texture's neutral multiplier. A relative tint
// makes edits visible without replacing the wood grain, normals or roughness.
function woodFinishTint(color) {
  const tint = new THREE.Color(color);
  const reference = new THREE.Color(DEFAULT_FENCE_FINISHES.wood.color);
  return tint.setRGB(tint.r / reference.r, tint.g / reference.g, tint.b / reference.b);
}

const POST_SIZE = 0.085;
const PANEL_THICKNESS = 0.045;
const CLEARANCE = 0.07;
export const GRADE_Y = 0;
const BASE_PLATE_HEIGHT = 0.018;
const CONCRETE_FOOTING_HEIGHT = 0.32;
// Only a small pedestal remains above finished grade. The rest of the
// concrete footing is buried so it cannot intersect the lower fence/gate
// rails while still remaining visibly supported.
const CONCRETE_EXPOSED_HEIGHT = 0.065;
const CONCRETE_POST_EMBED_DEPTH = 0.16;

export function buildFenceAssembly(state) {
  const metrics = deriveFenceMetrics(state);
  const root = new THREE.Group();
  root.name = 'fence-configurator-assembly';
  const finish = resolveFenceFinish(state);
  const isWood = state.finish === 'wood';
  const isBronze = state.finish === 'bronze';
  const woodColor = isWood ? surfaceTexture('/textures/pbr/fence-wood-color.jpg', { color: true }) : null;
  const woodNormal = isWood ? surfaceTexture('/textures/pbr/fence-wood-normal.jpg') : null;
  const woodRoughness = isWood ? surfaceTexture('/textures/pbr/fence-wood-roughness.jpg') : null;
  const finishMaterial = new THREE.MeshPhysicalMaterial({
    color: isWood ? woodFinishTint(finish.color) : finish.color,
    map: woodColor,
    normalMap: woodNormal,
    roughnessMap: woodRoughness,
    roughness: isWood ? 0.56 : isBronze ? 0.27 : 0.46,
    // Bronze here is a coloured powder coat, not bare copper. Keeping the
    // metallic response restrained preserves the bronze body colour while the
    // clear coat carries the studio highlight at the default camera.
    metalness: isWood ? 0.01 : isBronze ? 0.14 : 0.24,
    clearcoat: isWood ? 0.14 : isBronze ? 0.52 : 0.22,
    clearcoatRoughness: isWood ? 0.56 : isBronze ? 0.18 : 0.54,
    envMapIntensity: isWood ? 0.86 : isBronze ? 1.28 : 0.86,
  });
  if (isWood) finishMaterial.normalScale.set(0.16, 0.16);
  const darkMaterial = new THREE.MeshPhysicalMaterial({ color: 0x151b20, roughness: 0.34, metalness: 0.72, clearcoat: 0.18, clearcoatRoughness: 0.42 });
  const meshMaterial = finishMaterial;
  const footingMaterial = state.foundation === 'baseplate'
    ? new THREE.MeshPhysicalMaterial({ color: 0x4a555d, roughness: 0.38, metalness: 0.78, clearcoat: 0.12, clearcoatRoughness: 0.55 })
    : new THREE.MeshStandardMaterial({ color: 0xa7a49c, roughness: 0.98, metalness: 0 });

  const fenceGroup = new THREE.Group();
  fenceGroup.name = 'fence';
  root.add(fenceGroup);

  const runSegments = buildRunSegments(state, metrics.runs);
  const postMap = new Map();
  runSegments.forEach((run) => {
    run.points.forEach((point, pointIndex) => {
      const isInternalDrivewayPost = metrics.gates.some((gate) => (
        gate.runId === run.id
        && gate.span > 1
        && pointIndex > gate.startBay
        && pointIndex < gate.startBay + gate.span
      ));
      if (!isInternalDrivewayPost) postMap.set(pointKey(point), point);
    });
  });

  postMap.forEach((point) => {
    const postTop = state.height + 0.04;
    const postBottom = state.foundation === 'baseplate'
      ? GRADE_Y + BASE_PLATE_HEIGHT
      : GRADE_Y - CONCRETE_POST_EMBED_DEPTH;
    const postHeight = postTop - postBottom;
    const post = boxMesh(POST_SIZE, postHeight, POST_SIZE, finishMaterial, point.x, postBottom + postHeight / 2, point.z);
    post.name = 'post';
    markFence(post);
    fenceGroup.add(post);

    if (state.foundation === 'baseplate') {
      const plate = boxMesh(0.19, BASE_PLATE_HEIGHT, 0.19, footingMaterial, point.x, GRADE_Y + BASE_PLATE_HEIGHT / 2, point.z);
      plate.name = 'base-plate';
      markFence(plate);
      fenceGroup.add(plate);
      addAnchorBolts(fenceGroup, point, darkMaterial);
    } else {
      const footing = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, CONCRETE_FOOTING_HEIGHT, 18), footingMaterial);
      // Keep only a short concrete pedestal above grade. The footing is still
      // full-depth, but most of it is buried; this prevents the wide tapered
      // concrete from intersecting the bottom rail, slats, or gate frame.
      const footingCenterY = GRADE_Y + CONCRETE_EXPOSED_HEIGHT - CONCRETE_FOOTING_HEIGHT / 2;
      footing.position.set(point.x, footingCenterY, point.z);
      footing.name = 'concrete-footing';
      markFence(footing);
      fenceGroup.add(footing);
    }
  });

  runSegments.forEach((run) => {
    const runGates = metrics.gates.filter((gate) => gate.runId === run.id);
    for (let bayIndex = 0; bayIndex < run.points.length - 1; bayIndex += 1) {
      const p0 = run.points[bayIndex];
      const p1 = run.points[bayIndex + 1];
      const gate = runGates.find((candidate) => bayIndex >= candidate.startBay && bayIndex < candidate.startBay + candidate.span);
      if (gate) {
        if (bayIndex === gate.startBay) {
          const gateEnd = run.points[gate.startBay + gate.span];
          buildGate(fenceGroup, p0, gateEnd, state, gate, finishMaterial, darkMaterial);
        }
        continue;
      }
      buildPanel(fenceGroup, p0, p1, state, finishMaterial, meshMaterial);
    }
  });

  addPostCaps(fenceGroup, postMap, state.height, darkMaterial);
  const edges = buildTechnicalEdges(fenceGroup);
  edges.name = 'technical-edges';
  edges.visible = Boolean(state.technicalEdges);
  root.add(edges);

  return { root, fenceGroup, edges, metrics, runSegments, bounds: calculateBounds(root) };
}

function buildRunSegments(state, runs) {
  if (state.layout === 'closed' || state.layout === 'closed5') return buildClosedRunSegments(state, runs);

  const result = [];
  let start = new THREE.Vector3(0, 0, 0);
  let direction = new THREE.Vector3(1, 0, 0);
  runs.forEach((run, index) => {
    if (index === 1) direction = new THREE.Vector3(0, 0, 1);
    if (index === 2) direction = new THREE.Vector3(-1, 0, 0);
    const points = [];
    for (let i = 0; i <= run.bayCount; i += 1) {
      points.push(start.clone().addScaledVector(direction, run.bayWidth * i));
    }
    result.push({ ...run, start: start.clone(), direction: direction.clone(), points });
    start = points[points.length - 1].clone();
  });
  return result;
}

function buildClosedRunSegments(state, runs) {
  const geometry = state.layout === 'closed5'
    ? calculateClosedFiveFenceGeometry(state)
    : calculateClosedFenceGeometry(state);
  const rawVertices = state.layout === 'closed5'
    ? [geometry.A, geometry.B, geometry.C, geometry.D, geometry.E, geometry.A]
    : [geometry.A, geometry.B, geometry.C, geometry.D, geometry.A];
  const vertices = rawVertices.map((point) => new THREE.Vector3(point.x, 0, point.z));

  return runs.map((run, index) => {
    const start = vertices[index].clone();
    const end = vertices[index + 1].clone();
    const direction = end.clone().sub(start).normalize();
    const points = [];
    for (let i = 0; i <= run.bayCount; i += 1) {
      // Use interpolation against the exact end point rather than accumulating
      // bay widths, so the final DA corner is guaranteed to land exactly on A.
      points.push(start.clone().lerp(end, i / run.bayCount));
    }
    return { ...run, start, direction, points };
  });
}

function buildPanel(group, p0, p1, state, finishMaterial, meshMaterial) {
  const bayLength = p0.distanceTo(p1);
  const clearLength = Math.max(0.25, bayLength - POST_SIZE - CLEARANCE);
  const center = p0.clone().lerp(p1, 0.5);
  const angle = segmentAngle(p0, p1);
  const bottom = 0.11;
  const clearHeight = Math.max(0.45, state.height - bottom - 0.08);

  if (state.panelStyle === 'privacy') {
    const panel = boxMesh(clearLength, clearHeight, PANEL_THICKNESS, finishMaterial, center.x, bottom + clearHeight / 2, center.z, angle);
    panel.name = 'privacy-panel';
    markFence(panel);
    group.add(panel);
    addPanelRails(group, p0, p1, clearLength, state, finishMaterial, center, angle, bottom, clearHeight);
    return;
  }

  if (state.panelStyle === 'mesh') {
    buildMeshPanel(group, p0, p1, clearLength, clearHeight, bottom, center, angle, meshMaterial);
    return;
  }

  addPanelRails(group, p0, p1, clearLength, state, finishMaterial, center, angle, bottom, clearHeight);
  if (state.panelStyle === 'vertical') {
    const slatWidth = 0.075;
    const pitch = Math.max(slatWidth + state.infillGap, 0.09);
    const count = Math.max(2, Math.floor((clearLength + state.infillGap) / pitch));
    const actualPitch = clearLength / count;
    for (let index = 0; index < count; index += 1) {
      const offset = -clearLength / 2 + actualPitch * (index + 0.5);
      const point = worldFromLocal(center, angle, offset, 0);
      const slat = boxMesh(Math.min(slatWidth, actualPitch * 0.74), clearHeight - 0.11, PANEL_THICKNESS, finishMaterial, point.x, bottom + clearHeight / 2, point.z, angle);
      slat.name = 'vertical-slat';
      markFence(slat);
      group.add(slat);
    }
  } else {
    const slatHeight = 0.105;
    const pitch = Math.max(slatHeight + state.infillGap, 0.125);
    const count = Math.max(2, Math.floor((clearHeight + state.infillGap) / pitch));
    const actualPitch = clearHeight / count;
    for (let index = 0; index < count; index += 1) {
      const y = bottom + actualPitch * (index + 0.5);
      const slat = boxMesh(clearLength, Math.min(slatHeight, actualPitch * 0.76), PANEL_THICKNESS, finishMaterial, center.x, y, center.z, angle);
      slat.name = 'horizontal-slat';
      markFence(slat);
      group.add(slat);
    }
  }
}

function addPanelRails(group, _p0, _p1, length, _state, material, center, angle, bottom, clearHeight) {
  [bottom + 0.055, bottom + clearHeight - 0.055].forEach((y) => {
    const rail = boxMesh(length, 0.055, 0.06, material, center.x, y, center.z, angle);
    rail.name = 'panel-rail';
    markFence(rail);
    group.add(rail);
  });
}

function buildMeshPanel(group, p0, p1, clearLength, clearHeight, bottom, center, angle, material) {
  const frameSize = 0.036;
  const sideA = worldFromLocal(center, angle, -clearLength / 2 + frameSize / 2, 0);
  const sideB = worldFromLocal(center, angle, clearLength / 2 - frameSize / 2, 0);
  [sideA, sideB].forEach((point) => {
    const bar = boxMesh(frameSize, clearHeight, 0.045, material, point.x, bottom + clearHeight / 2, point.z, angle);
    bar.name = 'mesh-frame'; markFence(bar); group.add(bar);
  });
  [bottom + frameSize / 2, bottom + clearHeight - frameSize / 2].forEach((y) => {
    const bar = boxMesh(clearLength, frameSize, 0.045, material, center.x, y, center.z, angle);
    bar.name = 'mesh-frame'; markFence(bar); group.add(bar);
  });
  const verticalCount = Math.max(4, Math.floor(clearLength / 0.22));
  const horizontalCount = Math.max(4, Math.floor(clearHeight / 0.2));
  for (let i = 1; i < verticalCount; i += 1) {
    const point = worldFromLocal(center, angle, -clearLength / 2 + (clearLength * i) / verticalCount, 0);
    const wire = boxMesh(0.012, clearHeight - 0.055, 0.018, material, point.x, bottom + clearHeight / 2, point.z, angle);
    wire.name = 'mesh-wire'; markFence(wire); group.add(wire);
  }
  for (let i = 1; i < horizontalCount; i += 1) {
    const wire = boxMesh(clearLength - 0.055, 0.012, 0.018, material, center.x, bottom + (clearHeight * i) / horizontalCount, center.z, angle);
    wire.name = 'mesh-wire'; markFence(wire); group.add(wire);
  }
  void p0; void p1;
}

function buildGate(group, p0, p1, state, gate, finishMaterial, hardwareMaterial) {
  const total = p0.distanceTo(p1);
  const clear = Math.max(0.65, total - POST_SIZE - 0.085);
  const center = p0.clone().lerp(p1, 0.5);
  const angle = segmentAngle(p0, p1);
  const bottom = 0.075;
  const gateHeight = Math.max(0.65, state.height - 0.13);

  if (gate.type === 'driveway') {
    const leafGap = 0.026;
    const leafWidth = (clear - leafGap) / 2;
    [-1, 1].forEach((side) => {
      const localX = side * (leafWidth + leafGap) / 2;
      const leafCenter = worldFromLocal(center, angle, localX, 0.015);
      buildGateLeaf(group, leafCenter, angle, leafWidth, gateHeight, bottom, state, finishMaterial, hardwareMaterial, side < 0 ? 'left' : 'right');
    });
  } else {
    buildGateLeaf(group, center, angle, clear, gateHeight, bottom, state, finishMaterial, hardwareMaterial, gate.handing);
  }
}

function buildGateLeaf(group, center, angle, width, height, bottom, state, finishMaterial, hardwareMaterial, handing) {
  const frame = new THREE.Group();
  frame.name = 'gate-leaf';
  const frameSize = 0.052;
  const xPositions = [-width / 2 + frameSize / 2, width / 2 - frameSize / 2];
  xPositions.forEach((x) => {
    const point = worldFromLocal(center, angle, x, 0);
    const bar = boxMesh(frameSize, height, 0.065, finishMaterial, point.x, bottom + height / 2, point.z, angle);
    markFence(bar); frame.add(bar);
  });
  [bottom + frameSize / 2, bottom + height - frameSize / 2].forEach((y) => {
    const bar = boxMesh(width, frameSize, 0.065, finishMaterial, center.x, y, center.z, angle);
    markFence(bar); frame.add(bar);
  });

  const innerWidth = Math.max(0.18, width - frameSize * 2.35);
  const innerHeight = Math.max(0.3, height - frameSize * 2.6);
  const panelP0 = worldFromLocal(center, angle, -innerWidth / 2, 0);
  const panelP1 = worldFromLocal(center, angle, innerWidth / 2, 0);
  const leafState = { ...state, height: innerHeight + 0.12 };
  const insert = new THREE.Group();
  buildPanel(insert, panelP0, panelP1, leafState, finishMaterial, finishMaterial);
  insert.position.y += bottom - 0.11;
  frame.add(insert);

  const handleSide = handing === 'left' ? 0.34 : -0.34;
  const handlePoint = worldFromLocal(center, angle, width * handleSide, 0.052);
  const handle = boxMesh(0.026, 0.23, 0.038, hardwareMaterial, handlePoint.x, bottom + height * 0.54, handlePoint.z, angle);
  handle.name = 'gate-handle'; markFence(handle); frame.add(handle);

  group.add(frame);
}

function addPostCaps(group, postMap, height, material) {
  postMap.forEach((point) => {
    const cap = boxMesh(POST_SIZE + 0.012, 0.018, POST_SIZE + 0.012, material, point.x, height + 0.049, point.z);
    cap.name = 'post-cap'; markFence(cap); group.add(cap);
  });
}

function addAnchorBolts(group, point, material) {
  const offsets = [-0.064, 0.064];
  offsets.forEach((x) => offsets.forEach((z) => {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.052, 10), material);
    bolt.position.set(point.x + x, GRADE_Y + 0.012, point.z + z);
    bolt.name = 'anchor-bolt'; markFence(bolt); group.add(bolt);

    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 6), material);
    nut.position.set(point.x + x, GRADE_Y + BASE_PLATE_HEIGHT + 0.004, point.z + z);
    nut.name = 'anchor-nut'; markFence(nut); group.add(nut);
  }));
}

function buildTechnicalEdges(fenceGroup) {
  const edges = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: 0x1b7eb5, transparent: true, opacity: 0.62 });
  fenceGroup.updateMatrixWorld(true);
  fenceGroup.traverse((object) => {
    if (!object.isMesh || !object.userData.fenceComponent) return;
    if (!object.geometry?.attributes?.position) return;
    const line = new THREE.LineSegments(new THREE.EdgesGeometry(object.geometry, 24), material);
    line.matrix.copy(object.matrixWorld);
    line.matrixAutoUpdate = false;
    edges.add(line);
  });
  return edges;
}

function boxMesh(width, height, depth, material, x, y, z, angle = 0) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  applyWorldScaleBoxUvs(geometry, width, height, x, y, z, angle);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = angle;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// BoxGeometry normally maps the complete image onto every slat, rail and
// panel. Projecting UVs in metres keeps grain and brushed-metal scale coherent
// across a full run. Long horizontal members rotate the grain with the part;
// vertical slats and privacy sheets keep it upright.
function applyWorldScaleBoxUvs(geometry, width, height, x, y, z, angle) {
  const uv = geometry.getAttribute('uv');
  if (!uv) return;
  const metresPerTexture = 1.35;
  const localRunPosition = x * Math.cos(angle) - z * Math.sin(angle);
  const horizontalMember = width > height * 2.2;
  for (let index = 0; index < uv.count; index += 1) {
    const sourceU = uv.getX(index);
    const sourceV = uv.getY(index);
    if (horizontalMember) {
      uv.setXY(
        index,
        (y - height / 2 + sourceV * height) / metresPerTexture,
        (localRunPosition - width / 2 + sourceU * width) / metresPerTexture,
      );
    } else {
      uv.setXY(
        index,
        (localRunPosition - width / 2 + sourceU * width) / metresPerTexture,
        (y - height / 2 + sourceV * height) / metresPerTexture,
      );
    }
  }
  uv.needsUpdate = true;
}

function markFence(object) {
  object.userData.fenceComponent = true;
}

function segmentAngle(p0, p1) {
  return -Math.atan2(p1.z - p0.z, p1.x - p0.x);
}

function worldFromLocal(center, angle, x, z) {
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  return new THREE.Vector3(center.x + x * cos - z * sin, 0, center.z + x * sin + z * cos);
}

function pointKey(point) {
  return `${point.x.toFixed(4)}:${point.z.toFixed(4)}`;
}

function calculateBounds(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  return { box, size, center };
}
