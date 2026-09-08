import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const FAMILIES = Object.freeze({
  compact: Object.freeze({ id: 'compact', width: 800, corner: 800, depth: 350, height: 2150 }),
  tall: Object.freeze({ id: 'tall', width: 900, corner: 900, depth: 350, height: 2300 }),
});

const DEFAULT_COLOUR = '#b98555';
const MODULE_COLOURS = Object.freeze([
  '#b98555', '#d0a878', '#835735', '#65422d', '#e7e3da', '#34312f',
]);
const POST = 42;
const BOARD = 22;
const BACK = 16;
const GLASS_ALPHA = 0.28;
const EPS = 0.5;

const COPY = Object.freeze({
  'en-US': Object.freeze({
    'intro.eyebrow': 'Client-specific modular system',
    'intro.title': 'Bookshelf configurator',
    'intro.copy': 'Build one continuous run from straight modules and 90° L-corners. Every connected module always uses the same dimensional family.',
    'section.family': 'Dimensional family',
    'section.selected': 'Selected module',
    'section.components': 'Components',
    'family.compact': 'Compact',
    'family.compactDims': 'Straight 800 × 350 mm · Corner 800 × 800 mm',
    'family.tall': 'Tall',
    'family.tallDims': 'Straight 900 × 350 mm · Corner 900 × 900 mm',
    'family.rule': 'Changing the family updates every module together; heights cannot be mixed.',
    'selected.empty': 'Select a bookshelf module in the 3D view to choose its doors, colour or delete it.',
    'selected.module': 'Module',
    'selected.doors': 'Door configuration',
    'selected.colour': 'Module colour',
    'selected.delete': 'Delete module',
    'selected.keepOne': 'At least one module must remain in the configuration.',
    'doors.open': 'Open',
    'doors.openHint': 'No doors',
    'doors.lower': 'Lower doors',
    'doors.lowerHint': 'Closed storage at the base',
    'doors.glazed': 'Glazed doors',
    'doors.glazedHint': 'Full-height glass closure',
    'add.kicker': 'Extend configuration',
    'add.title': 'Add module',
    'add.straight': 'Straight module',
    'add.straightHint': 'Continue in the same direction',
    'add.corner': 'L-corner module',
    'add.cornerHint': 'Turn the run by 90°',
    'add.direction': 'Corner direction',
    'add.turnLeft': 'Turn left',
    'add.turnRight': 'Turn right',
    'add.confirm': 'Add module',
    'add.intersection': 'That module would intersect the existing bookshelf run.',
    'viewer.hint': 'Click a module to edit it. Use the + buttons to extend the configuration.',
    'type.straight': 'Straight',
    'type.corner': 'L-corner',
    'components.modules': 'Modules',
    'components.joints': 'Connections',
    'components.layout': 'Layout',
    'components.openRun': 'Open run',
    'components.closedLoop': 'Closed loop',
    'components.note': 'No prices are shown. One aluminium connection set is added automatically for every joint between two modules.',
    'components.straight': 'Straight bookshelf module',
    'components.corner': 'L-corner bookshelf module',
    'components.lowerKit': 'Lower solid-door set',
    'components.glazedKit': 'Full-height glazed-door set',
    'components.connector': 'Aluminium connection set',
    'components.finish': 'finish',
    'components.left': 'left turn',
    'components.right': 'right turn',
  }),
  'ro-RO': Object.freeze({
    'intro.eyebrow': 'Sistem modular dedicat clientului',
    'intro.title': 'Configurator bibliotecă',
    'intro.copy': 'Construiește un traseu continuu din module drepte și colțuri în L la 90°. Toate modulele conectate folosesc întotdeauna aceeași familie dimensională.',
    'section.family': 'Familie dimensională',
    'section.selected': 'Modul selectat',
    'section.components': 'Listă componente',
    'family.compact': 'Compact',
    'family.compactDims': 'Drept 800 × 350 mm · Colț 800 × 800 mm',
    'family.tall': 'Înalt',
    'family.tallDims': 'Drept 900 × 350 mm · Colț 900 × 900 mm',
    'family.rule': 'Schimbarea familiei actualizează toate modulele împreună; înălțimile nu pot fi amestecate.',
    'selected.empty': 'Selectează un modul în vederea 3D pentru a alege ușile, culoarea sau pentru a-l șterge.',
    'selected.module': 'Modul',
    'selected.doors': 'Configurație uși',
    'selected.colour': 'Culoare modul',
    'selected.delete': 'Șterge modulul',
    'selected.keepOne': 'Configurația trebuie să păstreze cel puțin un modul.',
    'doors.open': 'Deschis',
    'doors.openHint': 'Fără uși',
    'doors.lower': 'Uși inferioare',
    'doors.lowerHint': 'Depozitare închisă la bază',
    'doors.glazed': 'Uși vitrate',
    'doors.glazedHint': 'Închidere cu geam pe toată înălțimea',
    'add.kicker': 'Extinde configurația',
    'add.title': 'Adaugă modul',
    'add.straight': 'Modul drept',
    'add.straightHint': 'Continuă în aceeași direcție',
    'add.corner': 'Modul de colț în L',
    'add.cornerHint': 'Schimbă direcția cu 90°',
    'add.direction': 'Direcția colțului',
    'add.turnLeft': 'Întoarcere stânga',
    'add.turnRight': 'Întoarcere dreapta',
    'add.confirm': 'Adaugă modulul',
    'add.intersection': 'Acest modul s-ar intersecta cu ansamblul existent.',
    'viewer.hint': 'Selectează un modul pentru editare. Folosește butoanele + pentru a extinde configurația.',
    'type.straight': 'Drept',
    'type.corner': 'Colț în L',
    'components.modules': 'Module',
    'components.joints': 'Conexiuni',
    'components.layout': 'Traseu',
    'components.openRun': 'Traseu deschis',
    'components.closedLoop': 'Traseu închis',
    'components.note': 'Nu sunt afișate prețuri. Se adaugă automat un set de conexiuni din aluminiu pentru fiecare îmbinare dintre două module.',
    'components.straight': 'Modul drept de bibliotecă',
    'components.corner': 'Modul de colț în L',
    'components.lowerKit': 'Set uși inferioare pline',
    'components.glazedKit': 'Set uși vitrate pe toată înălțimea',
    'components.connector': 'Set conexiune din aluminiu',
    'components.finish': 'finisaj',
    'components.left': 'viraj stânga',
    'components.right': 'viraj dreapta',
  }),
  'de-DE': Object.freeze({
    'intro.eyebrow': 'Kundenspezifisches Modulsystem',
    'intro.title': 'Bücherregal-Konfigurator',
    'intro.copy': 'Erstellen Sie eine durchgehende Reihe aus geraden Modulen und 90°-L-Ecken. Alle verbundenen Module verwenden immer dieselbe Maßfamilie.',
    'section.family': 'Maßfamilie',
    'section.selected': 'Ausgewähltes Modul',
    'section.components': 'Komponenten',
    'family.compact': 'Kompakt',
    'family.compactDims': 'Gerade 800 × 350 mm · Ecke 800 × 800 mm',
    'family.tall': 'Hoch',
    'family.tallDims': 'Gerade 900 × 350 mm · Ecke 900 × 900 mm',
    'family.rule': 'Beim Wechsel der Familie werden alle Module gemeinsam aktualisiert; unterschiedliche Höhen können nicht gemischt werden.',
    'selected.empty': 'Wählen Sie ein Modul in der 3D-Ansicht, um Türen, Farbe oder Löschen zu konfigurieren.',
    'selected.module': 'Modul',
    'selected.doors': 'Türkonfiguration',
    'selected.colour': 'Modulfarbe',
    'selected.delete': 'Modul löschen',
    'selected.keepOne': 'Mindestens ein Modul muss in der Konfiguration verbleiben.',
    'doors.open': 'Offen',
    'doors.openHint': 'Ohne Türen',
    'doors.lower': 'Untere Türen',
    'doors.lowerHint': 'Geschlossener Stauraum unten',
    'doors.glazed': 'Glastüren',
    'doors.glazedHint': 'Vollhohe Glasfront',
    'add.kicker': 'Konfiguration erweitern',
    'add.title': 'Modul hinzufügen',
    'add.straight': 'Gerades Modul',
    'add.straightHint': 'In gleicher Richtung fortsetzen',
    'add.corner': 'L-Eckmodul',
    'add.cornerHint': 'Richtung um 90° ändern',
    'add.direction': 'Eckrichtung',
    'add.turnLeft': 'Links abbiegen',
    'add.turnRight': 'Rechts abbiegen',
    'add.confirm': 'Modul hinzufügen',
    'add.intersection': 'Dieses Modul würde die vorhandene Regalreihe schneiden.',
    'viewer.hint': 'Klicken Sie ein Modul zum Bearbeiten an. Mit + erweitern Sie die Konfiguration.',
    'type.straight': 'Gerade',
    'type.corner': 'L-Ecke',
    'components.modules': 'Module',
    'components.joints': 'Verbindungen',
    'components.layout': 'Anordnung',
    'components.openRun': 'Offene Reihe',
    'components.closedLoop': 'Geschlossene Reihe',
    'components.note': 'Es werden keine Preise angezeigt. Für jede Verbindung zweier Module wird automatisch ein Aluminium-Verbindungssatz ergänzt.',
    'components.straight': 'Gerades Bücherregalmodul',
    'components.corner': 'L-Eck-Bücherregalmodul',
    'components.lowerKit': 'Satz untere Massivtüren',
    'components.glazedKit': 'Satz vollhohe Glastüren',
    'components.connector': 'Aluminium-Verbindungssatz',
    'components.finish': 'Oberfläche',
    'components.left': 'Linkskurve',
    'components.right': 'Rechtskurve',
  }),
});

const $ = (selector) => document.querySelector(selector);
const canvasHost = $('#canvasHost');
const dimensionLayer = $('#dimensionLayer');
const addStartButton = $('#addStartButton');
const addEndButton = $('#addEndButton');
const addModulePanel = $('#addModulePanel');
const cornerDirectionGroup = $('#cornerDirectionGroup');
const addModuleError = $('#addModuleError');
const selectedEmptyState = $('#selectedEmptyState');
const selectedModuleControls = $('#selectedModuleControls');
const selectedModuleLabel = $('#selectedModuleLabel');
const selectedModuleTypeBadge = $('#selectedModuleTypeBadge');
const deleteModuleButton = $('#deleteModuleButton');
const deleteModuleHint = $('#deleteModuleHint');
const viewerHint = $('#viewerHint');

let locale = localeForHost();
let units = locale === 'en-US' ? 'imperial' : 'metric';
let darkMode = false;
let dimensionsVisible = true;
let cameraMode = 0;
let selectedModuleId = '';
let addAt = 'end';
let pendingKind = 'straight';
let pendingTurn = 'left';
let moduleMeshes = [];
let moduleGroups = new Map();
let dimensionAnchors = [];
let layoutCache = null;
let selectionHelper = null;
let resizeObserver;

let state = {
  version: 1,
  family: 'compact',
  origin: { x: -400, z: 0, heading: 0 },
  modules: [newModule('straight')],
};

function localeForHost() {
  const host = String(location.hostname || '').toLowerCase();
  if (host.includes('360configurator.ro')) return 'ro-RO';
  if (host.includes('360konfigurator.de')) return 'de-DE';
  return 'en-US';
}

function t(key) { return COPY[locale]?.[key] ?? COPY['en-US'][key] ?? key; }
function recordUndoCheckpoint() {
  window.BOOKSHELF_CONFIGURATOR_UNDO_HISTORY?.record?.();
}
function markDirty() {
  window.BOOKSHELF_CONFIGURATOR_SHARED_SHELL?.markDirty?.();
}
function round(value, digits = 3) { const f = 10 ** digits; return Math.round(Number(value) * f) / f; }
function familySpec() { return FAMILIES[state.family] || FAMILIES.compact; }
function uid() { return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
function newModule(kind = 'straight', turn = 'left') {
  return { id: uid(), kind, turn: turn === 'right' ? 'right' : 'left', door: 'open', colour: DEFAULT_COLOUR };
}
function cloneModule(module) {
  return {
    id: String(module?.id || uid()),
    kind: module?.kind === 'corner' ? 'corner' : 'straight',
    turn: module?.turn === 'right' ? 'right' : 'left',
    door: ['open', 'lower', 'glazed'].includes(module?.door) ? module.door : 'open',
    colour: /^#[0-9a-f]{6}$/i.test(String(module?.colour || '')) ? String(module.colour).toLowerCase() : DEFAULT_COLOUR,
  };
}
function normalizeAngle(angle) {
  let result = angle % (Math.PI * 2);
  if (result <= -Math.PI) result += Math.PI * 2;
  if (result > Math.PI) result -= Math.PI * 2;
  return result;
}
function vec(heading) { return { x: Math.cos(heading), z: Math.sin(heading) }; }
function rotateHeading(heading, turn) { return normalizeAngle(heading + (turn === 'left' ? Math.PI / 2 : -Math.PI / 2)); }
function add2(a, b) { return { x: a.x + b.x, z: a.z + b.z }; }
function mul2(v, amount) { return { x: v.x * amount, z: v.z * amount }; }
function dist2(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function poseCopy(pose) { return { x: pose.x, z: pose.z, heading: pose.heading }; }
function posePoint(pose) { return { x: pose.x, z: pose.z }; }
function sameHeading(a, b) { return Math.abs(normalizeAngle(a - b)) < 1e-4; }

function advancePose(start, module, spec = familySpec()) {
  const d = vec(start.heading);
  if (module.kind === 'straight') {
    return {
      end: { x: start.x + d.x * spec.width, z: start.z + d.z * spec.width, heading: start.heading },
      corner: null,
    };
  }
  const nextHeading = rotateHeading(start.heading, module.turn);
  const nd = vec(nextHeading);
  const corner = { x: start.x + d.x * spec.corner, z: start.z + d.z * spec.corner };
  return {
    corner,
    end: { x: corner.x + nd.x * spec.corner, z: corner.z + nd.z * spec.corner, heading: nextHeading },
  };
}

function deriveLayout(modules = state.modules, origin = state.origin, spec = familySpec()) {
  const entries = [];
  const segments = [];
  let pose = poseCopy(origin);
  modules.forEach((module, index) => {
    const start = poseCopy(pose);
    const advanced = advancePose(start, module, spec);
    if (module.kind === 'straight') {
      segments.push({ a: posePoint(start), b: posePoint(advanced.end), moduleIndex: index });
    } else {
      segments.push({ a: posePoint(start), b: advanced.corner, moduleIndex: index });
      segments.push({ a: advanced.corner, b: posePoint(advanced.end), moduleIndex: index });
    }
    entries.push({ module, index, start, end: poseCopy(advanced.end), corner: advanced.corner });
    pose = poseCopy(advanced.end);
  });
  const closed = modules.length >= 3
    && dist2(posePoint(pose), posePoint(origin)) < EPS
    && sameHeading(pose.heading, origin.heading);
  return { entries, segments, start: poseCopy(origin), end: pose, closed };
}

function endpointsOverlap(layout, tolerance = 0.5) {
  return Boolean(layout) && dist2(posePoint(layout.start), posePoint(layout.end)) < tolerance;
}

function pointEqual(a, b, tolerance = EPS) { return dist2(a, b) < tolerance; }
function orientation(a, b, c) {
  const value = (b.z - a.z) * (c.x - b.x) - (b.x - a.x) * (c.z - b.z);
  if (Math.abs(value) < 1e-7) return 0;
  return value > 0 ? 1 : 2;
}
function onSegment(a, b, c) {
  return b.x <= Math.max(a.x, c.x) + EPS && b.x + EPS >= Math.min(a.x, c.x)
    && b.z <= Math.max(a.z, c.z) + EPS && b.z + EPS >= Math.min(a.z, c.z);
}
function segmentsIntersect(a1, a2, b1, b2) {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;
  return false;
}
function validLayout(layout) {
  const list = layout.segments;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      const consecutive = j === i + 1;
      const closesLoop = layout.closed && i === 0 && j === list.length - 1;
      if (consecutive || closesLoop) continue;
      if (!segmentsIntersect(a.a, a.b, b.a, b.b)) continue;
      const sharedEndpoint = pointEqual(a.a, b.a) || pointEqual(a.a, b.b) || pointEqual(a.b, b.a) || pointEqual(a.b, b.b);
      if (!sharedEndpoint) return false;
      // Non-consecutive modules touching at any intermediate endpoint would create a branch.
      return false;
    }
  }
  return true;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f4f6);
const camera = new THREE.PerspectiveCamera(38, 1, 1, 18000);
camera.position.set(1500, 1250, 1850);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
canvasHost.append(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 450;
controls.maxDistance = 9000;
controls.maxPolarAngle = Math.PI * 0.49;
controls.target.set(0, 850, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8c979e, 2.25));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
keyLight.position.set(1600, 2600, 1250);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xc5e2f4, 0.9);
fillLight.position.set(-1500, 1200, -1300);
scene.add(fillLight);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(14000, 14000),
  new THREE.MeshStandardMaterial({ color: 0xe7ecef, roughness: 1, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -5;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(10000, 100, 0xc6d2d8, 0xdce4e8);
grid.position.y = -4;
grid.material.opacity = 0.32;
grid.material.transparent = true;
scene.add(grid);

const bookshelfGroup = new THREE.Group();
scene.add(bookshelfGroup);
const connectorGroup = new THREE.Group();
scene.add(connectorGroup);

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose?.());
    }
  });
}
function clearGroup(group) {
  [...group.children].forEach((child) => {
    group.remove(child);
    disposeObject(child);
  });
}
function woodMaterial(colour) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness: 0.72, metalness: 0.02 });
}
function darkWoodMaterial(colour) {
  const color = new THREE.Color(colour).multiplyScalar(0.78);
  return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.01 });
}
function glassMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: 0xc7e9f5, roughness: 0.12, metalness: 0, transparent: true, opacity: GLASS_ALPHA, transmission: 0.28, side: THREE.DoubleSide });
}
function metalMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0xc9ced1, roughness: 0.34, metalness: 0.82 });
}
function tagMesh(mesh, moduleId) {
  mesh.userData.bookshelfModuleId = moduleId;
  moduleMeshes.push(mesh);
  return mesh;
}
function addBox(group, size, position, material, moduleId, { cast = true, receive = true } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.position.set(position.x, position.y, position.z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  tagMesh(mesh, moduleId);
  group.add(mesh);
  return mesh;
}
function frontZ(depth) { return -depth; }

function addShelfWing(parent, module, pose, length, { cornerWing = false, sharedSide = null, omitStartPosts = false, omitEndPosts = false, omitStartFrontPost = false, omitStartBackPost = false, omitEndFrontPost = false, omitEndBackPost = false } = {}) {
  const spec = familySpec();
  const group = new THREE.Group();
  group.position.set(pose.x, 0, pose.z);
  group.rotation.y = -pose.heading;
  parent.add(group);

  const wood = woodMaterial(module.colour);
  const darkWood = darkWoodMaterial(module.colour);
  const width = length;
  const depth = spec.depth;
  const height = spec.height;
  const front = frontZ(depth);
  const innerWidth = Math.max(100, width - POST * 2);
  const shelfDepth = depth - 34;

  // Back panel and plinth notch approximation based on the supplied product reference.
  addBox(group, { x: innerWidth, y: height - 160, z: BACK }, { x: width / 2, y: height / 2 + 20, z: -BACK / 2 }, darkWood, module.id);
  addBox(group, { x: innerWidth, y: 105, z: depth - 18 }, { x: width / 2, y: 62, z: -depth / 2 }, darkWood, module.id);

  // Uprights at the free ends of the wing and, when needed, at the shared corner.
  const postEnds = [
    {
      x: POST / 2,
      omitAll: omitStartPosts,
      omitBack: omitStartBackPost,
      omitFront: omitStartFrontPost,
    },
    {
      x: width - POST / 2,
      omitAll: omitEndPosts,
      omitBack: omitEndBackPost,
      omitFront: omitEndFrontPost,
    },
  ];
  postEnds.forEach(({ x, omitAll, omitBack, omitFront }) => {
    if (omitAll) return;
    if (!omitBack) {
      addBox(group, { x: POST, y: height, z: POST }, { x, y: height / 2, z: -POST / 2 }, wood, module.id);
    }
    if (!omitFront) {
      addBox(group, { x: POST, y: height, z: POST }, { x, y: height / 2, z: front + POST / 2 }, wood, module.id);
    }
  });

  const shelfCount = spec.height > 2200 ? 7 : 6;
  const plinthTopY = 105;
  const topShelfY = height - 130;
  const shelfGap = (topShelfY - plinthTopY) / (shelfCount + 1);
  for (let i = 0; i <= shelfCount; i += 1) {
    const y = plinthTopY + shelfGap * (i + 1);
    addBox(group, { x: innerWidth, y: BOARD, z: shelfDepth }, { x: width / 2, y, z: -depth / 2 }, wood, module.id);
  }

  // Decorative cap rails visible in the source imagery.
  addBox(group, { x: innerWidth, y: 40, z: 55 }, { x: width / 2, y: height - 38, z: -28 }, wood, module.id);

  addDoors(group, module, { width, depth, height, cornerWing, sharedSide });
  return group;
}

function addDoorFrame(parent, module, xCenter, width, yCenter, height, z, { glazed = false } = {}) {
  const wood = woodMaterial(module.colour);
  const frame = 34;
  if (!glazed) {
    addBox(parent, { x: width, y: height, z: 18 }, { x: xCenter, y: yCenter, z }, wood, module.id);
    // inset panel detail
    const inset = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(20, width - 42), Math.max(20, height - 46), 5),
      darkWoodMaterial(module.colour),
    );
    inset.position.set(xCenter, yCenter, z - 12);
    tagMesh(inset, module.id);
    parent.add(inset);
    return;
  }

  addBox(parent, { x: frame, y: height, z: 18 }, { x: xCenter - width / 2 + frame / 2, y: yCenter, z }, wood, module.id);
  addBox(parent, { x: frame, y: height, z: 18 }, { x: xCenter + width / 2 - frame / 2, y: yCenter, z }, wood, module.id);
  addBox(parent, { x: width - frame * 2, y: frame, z: 18 }, { x: xCenter, y: yCenter - height / 2 + frame / 2, z }, wood, module.id);
  addBox(parent, { x: width - frame * 2, y: frame, z: 18 }, { x: xCenter, y: yCenter + height / 2 - frame / 2, z }, wood, module.id);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(Math.max(20, width - frame * 2), Math.max(20, height - frame * 2), 5), glassMaterial());
  glass.position.set(xCenter, yCenter, z + 1);
  tagMesh(glass, module.id);
  parent.add(glass);
}

function addDoors(parent, module, { width, depth, height, cornerWing = false, sharedSide = null }) {
  if (module.door === 'open') return;
  const z = frontZ(depth) - 12;
  const cornerInset = cornerWing ? Math.max(64, POST * 1.5) : 0;
  const openingStart = POST + 9 + (sharedSide === 'start' ? cornerInset : 0);
  const openingEnd = width - POST - 9 - (sharedSide === 'end' ? cornerInset : 0);
  const openingWidth = Math.max(120, openingEnd - openingStart);

  if (cornerWing) {
    const straightLeafWidth = (Math.max(120, width - POST * 2 - 18) - 8) / 2;
    const leafWidth = Math.max(90, Math.min(openingWidth, straightLeafWidth));
    const x = sharedSide === 'start'
      ? openingEnd - leafWidth / 2
      : openingStart + leafWidth / 2;
    if (module.door === 'lower') {
      const doorHeight = Math.min(720, height * 0.34);
      const y = 118 + doorHeight / 2;
      addDoorFrame(parent, module, x, leafWidth, y, doorHeight, z, { glazed: false });
      return;
    }
    const doorHeight = height - 205;
    const y = 105 + doorHeight / 2;
    addDoorFrame(parent, module, x, leafWidth, y, doorHeight, z, { glazed: true });
    return;
  }

  const leafGap = 8;
  const leafWidth = Math.max(46, (openingWidth - leafGap) / 2);
  const leftX = openingStart + leafWidth / 2;
  const rightX = openingStart + leafWidth + leafGap + leafWidth / 2;

  if (module.door === 'lower') {
    const doorHeight = Math.min(720, height * 0.34);
    const y = 118 + doorHeight / 2;
    addDoorFrame(parent, module, leftX, leafWidth, y, doorHeight, z, { glazed: false });
    addDoorFrame(parent, module, rightX, leafWidth, y, doorHeight, z, { glazed: false });
    return;
  }

  const doorHeight = height - 205;
  const y = 105 + doorHeight / 2;
  addDoorFrame(parent, module, leftX, leafWidth, y, doorHeight, z, { glazed: true });
  addDoorFrame(parent, module, rightX, leafWidth, y, doorHeight, z, { glazed: true });
}

function renderModule(entry) {
  const module = entry.module;
  const root = new THREE.Group();
  root.userData.bookshelfModuleId = module.id;
  bookshelfGroup.add(root);
  moduleGroups.set(module.id, root);

  if (module.kind === 'straight') {
    addShelfWing(root, module, entry.start, familySpec().width);
  } else {
    const first = addShelfWing(root, module, entry.start, familySpec().corner, { cornerWing: true, sharedSide: 'end', omitEndFrontPost: true });
    // The second wing starts at the shared corner, so its door leaves are inset away from that joint.
    const secondPose = { x: entry.corner.x, z: entry.corner.z, heading: entry.end.heading };
    const second = addShelfWing(root, module, secondPose, familySpec().corner, { cornerWing: true, sharedSide: 'start', omitStartPosts: true });
    first.userData.cornerWing = 'incoming';
    second.userData.cornerWing = 'outgoing';
  }
  return root;
}

function renderConnectors(layout) {
  clearGroup(connectorGroup);
  const spec = familySpec();
  const jointPoses = [];
  for (let i = 0; i < layout.entries.length - 1; i += 1) jointPoses.push(layout.entries[i].end);
  if (layout.closed && layout.entries.length) jointPoses.push(layout.end);

  const thickness = 16;
  const size = { x: 54, y: 38, z: thickness };
  jointPoses.forEach((pose) => {
    const d = vec(pose.heading);
    const n = { x: -d.z, z: d.x };
    const backPoint = {
      x: pose.x + n.x * (thickness / 2 + 2),
      z: pose.z + n.z * (thickness / 2 + 2),
    };
    const frontPoint = {
      x: pose.x - n.x * (spec.depth + thickness / 2 + 2),
      z: pose.z - n.z * (spec.depth + thickness / 2 + 2),
    };
    [backPoint, frontPoint].forEach((point) => {
      [92, spec.height - 92].forEach((y) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), metalMaterial());
        mesh.position.set(point.x, y, point.z);
        mesh.rotation.y = -pose.heading;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        connectorGroup.add(mesh);
      });
    });
  });
}

function rebuildScene() {
  clearGroup(bookshelfGroup);
  moduleMeshes = [];
  moduleGroups.clear();
  layoutCache = deriveLayout();
  layoutCache.entries.forEach(renderModule);
  renderConnectors(layoutCache);
  rebuildSelectionHelper();
  rebuildDimensions();
  fitControlsTarget();
  updateEndpointButtons();
  renderComponents();
}

function rebuildSelectionHelper() {
  if (selectionHelper) {
    scene.remove(selectionHelper);
    selectionHelper.geometry?.dispose?.();
    selectionHelper.material?.dispose?.();
    selectionHelper = null;
  }
  if (!selectedModuleId) return;
  const group = moduleGroups.get(selectedModuleId);
  if (!group) return;
  selectionHelper = new THREE.BoxHelper(group, 0x168de0);
  selectionHelper.material.transparent = true;
  selectionHelper.material.opacity = 0.82;
  scene.add(selectionHelper);
}

function layoutBounds(layout = layoutCache || deriveLayout()) {
  const points = [];
  layout.entries.forEach((entry) => {
    points.push(posePoint(entry.start), posePoint(entry.end));
    if (entry.corner) points.push(entry.corner);
  });
  if (!points.length) points.push({ x: 0, z: 0 });
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minZ: Math.min(...points.map((p) => p.z)),
    maxZ: Math.max(...points.map((p) => p.z)),
  };
}
function fitControlsTarget() {
  const b = layoutBounds();
  const spec = familySpec();
  controls.target.set((b.minX + b.maxX) / 2, spec.height * 0.42, (b.minZ + b.maxZ) / 2);
}

function displayLength(mm) {
  if (units === 'imperial') return `${(mm / 25.4).toFixed(1)} in`;
  return `${Math.round(mm)} mm`;
}
function rebuildDimensions() {
  dimensionAnchors = [];
  if (!dimensionsVisible) {
    dimensionLayer.innerHTML = '';
    dimensionLayer.hidden = true;
    return;
  }
  dimensionLayer.hidden = false;
  const spec = familySpec();
  (layoutCache?.entries || []).forEach((entry) => {
    if (entry.module.kind === 'straight') {
      const mid = {
        x: (entry.start.x + entry.end.x) / 2,
        z: (entry.start.z + entry.end.z) / 2,
      };
      dimensionAnchors.push({ point: new THREE.Vector3(mid.x, spec.height + 85, mid.z), label: displayLength(spec.width) });
    } else {
      dimensionAnchors.push({ point: new THREE.Vector3(entry.corner.x, spec.height + 85, entry.corner.z), label: `${displayLength(spec.corner)} × ${displayLength(spec.corner)}` });
    }
  });
  dimensionLayer.innerHTML = dimensionAnchors.map((item, index) => `<div class="dimension-label" data-dimension-index="${index}">${item.label}</div>`).join('');
}
function updateDimensionPositions() {
  if (!dimensionsVisible) return;
  const rect = canvasHost.getBoundingClientRect();
  dimensionAnchors.forEach((item, index) => {
    const projected = item.point.clone().project(camera);
    const element = dimensionLayer.querySelector(`[data-dimension-index="${index}"]`);
    if (!element) return;
    const visible = projected.z > -1 && projected.z < 1;
    element.style.display = visible ? '' : 'none';
    element.style.left = `${(projected.x * 0.5 + 0.5) * rect.width}px`;
    element.style.top = `${(-projected.y * 0.5 + 0.5) * rect.height}px`;
  });
}

function hideEndpointButton(button) {
  button.hidden = true;
  button.style.display = 'none';
}
function showEndpointButton(button) {
  button.hidden = false;
  button.style.display = 'grid';
}

function endpointOverlayPoint(pose, isStart = false) {
  const spec = familySpec();
  const heading = isStart ? normalizeAngle(pose.heading + Math.PI) : pose.heading;
  const d = vec(heading);
  const offset = Math.max(105, spec.depth * 0.3);
  return new THREE.Vector3(
    pose.x + d.x * offset,
    spec.height * 0.55,
    pose.z + d.z * offset,
  );
}
function positionOverlayButton(button, worldPoint) {
  const rect = canvasHost.getBoundingClientRect();
  const projected = worldPoint.clone().project(camera);
  const visible = projected.z > -1 && projected.z < 1;
  if (!visible) {
    hideEndpointButton(button);
    return;
  }
  showEndpointButton(button);
  button.style.left = `${(projected.x * 0.5 + 0.5) * rect.width}px`;
  button.style.top = `${(-projected.y * 0.5 + 0.5) * rect.height}px`;
}
function updateEndpointButtons() {
  if (!layoutCache || layoutCache.closed || endpointsOverlap(layoutCache) || addModulePanel.hidden === false) {
    hideEndpointButton(addStartButton);
    hideEndpointButton(addEndButton);
    return;
  }
  positionOverlayButton(addStartButton, endpointOverlayPoint(layoutCache.start, true));
  positionOverlayButton(addEndButton, endpointOverlayPoint(layoutCache.end, false));
}

function renderTranslations() {
  document.documentElement.lang = locale.startsWith('ro') ? 'ro' : locale.startsWith('de') ? 'de' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  renderSelectedControls();
  renderComponents();
}

function renderFamilyControls() {
  document.querySelectorAll('[data-family]').forEach((button) => button.classList.toggle('is-selected', button.dataset.family === state.family));
}

function selectedModule() { return state.modules.find((module) => module.id === selectedModuleId) || null; }
function renderSelectedControls() {
  const module = selectedModule();
  selectedEmptyState.hidden = Boolean(module);
  selectedModuleControls.hidden = !module;
  if (!module) return;
  const index = state.modules.findIndex((item) => item.id === module.id);
  selectedModuleLabel.textContent = String(index + 1);
  selectedModuleTypeBadge.textContent = module.kind === 'corner' ? t('type.corner') : t('type.straight');
  document.querySelectorAll('[data-door]').forEach((button) => button.classList.toggle('is-selected', button.dataset.door === module.door));
  document.querySelectorAll('[data-colour]').forEach((button) => button.classList.toggle('is-selected', button.dataset.colour.toLowerCase() === module.colour.toLowerCase()));
  deleteModuleButton.disabled = state.modules.length <= 1;
  deleteModuleHint.hidden = state.modules.length > 1;
}

function moduleFinishLabel(colour) {
  const map = new Map([
    ['#b98555', 'Natural oak'], ['#d0a878', 'Light oak'], ['#835735', 'Dark oak'], ['#65422d', 'Walnut'], ['#e7e3da', 'Warm white'], ['#34312f', 'Black'],
  ]);
  if (locale === 'ro-RO') {
    const ro = new Map([
      ['#b98555', 'Stejar natur'], ['#d0a878', 'Stejar deschis'], ['#835735', 'Stejar închis'], ['#65422d', 'Nuc'], ['#e7e3da', 'Alb cald'], ['#34312f', 'Negru'],
    ]);
    return ro.get(colour) || colour;
  }
  if (locale === 'de-DE') {
    const de = new Map([
      ['#b98555', 'Eiche natur'], ['#d0a878', 'Eiche hell'], ['#835735', 'Eiche dunkel'], ['#65422d', 'Nussbaum'], ['#e7e3da', 'Warmweiß'], ['#34312f', 'Schwarz'],
    ]);
    return de.get(colour) || colour;
  }
  return map.get(colour) || colour;
}

function renderComponents() {
  if (!$('#componentsList')) return;
  const spec = familySpec();
  const layout = layoutCache || deriveLayout();
  const jointCount = state.modules.length ? state.modules.length - 1 + (layout.closed ? 1 : 0) : 0;
  $('#componentModuleCount').textContent = String(state.modules.length);
  $('#componentJointCount').textContent = String(jointCount);
  $('#componentLayoutState').textContent = layout.closed ? t('components.closedLoop') : t('components.openRun');

  const rows = new Map();
  function addRow(key, name, detail, qty = 1) {
    const current = rows.get(key);
    if (current) current.qty += qty;
    else rows.set(key, { name, detail, qty });
  }

  state.modules.forEach((module) => {
    const finish = moduleFinishLabel(module.colour);
    if (module.kind === 'straight') {
      const detail = `${spec.width} × ${spec.depth} × ${spec.height} mm · ${finish}`;
      addRow(`straight|${module.colour}`, t('components.straight'), detail);
    } else {
      const turn = module.turn === 'left' ? t('components.left') : t('components.right');
      const detail = `${spec.corner} × ${spec.corner} × ${spec.height} mm · ${finish} · ${turn}`;
      addRow(`corner|${module.colour}|${module.turn}`, t('components.corner'), detail);
    }
    if (module.door === 'lower') addRow('door-lower', t('components.lowerKit'), `${state.family === 'compact' ? '2150' : '2300'} mm family`);
    if (module.door === 'glazed') addRow('door-glazed', t('components.glazedKit'), `${state.family === 'compact' ? '2150' : '2300'} mm family`);
  });
  if (jointCount > 0) addRow('connectors', t('components.connector'), locale === 'ro-RO' ? 'Set automat pentru îmbinarea dintre montanți' : locale === 'de-DE' ? 'Automatischer Satz je Modulverbindung' : 'Automatic set for each joint between uprights', jointCount);

  $('#componentsList').innerHTML = [...rows.values()].map((row) => `
    <div class="component-row">
      <div class="component-row__name"><b>${escapeHtml(row.name)}</b><small>${escapeHtml(row.detail)}</small></div>
      <div class="component-row__qty">×${row.qty}</div>
    </div>
  `).join('');
}
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderAll({ refit = false } = {}) {
  renderFamilyControls();
  renderTranslations();
  rebuildScene();
  renderSelectedControls();
  if (refit) fitCameraToConfiguration();
}

function applyCameraFrame(mode = cameraMode) {
  const b = layoutBounds();
  const spec = familySpec();
  const span = Math.max(b.maxX - b.minX + spec.depth * 2.8, b.maxZ - b.minZ + spec.depth * 2.8, spec.height * 1.18, 1100);
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  controls.target.set(cx, spec.height * 0.44, cz);
  if (mode === 1) {
    camera.position.set(cx, spec.height + span * 1.4, cz + 0.01);
  } else if (mode === 2) {
    camera.position.set(b.maxX + span * 1.45, spec.height * 0.62, cz);
  } else {
    camera.position.set(cx, spec.height * 0.68, b.minZ - span * 2.05);
  }
  camera.lookAt(controls.target);
  controls.update();
}

function fitCameraToConfiguration() {
  applyCameraFrame(cameraMode);
}

function openAddPanel(side) {
  if (layoutCache?.closed) return;
  addAt = side === 'start' ? 'start' : 'end';
  pendingKind = 'straight';
  pendingTurn = 'left';
  document.querySelectorAll('[data-module-kind]').forEach((button) => button.classList.toggle('is-selected', button.dataset.moduleKind === 'straight'));
  document.querySelectorAll('[data-corner-turn]').forEach((button) => button.classList.toggle('is-selected', button.dataset.cornerTurn === 'left'));
  cornerDirectionGroup.hidden = true;
  addModuleError.hidden = true;
  addModulePanel.hidden = false;
  updateEndpointButtons();
}
function closeAddPanel() {
  addModulePanel.hidden = true;
  addModuleError.hidden = true;
  updateEndpointButtons();
}

function prependOriginFor(module) {
  const spec = familySpec();
  const current = poseCopy(state.origin);
  if (module.kind === 'straight') {
    const d = vec(current.heading);
    return { x: current.x - d.x * spec.width, z: current.z - d.z * spec.width, heading: current.heading };
  }
  const turnSign = module.turn === 'left' ? 1 : -1;
  const inputHeading = normalizeAngle(current.heading - turnSign * Math.PI / 2);
  const input = vec(inputHeading);
  const output = vec(current.heading);
  return {
    x: current.x - input.x * spec.corner - output.x * spec.corner,
    z: current.z - input.z * spec.corner - output.z * spec.corner,
    heading: inputHeading,
  };
}

function addPendingModule() {
  const module = newModule(pendingKind, pendingTurn);
  let candidateModules;
  let candidateOrigin;
  if (addAt === 'start') {
    candidateModules = [module, ...state.modules.map(cloneModule)];
    candidateOrigin = prependOriginFor(module);
  } else {
    candidateModules = [...state.modules.map(cloneModule), module];
    candidateOrigin = poseCopy(state.origin);
  }
  const candidateLayout = deriveLayout(candidateModules, candidateOrigin, familySpec());
  if (!validLayout(candidateLayout)) {
    addModuleError.textContent = t('add.intersection');
    addModuleError.hidden = false;
    return;
  }
  recordUndoCheckpoint();
  state.modules = candidateModules;
  state.origin = candidateOrigin;
  selectedModuleId = module.id;
  closeAddPanel();
  renderAll({ refit: false });
  markDirty();
}

function deleteSelectedModule() {
  if (!selectedModuleId || state.modules.length <= 1) return;
  const index = state.modules.findIndex((module) => module.id === selectedModuleId);
  if (index < 0) return;
  recordUndoCheckpoint();
  const layout = deriveLayout();
  if (index === 0) {
    const nextOrigin = layout.entries[0]?.end;
    if (nextOrigin) state.origin = poseCopy(nextOrigin);
  }
  state.modules.splice(index, 1);
  selectedModuleId = state.modules[Math.min(index, state.modules.length - 1)]?.id || '';
  renderAll();
  markDirty();
}

function updateSelectedModule(patch) {
  const module = selectedModule();
  if (!module) return;
  recordUndoCheckpoint();
  Object.assign(module, patch);
  renderAll();
  markDirty();
}

function setFamily(family) {
  if (!FAMILIES[family] || family === state.family) return;
  recordUndoCheckpoint();
  state.family = family;
  renderAll({ refit: true });
  markDirty();
}

function raycastModule(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(moduleMeshes, false)[0];
  return hit?.object?.userData?.bookshelfModuleId || '';
}

function bindControls() {
  document.querySelectorAll('.accordion-toggle').forEach((button) => button.addEventListener('click', () => {
    const section = button.closest('.accordion-section');
    const panel = section.querySelector('.accordion-panel');
    const open = !section.classList.contains('is-open');
    section.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
  }));

  document.querySelectorAll('[data-family]').forEach((button) => button.addEventListener('click', () => setFamily(button.dataset.family)));
  document.querySelectorAll('[data-door]').forEach((button) => button.addEventListener('click', () => updateSelectedModule({ door: button.dataset.door })));
  document.querySelectorAll('[data-colour]').forEach((button) => button.addEventListener('click', () => updateSelectedModule({ colour: button.dataset.colour.toLowerCase() })));
  deleteModuleButton.addEventListener('click', deleteSelectedModule);

  addStartButton.addEventListener('click', () => openAddPanel('start'));
  addEndButton.addEventListener('click', () => openAddPanel('end'));
  $('#closeAddPanelButton').addEventListener('click', closeAddPanel);
  $('#confirmAddModuleButton').addEventListener('click', addPendingModule);
  document.querySelectorAll('[data-module-kind]').forEach((button) => button.addEventListener('click', () => {
    pendingKind = button.dataset.moduleKind === 'corner' ? 'corner' : 'straight';
    document.querySelectorAll('[data-module-kind]').forEach((item) => item.classList.toggle('is-selected', item === button));
    cornerDirectionGroup.hidden = pendingKind !== 'corner';
    addModuleError.hidden = true;
  }));
  document.querySelectorAll('[data-corner-turn]').forEach((button) => button.addEventListener('click', () => {
    pendingTurn = button.dataset.cornerTurn === 'right' ? 'right' : 'left';
    document.querySelectorAll('[data-corner-turn]').forEach((item) => item.classList.toggle('is-selected', item === button));
    addModuleError.hidden = true;
  }));

  let down = null;
  renderer.domElement.addEventListener('pointerdown', (event) => { down = { x: event.clientX, y: event.clientY }; });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (!down) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    down = null;
    if (moved > 5) return;
    const moduleId = raycastModule(event);
    if (!moduleId) {
      if (selectedModuleId) {
        selectedModuleId = '';
        renderSelectedControls();
        rebuildSelectionHelper();
      }
      return;
    }
    selectedModuleId = moduleId;
    closeAddPanel();
    renderSelectedControls();
    rebuildSelectionHelper();
  });
}

function resizeRenderer() {
  const width = Math.max(1, canvasHost.clientWidth);
  const height = Math.max(1, canvasHost.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function updateOverlays() {
  updateDimensionPositions();
  if (addModulePanel.hidden) updateEndpointButtons();
  else {
    addStartButton.hidden = true;
    addEndButton.hidden = true;
  }
}
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  if (selectionHelper) selectionHelper.update();
  updateOverlays();
  renderer.render(scene, camera);
}

function captureState() {
  return {
    version: 1,
    family: state.family,
    origin: { x: round(state.origin.x), z: round(state.origin.z), heading: round(state.origin.heading, 6) },
    modules: state.modules.map(cloneModule),
  };
}

function restoreState(snapshot) {
  const source = snapshot?.state && !snapshot.modules ? snapshot.state : snapshot;
  if (!source || !Array.isArray(source.modules) || source.modules.length === 0) return false;
  const family = FAMILIES[source.family] ? source.family : 'compact';
  const origin = {
    x: Number(source.origin?.x),
    z: Number(source.origin?.z),
    heading: Number(source.origin?.heading),
  };
  if (![origin.x, origin.z, origin.heading].every(Number.isFinite)) return false;
  const modules = source.modules.map(cloneModule);
  const candidate = deriveLayout(modules, origin, FAMILIES[family]);
  if (!validLayout(candidate)) return false;
  state = { version: 1, family, origin, modules };
  selectedModuleId = '';
  closeAddPanel();
  renderAll({ refit: true });
  return true;
}

function resetConfiguration() {
  state = {
    version: 1,
    family: 'compact',
    origin: { x: -400, z: 0, heading: 0 },
    modules: [newModule('straight')],
  };
  selectedModuleId = '';
  closeAddPanel();
  renderAll({ refit: true });
  return true;
}

function setLocale(value) {
  if (COPY[value]) locale = value;
  renderTranslations();
  rebuildDimensions();
}
function setUnits(value) {
  units = value === 'imperial' ? 'imperial' : 'metric';
  rebuildDimensions();
}
function setDarkMode(value) {
  darkMode = Boolean(value);
  document.body.classList.toggle('bookshelf-dark-mode', darkMode);
  scene.background.set(darkMode ? 0x182126 : 0xf0f4f6);
  ground.material.color.set(darkMode ? 0x141b20 : 0xe7ecef);
}
function toggleDimensions() {
  dimensionsVisible = !dimensionsVisible;
  rebuildDimensions();
  return dimensionsVisible;
}
function cycleCamera() {
  cameraMode = (cameraMode + 1) % 3;
  applyCameraFrame(cameraMode);
  return cameraMode;
}
function syncToolButtons() {}
function closeToolPanels() { closeAddPanel(); }

window.BOOKSHELF_CONFIGURATOR_API = {
  captureState,
  restoreState,
  resetConfiguration,
  setLocale,
  setUnits,
  setDarkMode,
  setCurrency() {},
  toggleDimensions,
  cycleCamera,
  syncToolButtons,
  closeToolPanels,
};

bindControls();
resizeObserver = new ResizeObserver(resizeRenderer);
resizeObserver.observe(canvasHost);
resizeRenderer();
renderAll({ refit: true });
animate();
window.addEventListener('beforeunload', () => resizeObserver?.disconnect());
