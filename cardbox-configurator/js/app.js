import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const DEFAULT_COLOR = '#c78f5a';
const BOARD_EUR_M2 = 1.55;
const CURRENCY_FROM_EUR = Object.freeze({ EUR: 1, USD: 1.09, RON: 4.98 });
const LID_LIFT_MM = 300;
const SURFACE_TEXT_OFFSET_MM = 1.5;
const EPSILON = 1e-6;
const MAX_IMAGE_FILE_BYTES = 15_000_000;
const MAX_IMAGE_DATA_URL_CHARS = 220_000;
const MAX_TOTAL_IMAGE_DATA_URL_CHARS = 700_000;

const TEXT = Object.freeze({
  'en-US': Object.freeze({
    'intro.eyebrow': 'Packaging geometry',
    'intro.title': 'Cardboard box settings',
    'intro.copy': 'Start from a rectangular box, then build custom shapes by attaching additional box volumes to exposed faces.',
    'section.geometry': 'Base box',
    'section.summary': 'Summary & pricing',
    'dimension.width': 'Base width', 'dimension.depth': 'Base depth', 'dimension.height': 'Base height', 'dimension.floor': 'Board thickness',
    'geometry.helpTitle': 'Build the shape directly in 3D',
    'geometry.helpCopy': 'Double-click any exposed vertical face to select it. Use the plus button to attach another box volume. Joined areas become one continuous cavity with no internal wall.',
    'face.addText': 'Add text',
    'piece.title': 'New box piece', 'piece.help': 'Attached and centered on the selected face.', 'piece.width': 'Width', 'piece.height': 'Height', 'piece.depth': 'Depth',
    'text.title': 'Add text', 'text.help': 'Style the text, then place it on any inner or outer surface.', 'text.content': 'Text', 'text.size': 'Size', 'text.font': 'Font', 'text.color': 'Text', 'text.background': 'Background',
    'text.lockHorizontal': 'Lock to horizontal center line', 'text.lockVertical': 'Lock to vertical center line', 'text.liftTop': 'Lift the top by 300 mm', 'text.edit': 'Edit text', 'text.delete': 'Delete text', 'text.deselect': 'Deselect text', 'text.underlineStyle': 'Underline style', 'text.lineSolid': 'Solid', 'text.lineDashed': 'Dashed', 'text.lineDotted': 'Dotted', 'text.lineDouble': 'Double', 'text.done': 'Done', 'text.cancel': 'Cancel text placement', 'text.transparentBackground': 'Transparent background',
    'common.back': 'Back', 'common.done': 'Done', 'common.cancel': 'Cancel',
    'viewer.hint': 'Double-click a vertical face to select it.',
    'viewer.hint.placement': 'Text placement mode: move over any surface and click to place.',
    'summary.pieces': 'Box pieces', 'summary.faces': 'Exterior faces', 'summary.boardArea': 'Board area', 'summary.volume': 'Internal volume', 'summary.total': 'Estimated total',
    'summary.note': 'Indicative material and personalization estimate for one configured box.', 'summary.material': 'Cardboard', 'summary.text': 'Text finishing', 'summary.setup': 'Production setup',
    'error.invalidPiece': 'The new piece must have positive width, height and depth.',
  }),
  'ro-RO': Object.freeze({
    'intro.eyebrow': 'Geometrie ambalaj',
    'intro.title': 'Setări cutie din carton',
    'intro.copy': 'Pornește de la o cutie dreptunghiulară, apoi construiește forme personalizate atașând corpuri suplimentare pe fețele expuse.',
    'section.geometry': 'Cutia de bază', 'section.summary': 'Sumar și preț',
    'dimension.width': 'Lățime bază', 'dimension.depth': 'Adâncime bază', 'dimension.height': 'Înălțime bază', 'dimension.floor': 'Grosime carton',
    'geometry.helpTitle': 'Construiește forma direct în 3D',
    'geometry.helpCopy': 'Dublu-click pe orice față verticală expusă pentru selectare. Folosește butonul plus pentru a atașa un alt corp. Zonele unite devin o singură cavitate continuă, fără perete interior.',
    'face.addText': 'Adaugă text',
    'piece.title': 'Corp nou de cutie', 'piece.help': 'Atașat și centrat pe fața selectată.', 'piece.width': 'Lățime', 'piece.height': 'Înălțime', 'piece.depth': 'Adâncime',
    'text.title': 'Adaugă text', 'text.help': 'Stabilește stilul textului, apoi plasează-l pe orice suprafață interioară sau exterioară.', 'text.content': 'Text', 'text.size': 'Mărime', 'text.font': 'Font', 'text.color': 'Text', 'text.background': 'Fundal',
    'text.lockHorizontal': 'Blochează pe linia orizontală centrală', 'text.lockVertical': 'Blochează pe linia verticală centrală', 'text.liftTop': 'Ridică partea superioară cu 300 mm', 'text.edit': 'Editează textul', 'text.delete': 'Șterge textul', 'text.deselect': 'Deselectează textul', 'text.underlineStyle': 'Stil subliniere', 'text.lineSolid': 'Continuu', 'text.lineDashed': 'Întrerupt', 'text.lineDotted': 'Punctat', 'text.lineDouble': 'Dublu', 'text.done': 'Gata', 'text.cancel': 'Anulează plasarea textului', 'text.transparentBackground': 'Fundal transparent',
    'common.back': 'Înapoi', 'common.done': 'Gata', 'common.cancel': 'Anulează',
    'viewer.hint': 'Dublu-click pe o față verticală pentru a o selecta.',
    'viewer.hint.placement': 'Mod plasare text: mută cursorul pe orice suprafață și apasă click.',
    'summary.pieces': 'Corpuri cutie', 'summary.faces': 'Fețe exterioare', 'summary.boardArea': 'Suprafață carton', 'summary.volume': 'Volum interior', 'summary.total': 'Total estimat',
    'summary.note': 'Estimare orientativă de material și personalizare pentru o cutie configurată.', 'summary.material': 'Carton', 'summary.text': 'Finisaj text', 'summary.setup': 'Pregătire producție',
    'error.invalidPiece': 'Noul corp trebuie să aibă lățime, înălțime și adâncime pozitive.',
  }),
  'de-DE': Object.freeze({
    'intro.eyebrow': 'Verpackungsgeometrie',
    'intro.title': 'Kartonbox-Einstellungen',
    'intro.copy': 'Beginnen Sie mit einer rechteckigen Box und bauen Sie individuelle Formen, indem Sie zusätzliche Box-Volumen an freiliegende Flächen anfügen.',
    'section.geometry': 'Basisbox', 'section.summary': 'Übersicht & Preis',
    'dimension.width': 'Basisbreite', 'dimension.depth': 'Basistiefe', 'dimension.height': 'Basishöhe', 'dimension.floor': 'Kartonstärke',
    'geometry.helpTitle': 'Form direkt in 3D aufbauen',
    'geometry.helpCopy': 'Doppelklicken Sie auf eine freiliegende vertikale Fläche. Mit der Plus-Schaltfläche fügen Sie ein weiteres Box-Volumen hinzu. Verbundene Bereiche bilden einen durchgehenden Hohlraum ohne Innenwand.',
    'face.addText': 'Text hinzufügen',
    'piece.title': 'Neues Box-Element', 'piece.help': 'An der ausgewählten Fläche befestigt und zentriert.', 'piece.width': 'Breite', 'piece.height': 'Höhe', 'piece.depth': 'Tiefe',
    'text.title': 'Text hinzufügen', 'text.help': 'Definieren Sie den Textstil und platzieren Sie ihn anschließend auf jeder inneren oder äußeren Oberfläche.', 'text.content': 'Text', 'text.size': 'Größe', 'text.font': 'Schriftart', 'text.color': 'Text', 'text.background': 'Hintergrund',
    'text.lockHorizontal': 'Auf horizontaler Mittellinie fixieren', 'text.lockVertical': 'Auf vertikaler Mittellinie fixieren', 'text.liftTop': 'Oberseite um 300 mm anheben', 'text.edit': 'Text bearbeiten', 'text.delete': 'Text löschen', 'text.deselect': 'Text abwählen', 'text.underlineStyle': 'Unterstreichungsstil', 'text.lineSolid': 'Durchgezogen', 'text.lineDashed': 'Gestrichelt', 'text.lineDotted': 'Gepunktet', 'text.lineDouble': 'Doppelt', 'text.done': 'Fertig', 'text.cancel': 'Textplatzierung abbrechen', 'text.transparentBackground': 'Transparenter Hintergrund',
    'common.back': 'Zurück', 'common.done': 'Fertig', 'common.cancel': 'Abbrechen',
    'viewer.hint': 'Doppelklicken Sie auf eine vertikale Fläche, um sie auszuwählen.',
    'viewer.hint.placement': 'Textplatzierungsmodus: Bewegen Sie den Cursor über eine Oberfläche und klicken Sie.',
    'summary.pieces': 'Box-Elemente', 'summary.faces': 'Außenflächen', 'summary.boardArea': 'Kartonfläche', 'summary.volume': 'Innenvolumen', 'summary.total': 'Geschätzter Gesamtpreis',
    'summary.note': 'Unverbindliche Material- und Personalisierungsschätzung für eine konfigurierte Box.', 'summary.material': 'Karton', 'summary.text': 'Textveredelung', 'summary.setup': 'Produktionsvorbereitung',
    'error.invalidPiece': 'Das neue Element benötigt positive Werte für Breite, Höhe und Tiefe.',
  }),
});

const $ = (selector) => document.querySelector(selector);
const canvasHost = $('#canvasHost');
const dimensionLayer = $('#dimensionLayer');
const textGuideLayer = $('#textGuideLayer');
const textSelectionHud = $('#textSelectionHud');
const textHorizontalLockButton = $('#textHorizontalLockButton');
const textVerticalLockButton = $('#textVerticalLockButton');
const textLiftTopButton = $('#textLiftTopButton');
const textEditButton = $('#textEditButton');
const textDeleteButton = $('#textDeleteButton');
const textDismissButton = $('#textDismissButton');
const faceActionPopup = $('#faceActionPopup');
const faceDismissButton = $('#faceDismissButton');
const textEditorPanel = $('#textEditorPanel');
const addBoxEditor = $('#addBoxEditor');
const cancelTextPlacementButton = $('#cancelTextPlacementButton');
const viewerHint = $('#viewerHint');
const widthInput = $('#widthInput');
const depthInput = $('#depthInput');
const heightInput = $('#heightInput');
const floorThicknessInput = $('#floorThicknessInput');
const pieceWidthInput = $('#pieceWidthInput');
const pieceHeightInput = $('#pieceHeightInput');
const pieceDepthInput = $('#pieceDepthInput');
const pieceError = $('#pieceError');
const textContentInput = $('#textContentInput');
const textSizeInput = $('#textSizeInput');
const textFontSelect = $('#textFontSelect');
const textColorPalette = $('#textColorPalette');
const textBackgroundPalette = $('#textBackgroundPalette');
const textBoldToggle = $('#textBoldToggle');
const textItalicToggle = $('#textItalicToggle');
const textUnderlineToggle = $('#textUnderlineToggle');
const textUnderlineStyle = $('#textUnderlineStyle');
const summaryTotal = $('#summaryTotal');
const faceColorButton = $('#faceColorButton');
const faceImageButton = $('#faceImageButton');
const faceColorPanel = $('#faceColorPanel');
const faceColorPalette = $('#faceColorPalette');
const faceCurrentColorSwatch = $('#faceCurrentColorSwatch');
const faceColorSideLabel = $('#faceColorSideLabel');
const applyOuterColorButton = $('#applyOuterColorButton');
const applyInnerColorButton = $('#applyInnerColorButton');
const applyBothColorButton = $('#applyBothColorButton');
const backFromColorButton = $('#backFromColorButton');
const faceImageInput = $('#faceImageInput');
const cancelImagePlacementButton = $('#cancelImagePlacementButton');
const imageSelectionHud = $('#imageSelectionHud');
const imageResizeButton = $('#imageResizeButton');
const imageLiftTopButton = $('#imageLiftTopButton');
const imageDeleteButton = $('#imageDeleteButton');
const imageDismissButton = $('#imageDismissButton');
const imageResizePanel = $('#imageResizePanel');
const imageWidthInput = $('#imageWidthInput');
const imageHeightInput = $('#imageHeightInput');
const imageScaleInput = $('#imageScaleInput');
const imageScaleValue = $('#imageScaleValue');
const confirmImageResizeButton = $('#confirmImageResizeButton');
const cancelImageResizeButton = $('#cancelImageResizeButton');

let locale = localeForHost();
let units = locale === 'en-US' ? 'imperial' : 'metric';
let currency = locale === 'ro-RO' ? 'RON' : locale === 'de-DE' ? 'EUR' : 'USD';
let dimensionsVisible = true;
let technicalEdgesVisible = true;
let cameraMode = 0;
let resizeObserver;
let surfaceMeshes = [];
let surfaceDescriptors = [];
let selectedFaceKey = '';
let selectedFaceSnapshot = null;
let selectedFaceSideFactor = 1;
let addMode = false;
let draftBox = null;
let draftBeforeState = null;
let placementMode = false;
let pendingTextSpec = null;
let previewTextMesh = null;
let previewPlacement = null;
let editorPreviewSpec = null;
let currentTextColor = '#1f2d36';
let currentBackgroundColor = 'transparent';
let dimensionAnchors = [];
let selectedTextId = '';
let selectedTextConstraint = '';
let selectedTextConstraintFace = null;
let selectedTextConstraintSideFactor = 1;
let selectedTextConstraintFixedS = null;
let textDragging = false;
let textDragPointerId = null;
let textDragMoved = false;
let textGuidePoints = [];
let textHudAnchor = null;
let editingTextId = '';
let editingTextOriginalSpec = null;
let suppressCanvasClick = false;
let lidLiftEnabled = false;
let selectedFaceColor = DEFAULT_COLOR;
let imagePlacementMode = false;
let pendingImageSpec = null;
let pendingImageElement = null;
let previewImagePlacement = null;
let selectedImageId = '';
let imageDragging = false;
let imageDragPointerId = null;
let imageDragMoved = false;
let imageHudAnchor = null;
let imageRenderGeneration = 0;
let imageResizeOriginal = null;
let imageResizeStartWidth = 0;
let imageResizeStartHeight = 0;
let imageResizeUpdating = false;
const imageElementCache = new Map();

function makeBaseBox(width = 600, depth = 400, height = 300) {
  return { id: 'base', minX: -width / 2, maxX: width / 2, minY: 0, maxY: height, minZ: -depth / 2, maxZ: depth / 2 };
}

let state = {
  version: 4,
  boxes: [makeBaseBox()],
  boardThickness: 3,
  textPlacements: [],
};

function localeForHost() {
  const host = location.hostname.toLowerCase();
  if (host.includes('360configurator.ro')) return 'ro-RO';
  if (host.includes('360konfigurator.de')) return 'de-DE';
  return 'en-US';
}
function t(key) { return TEXT[locale]?.[key] ?? TEXT['en-US'][key] ?? key; }
function recordUndoCheckpoint() { window.CARDBOX_CONFIGURATOR_UNDO_HISTORY?.record?.(); }
function markConfigurationDirty() { window.CARDBOX_CONFIGURATOR_SHARED_SHELL?.markDirty?.(); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }
function round(value, digits = 4) { const f = 10 ** digits; return Math.round(value * f) / f; }
function toMm(value) { return units === 'imperial' ? Number(value) * 25.4 : Number(value); }
function fromMm(value) { return units === 'imperial' ? Number(value) / 25.4 : Number(value); }
function displayLength(mm) { return units === 'imperial' ? `${(mm / 25.4).toFixed(1)} in` : `${Math.round(mm)} mm`; }
function formatMoney(eur) {
  const rate = CURRENCY_FROM_EUR[currency] || 1;
  const amount = eur * rate;
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}
function cloneBox(box) { return { id: box.id, minX: box.minX, maxX: box.maxX, minY: box.minY, maxY: box.maxY, minZ: box.minZ, maxZ: box.maxZ }; }
function currentBoxes() { return draftBox ? [...state.boxes, draftBox] : state.boxes; }
function baseBox() { return state.boxes[0]; }
function uniqueSorted(values) { return [...new Set(values.map((v) => round(v, 6)))].sort((a, b) => a - b); }
function faceKey(face) { return [face.axis, face.sign, round(face.coord, 4), round(face.u1, 4), round(face.u2, 4), round(face.v1, 4), round(face.v2, 4)].join(':'); }

function makeTextPlacementId() {
  if (globalThis.crypto?.randomUUID) return `text-${globalThis.crypto.randomUUID()}`;
  return `text-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function copyFace(face) {
  if (!face) return null;
  return { axis: face.axis, sign: Number(face.sign), coord: Number(face.coord), u1: Number(face.u1), u2: Number(face.u2), v1: Number(face.v1), v2: Number(face.v2) };
}
function faceWorldCorners(face) {
  if (face.axis === 'x') return [
    new THREE.Vector3(face.coord, face.v1, face.u1), new THREE.Vector3(face.coord, face.v1, face.u2),
    new THREE.Vector3(face.coord, face.v2, face.u2), new THREE.Vector3(face.coord, face.v2, face.u1),
  ];
  if (face.axis === 'y') return [
    new THREE.Vector3(face.u1, face.coord, face.v1), new THREE.Vector3(face.u2, face.coord, face.v1),
    new THREE.Vector3(face.u2, face.coord, face.v2), new THREE.Vector3(face.u1, face.coord, face.v2),
  ];
  return [
    new THREE.Vector3(face.u1, face.v1, face.coord), new THREE.Vector3(face.u2, face.v1, face.coord),
    new THREE.Vector3(face.u2, face.v2, face.coord), new THREE.Vector3(face.u1, face.v2, face.coord),
  ];
}
function faceBasis(face, sideFactor = 1) {
  const normal = faceNormal(face).multiplyScalar(sideFactor >= 0 ? 1 : -1).normalize();
  const center = faceCenter(face);
  let horizontal;
  let vertical;
  if (isVerticalFace(face)) {
    vertical = new THREE.Vector3(0, 1, 0);
    horizontal = new THREE.Vector3().crossVectors(vertical, normal).normalize();
  } else {
    horizontal = new THREE.Vector3(1, 0, 0);
    vertical = new THREE.Vector3().crossVectors(normal, horizontal).normalize();
  }
  const projected = faceWorldCorners(face).map((point) => {
    const relative = point.clone().sub(center);
    return { h: relative.dot(horizontal), v: relative.dot(vertical) };
  });
  return {
    center, normal, horizontal, vertical,
    hMin: Math.min(...projected.map((p0) => p0.h)), hMax: Math.max(...projected.map((p0) => p0.h)),
    vMin: Math.min(...projected.map((p0) => p0.v)), vMax: Math.max(...projected.map((p0) => p0.v)),
  };
}
function facePointFromLocal(face, sideFactor, h, v, offset = 0) {
  const basis = faceBasis(face, sideFactor);
  return basis.center.clone()
    .add(basis.horizontal.clone().multiplyScalar(h))
    .add(basis.vertical.clone().multiplyScalar(v))
    .add(basis.normal.clone().multiplyScalar(offset));
}
function faceDisplayPointFromLocal(face, sideFactor, h, v, offset = 0) {
  const point = facePointFromLocal(face, sideFactor, h, v, offset);
  if (isTopFace(face) && isLidLiftActive()) point.y += LID_LIFT_MM;
  return point;
}
function pointToFaceLocal(face, sideFactor, point) {
  const basis = faceBasis(face, sideFactor);
  const relative = point.clone().sub(basis.center);
  return { h: relative.dot(basis.horizontal), v: relative.dot(basis.vertical), basis };
}
function clampPointToFace(face, sideFactor, point, marginH = 0, marginV = 0) {
  const local = pointToFaceLocal(face, sideFactor, point);
  const hMin = local.basis.hMin + Math.max(0, marginH);
  const hMax = local.basis.hMax - Math.max(0, marginH);
  const vMin = local.basis.vMin + Math.max(0, marginV);
  const vMax = local.basis.vMax - Math.max(0, marginV);
  const h = clamp(local.h, Math.min(hMin, hMax), Math.max(hMin, hMax));
  const v = clamp(local.v, Math.min(vMin, vMax), Math.max(vMin, vMax));
  return facePointFromLocal(face, sideFactor, h, v, 0);
}
function currentFaceForDescriptor(face) {
  if (!face) return null;
  const exact = surfaceDescriptors.find((candidate) => faceKey(candidate) === faceKey(face));
  if (exact) return exact;
  const center = faceCenter(face);
  return surfaceDescriptors.find((candidate) => {
    if (candidate.axis !== face.axis || candidate.sign !== face.sign || Math.abs(candidate.coord - face.coord) > 1.5) return false;
    if (candidate.axis === 'x') return center.z >= candidate.u1 - 2 && center.z <= candidate.u2 + 2 && center.y >= candidate.v1 - 2 && center.y <= candidate.v2 + 2;
    if (candidate.axis === 'y') return center.x >= candidate.u1 - 2 && center.x <= candidate.u2 + 2 && center.z >= candidate.v1 - 2 && center.z <= candidate.v2 + 2;
    return center.x >= candidate.u1 - 2 && center.x <= candidate.u2 + 2 && center.y >= candidate.v1 - 2 && center.y <= candidate.v2 + 2;
  }) || null;
}
function inferFaceForWorldPlane(position, normal = null) {
  let best = null;
  let bestScore = Infinity;
  for (const face of surfaceDescriptors) {
    const outward = faceNormal(face).normalize();
    if (normal && Math.abs(normal.clone().normalize().dot(outward)) < 0.88) continue;
    const center = faceCenter(face);
    const planeDistance = Math.abs(position.clone().sub(center).dot(outward));
    if (planeDistance > 8) continue;
    const basis = faceBasis(face, 1);
    const relative = position.clone().sub(center);
    const h = relative.dot(basis.horizontal);
    const v = relative.dot(basis.vertical);
    if (h < basis.hMin - 16 || h > basis.hMax + 16 || v < basis.vMin - 16 || v > basis.vMax + 16) continue;
    const alignmentPenalty = normal ? (1 - Math.abs(normal.clone().normalize().dot(outward))) * 20 : 0;
    const score = planeDistance + alignmentPenalty;
    if (score < bestScore) { best = face; bestScore = score; }
  }
  return best;
}
function segmentWorldNormal(segment) {
  const quaternion = new THREE.Quaternion().fromArray(segment.quaternion || [0, 0, 0, 1]);
  return new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize();
}
function segmentFaceInfo(segment) {
  const stored = currentFaceForDescriptor(segment.face);
  if (stored) {
    const normal = segmentWorldNormal(segment);
    return { face: stored, sideFactor: normal.dot(faceNormal(stored)) >= 0 ? 1 : -1 };
  }
  const position = new THREE.Vector3().fromArray(segment.position || [0, 0, 0]);
  const normal = segmentWorldNormal(segment);
  const face = inferFaceForWorldPlane(position, normal);
  if (!face) return null;
  return { face, sideFactor: normal.dot(faceNormal(face)) >= 0 ? 1 : -1 };
}
function ensurePlacementId(placement) {
  if (!placement.id) placement.id = makeTextPlacementId();
  return placement.id;
}
function resolvePlacementFaceInfo(placement) {
  if (!placement) return null;
  ensurePlacementId(placement);
  let face = currentFaceForDescriptor(placement.face);
  let sideFactor = Number(placement.sideFactor) < 0 ? -1 : 1;
  let anchor = Array.isArray(placement.anchor) ? new THREE.Vector3().fromArray(placement.anchor) : null;

  // Older wrapped stickers did not store an anchor. The strip closest to the
  // center of the artwork is the best reconstruction of the original click
  // point and avoids moving the sticker when it is first edited after upgrade.
  if ((!face || !anchor) && Array.isArray(placement.segments) && placement.segments.length) {
    const ordered = [...placement.segments].sort((a, b) => {
      const ca = Math.abs(((Number(a.u0) || 0) + (Number(a.u1) || 1)) / 2 - 0.5);
      const cb = Math.abs(((Number(b.u0) || 0) + (Number(b.u1) || 1)) / 2 - 0.5);
      return ca - cb;
    });
    for (const segment of ordered) {
      const info = segmentFaceInfo(segment);
      if (!info) continue;
      face = face || info.face;
      sideFactor = info.sideFactor;
      if (!anchor) anchor = new THREE.Vector3().fromArray(segment.position || [0,0,0]);
      if (!segment.face) segment.face = copyFace(info.face);
      break;
    }
  }

  if (!face && Array.isArray(placement.position)) {
    const position = new THREE.Vector3().fromArray(placement.position);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion().fromArray(placement.quaternion || [0,0,0,1])).normalize();
    face = inferFaceForWorldPlane(position, normal);
    if (face) sideFactor = normal.dot(faceNormal(face)) >= 0 ? 1 : -1;
    if (!anchor) anchor = position.clone();
  }
  if (!face) return null;
  if (!anchor) anchor = faceCenter(face);
  const basis = faceBasis(face, sideFactor);
  anchor.sub(basis.normal.clone().multiplyScalar(anchor.clone().sub(basis.center).dot(basis.normal)));
  placement.face = copyFace(face);
  placement.sideFactor = sideFactor;
  placement.anchor = anchor.toArray();
  return { face, sideFactor, anchor };
}
function resolvePlacementPrimaryFaceInfo(placement) {
  if (!placement) return null;
  if (!Array.isArray(placement.segments) || !placement.segments.length) return resolvePlacementFaceInfo(placement);
  const weights = new Map();
  const centers = new Map();
  const sideFactors = new Map();
  for (const segment of placement.segments) {
    const info = segmentFaceInfo(segment);
    if (!info) continue;
    const key = faceKey(info.face);
    const weight = Math.max(1, Number(segment.width) || 1);
    weights.set(key, (weights.get(key) || 0) + weight);
    const entry = centers.get(key) || { point: new THREE.Vector3(), weight: 0 };
    entry.point.add(new THREE.Vector3().fromArray(segment.position || [0,0,0]).multiplyScalar(weight));
    entry.weight += weight;
    centers.set(key, entry);
    sideFactors.set(key, info.sideFactor);
  }
  if (!weights.size) return resolvePlacementFaceInfo(placement);
  const key = [...weights.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const face = surfaceDescriptors.find((candidate) => faceKey(candidate) === key);
  if (!face) return resolvePlacementFaceInfo(placement);
  const sideFactor = sideFactors.get(key) || 1;
  const entry = centers.get(key);
  let anchor = entry?.weight ? entry.point.multiplyScalar(1 / entry.weight) : faceCenter(face);
  const basis = faceBasis(face, sideFactor);
  anchor.sub(basis.normal.clone().multiplyScalar(anchor.clone().sub(basis.center).dot(basis.normal)));
  return { face, sideFactor, anchor };
}

function buildUnionGrid(boxes) {
  const xs = uniqueSorted(boxes.flatMap((b) => [b.minX, b.maxX]));
  const ys = uniqueSorted(boxes.flatMap((b) => [b.minY, b.maxY]));
  const zs = uniqueSorted(boxes.flatMap((b) => [b.minZ, b.maxZ]));
  const occupied = Array.from({ length: xs.length - 1 }, () => Array.from({ length: ys.length - 1 }, () => Array(zs.length - 1).fill(false)));
  for (let ix = 0; ix < xs.length - 1; ix += 1) {
    const cx = (xs[ix] + xs[ix + 1]) / 2;
    for (let iy = 0; iy < ys.length - 1; iy += 1) {
      const cy = (ys[iy] + ys[iy + 1]) / 2;
      for (let iz = 0; iz < zs.length - 1; iz += 1) {
        const cz = (zs[iz] + zs[iz + 1]) / 2;
        occupied[ix][iy][iz] = boxes.some((b) => cx > b.minX - EPSILON && cx < b.maxX + EPSILON && cy > b.minY - EPSILON && cy < b.maxY + EPSILON && cz > b.minZ - EPSILON && cz < b.maxZ + EPSILON);
      }
    }
  }
  return { xs, ys, zs, occupied };
}

function collectBoundaryTiles(grid) {
  const { xs, ys, zs, occupied } = grid;
  const tiles = [];
  const nx = xs.length - 1, ny = ys.length - 1, nz = zs.length - 1;
  const isOcc = (ix, iy, iz) => ix >= 0 && iy >= 0 && iz >= 0 && ix < nx && iy < ny && iz < nz && occupied[ix][iy][iz];
  for (let ix = 0; ix < nx; ix += 1) {
    for (let iy = 0; iy < ny; iy += 1) {
      for (let iz = 0; iz < nz; iz += 1) {
        if (!occupied[ix][iy][iz]) continue;
        if (!isOcc(ix - 1, iy, iz)) tiles.push({ axis: 'x', sign: -1, coord: xs[ix], u1: zs[iz], u2: zs[iz + 1], v1: ys[iy], v2: ys[iy + 1] });
        if (!isOcc(ix + 1, iy, iz)) tiles.push({ axis: 'x', sign: 1, coord: xs[ix + 1], u1: zs[iz], u2: zs[iz + 1], v1: ys[iy], v2: ys[iy + 1] });
        if (!isOcc(ix, iy - 1, iz)) tiles.push({ axis: 'y', sign: -1, coord: ys[iy], u1: xs[ix], u2: xs[ix + 1], v1: zs[iz], v2: zs[iz + 1] });
        if (!isOcc(ix, iy + 1, iz)) tiles.push({ axis: 'y', sign: 1, coord: ys[iy + 1], u1: xs[ix], u2: xs[ix + 1], v1: zs[iz], v2: zs[iz + 1] });
        if (!isOcc(ix, iy, iz - 1)) tiles.push({ axis: 'z', sign: -1, coord: zs[iz], u1: xs[ix], u2: xs[ix + 1], v1: ys[iy], v2: ys[iy + 1] });
        if (!isOcc(ix, iy, iz + 1)) tiles.push({ axis: 'z', sign: 1, coord: zs[iz + 1], u1: xs[ix], u2: xs[ix + 1], v1: ys[iy], v2: ys[iy + 1] });
      }
    }
  }
  return tiles;
}

function mergeTiles(tiles) {
  const groups = new Map();
  for (const tile of tiles) {
    const key = `${tile.axis}:${tile.sign}:${round(tile.coord, 6)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tile);
  }
  const faces = [];
  for (const group of groups.values()) {
    const uCoords = uniqueSorted(group.flatMap((t0) => [t0.u1, t0.u2]));
    const vCoords = uniqueSorted(group.flatMap((t0) => [t0.v1, t0.v2]));
    const cells = Array.from({ length: uCoords.length - 1 }, () => Array(vCoords.length - 1).fill(false));
    for (const tile of group) {
      const iu = uCoords.findIndex((v) => Math.abs(v - tile.u1) < EPSILON);
      const iv = vCoords.findIndex((v) => Math.abs(v - tile.v1) < EPSILON);
      if (iu >= 0 && iv >= 0) cells[iu][iv] = true;
    }
    const used = cells.map((row) => row.map(() => false));
    for (let iu = 0; iu < cells.length; iu += 1) {
      for (let iv = 0; iv < cells[iu].length; iv += 1) {
        if (!cells[iu][iv] || used[iu][iv]) continue;
        let endU = iu;
        while (endU + 1 < cells.length && cells[endU + 1][iv] && !used[endU + 1][iv]) endU += 1;
        let endV = iv;
        outer: while (endV + 1 < cells[iu].length) {
          for (let u = iu; u <= endU; u += 1) if (!cells[u][endV + 1] || used[u][endV + 1]) break outer;
          endV += 1;
        }
        for (let u = iu; u <= endU; u += 1) for (let v = iv; v <= endV; v += 1) used[u][v] = true;
        const seed = group[0];
        faces.push({ axis: seed.axis, sign: seed.sign, coord: seed.coord, u1: uCoords[iu], u2: uCoords[endU + 1], v1: vCoords[iv], v2: vCoords[endV + 1] });
      }
    }
  }
  return faces;
}

function calculateUnionMetrics(boxes = state.boxes) {
  const grid = buildUnionGrid(boxes);
  const { xs, ys, zs, occupied } = grid;
  let volume = 0;
  for (let ix = 0; ix < xs.length - 1; ix += 1) for (let iy = 0; iy < ys.length - 1; iy += 1) for (let iz = 0; iz < zs.length - 1; iz += 1) {
    if (occupied[ix][iy][iz]) volume += (xs[ix + 1] - xs[ix]) * (ys[iy + 1] - ys[iy]) * (zs[iz + 1] - zs[iz]);
  }
  const faces = mergeTiles(collectBoundaryTiles(grid));
  const area = faces.reduce((sum, face) => sum + (face.u2 - face.u1) * (face.v2 - face.v1), 0);
  return { volumeMm3: volume, areaMm2: area, faces };
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f4f6);
const camera = new THREE.PerspectiveCamera(38, 1, 1, 12000);
camera.position.set(850, 720, 900);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
canvasHost.append(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 180;
controls.maxDistance = 5200;
controls.maxPolarAngle = Math.PI * 0.49;
controls.target.set(0, 120, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a979f, 2.1));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.7); keyLight.position.set(900, 1100, 620); keyLight.castShadow = true; keyLight.shadow.mapSize.set(2048, 2048); scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xb8dbf1, 1.1); fillLight.position.set(-700, 500, -500); scene.add(fillLight);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: 0xe7ecef, roughness: 1, metalness: 0 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -4; ground.receiveShadow = true; scene.add(ground);
const gridHelper = new THREE.GridHelper(5000, 100, 0xc6d2d8, 0xdce4e8); gridHelper.position.y = -3; gridHelper.material.opacity = 0.32; gridHelper.material.transparent = true; scene.add(gridHelper);
const boxGroup = new THREE.Group(); scene.add(boxGroup);
const textGroup = new THREE.Group(); scene.add(textGroup);
const editorPreviewGroup = new THREE.Group(); scene.add(editorPreviewGroup);
const previewGroup = new THREE.Group(); scene.add(previewGroup);
const textSelectionGroup = new THREE.Group(); scene.add(textSelectionGroup);
const imageGroup = new THREE.Group(); scene.add(imageGroup);
const imagePreviewGroup = new THREE.Group(); scene.add(imagePreviewGroup);
const imageSelectionGroup = new THREE.Group(); scene.add(imageSelectionGroup);

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => { material.map?.dispose?.(); material.dispose?.(); });
    }
  });
}
function clearGroup(group) {
  for (const child of [...group.children]) { group.remove(child); disposeObject(child); }
}
function faceNormal(face) {
  if (face.axis === 'x') return new THREE.Vector3(face.sign, 0, 0);
  if (face.axis === 'y') return new THREE.Vector3(0, face.sign, 0);
  return new THREE.Vector3(0, 0, face.sign);
}
function faceCenter(face) {
  if (face.axis === 'x') return new THREE.Vector3(face.coord, (face.v1 + face.v2) / 2, (face.u1 + face.u2) / 2);
  if (face.axis === 'y') return new THREE.Vector3((face.u1 + face.u2) / 2, face.coord, (face.v1 + face.v2) / 2);
  return new THREE.Vector3((face.u1 + face.u2) / 2, (face.v1 + face.v2) / 2, face.coord);
}
function faceHorizontalWidth(face) { return face.u2 - face.u1; }
function faceHeight(face) { return face.v2 - face.v1; }
function isVerticalFace(face) { return face.axis === 'x' || face.axis === 'z'; }
function isTopFace(face) { return face.axis === 'y' && face.sign > 0; }
function isBottomFace(face) { return face.axis === 'y' && face.sign < 0; }

function isLidLiftActive() {
  return lidLiftEnabled;
}
function sameVerticalPlane(a, b, tolerance = 0.75) {
  return Boolean(a && b)
    && isVerticalFace(a) && isVerticalFace(b)
    && a.axis === b.axis
    && a.sign === b.sign
    && Math.abs(a.coord - b.coord) <= tolerance;
}
function verticalPlaneEntries(referenceFace, sideFactor = 1) {
  if (!isVerticalFace(referenceFace)) return [];
  const horizontal = verticalFaceTangent(referenceFace, sideFactor).normalize();
  return surfaceDescriptors
    .filter((candidate) => sameVerticalPlane(referenceFace, candidate))
    .map((face) => {
      const a = verticalFaceEndpoint(face, 'u1', (face.v1 + face.v2) / 2);
      const b = verticalFaceEndpoint(face, 'u2', (face.v1 + face.v2) / 2);
      const sa = a.dot(horizontal);
      const sb = b.dot(horizontal);
      return { face, sMin: Math.min(sa, sb), sMax: Math.max(sa, sb), yMin: face.v1, yMax: face.v2 };
    });
}
function mergeIntervals(intervals = [], tolerance = 0.75) {
  const sorted = intervals
    .filter((interval) => Number.isFinite(interval.min) && Number.isFinite(interval.max))
    .map((interval) => ({ min: Math.min(interval.min, interval.max), max: Math.max(interval.min, interval.max) }))
    .sort((a, b) => a.min - b.min);
  const merged = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (!last || interval.min > last.max + tolerance) merged.push({ ...interval });
    else last.max = Math.max(last.max, interval.max);
  }
  return merged;
}
function intervalContainingOrNearest(intervals, value) {
  if (!intervals.length) return null;
  const containing = intervals.find((interval) => value >= interval.min - EPSILON && value <= interval.max + EPSILON);
  if (containing) return containing;
  return [...intervals].sort((a, b) => {
    const da = value < a.min ? a.min - value : value - a.max;
    const db = value < b.min ? b.min - value : value - b.max;
    return da - db;
  })[0];
}
function verticalPlanePoint(referenceFace, sideFactor, s, y) {
  const normal = faceNormal(referenceFace).multiplyScalar(sideFactor >= 0 ? 1 : -1).normalize();
  const horizontal = verticalFaceTangent(referenceFace, sideFactor).normalize();
  const planeDistance = faceCenter(referenceFace).dot(normal);
  return horizontal.clone().multiplyScalar(s)
    .add(new THREE.Vector3(0, y, 0))
    .add(normal.clone().multiplyScalar(planeDistance));
}
function planeHorizontalRunAtY(referenceFace, sideFactor, y, s) {
  const entries = verticalPlaneEntries(referenceFace, sideFactor);
  const runs = mergeIntervals(entries
    .filter((entry) => y >= entry.yMin - EPSILON && y <= entry.yMax + EPSILON)
    .map((entry) => ({ min: entry.sMin, max: entry.sMax })));
  return intervalContainingOrNearest(runs, s);
}
function planeVerticalRunAtS(referenceFace, sideFactor, s, y) {
  const entries = verticalPlaneEntries(referenceFace, sideFactor);
  const runs = mergeIntervals(entries
    .filter((entry) => s >= entry.sMin - EPSILON && s <= entry.sMax + EPSILON)
    .map((entry) => ({ min: entry.yMin, max: entry.yMax })));
  return intervalContainingOrNearest(runs, y);
}
function planeFaceAt(referenceFace, sideFactor, s, preferredY) {
  const entries = verticalPlaneEntries(referenceFace, sideFactor);
  const candidates = entries.filter((entry) => s >= entry.sMin - EPSILON && s <= entry.sMax + EPSILON);
  if (!candidates.length) return null;
  const containingY = candidates.filter((entry) => preferredY >= entry.yMin - EPSILON && preferredY <= entry.yMax + EPSILON);
  const source = containingY.length ? containingY : candidates;
  return [...source].sort((a, b) => {
    const ac = (a.yMin + a.yMax) / 2;
    const bc = (b.yMin + b.yMax) / 2;
    return Math.abs(ac - preferredY) - Math.abs(bc - preferredY);
  })[0]?.face || null;
}
function stickerDimensionsForFace(spec, face) {
  const artwork = createTextArtwork(spec);
  const availableHeight = Math.max(36, faceHeight(face) - 8);
  const scale = Math.min(1, availableHeight / artwork.worldHeight);
  const result = { width: artwork.worldWidth * scale, height: artwork.worldHeight * scale };
  artwork.texture.dispose();
  return result;
}
function verticalFaceTangent(face, sideFactor = 1) {
  const normal = faceNormal(face).multiplyScalar(sideFactor);
  return new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), normal).normalize();
}
function verticalFaceEndpoint(face, which, y) {
  if (face.axis === 'x') return new THREE.Vector3(face.coord, y, which === 'u1' ? face.u1 : face.u2);
  return new THREE.Vector3(which === 'u1' ? face.u1 : face.u2, y, face.coord);
}
function sameHorizontalPoint(a, b, tolerance = 0.75) {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.z - b.z) <= tolerance;
}
function faceContainsY(face, y) {
  return y >= face.v1 - EPSILON && y <= face.v2 + EPSILON;
}
function adjacentVerticalFace(currentFace, edgePoint, y, sideFactor = 1, directionSign = 1, currentDirection = null) {
  const candidates = surfaceDescriptors.filter((candidate) => {
    if (!isVerticalFace(candidate) || faceKey(candidate) === faceKey(currentFace) || !faceContainsY(candidate, y)) return false;
    const a = verticalFaceEndpoint(candidate, 'u1', y);
    const b = verticalFaceEndpoint(candidate, 'u2', y);
    return sameHorizontalPoint(a, edgePoint) || sameHorizontalPoint(b, edgePoint);
  });
  if (!candidates.length) return null;
  if (!currentDirection) return candidates[0];
  return candidates.sort((lhs, rhs) => {
    const leftDirection = verticalFaceTangent(lhs, sideFactor).multiplyScalar(directionSign).normalize();
    const rightDirection = verticalFaceTangent(rhs, sideFactor).multiplyScalar(directionSign).normalize();
    return rightDirection.dot(currentDirection) - leftDirection.dot(currentDirection);
  })[0] || null;
}
function walkStickerOffset(startFace, startPoint, sideFactor, offset) {
  if (!isVerticalFace(startFace) || Math.abs(offset) < EPSILON) {
    return { face: startFace, point: startPoint.clone(), tangent: verticalFaceTangent(startFace, sideFactor), normal: faceNormal(startFace).multiplyScalar(sideFactor) };
  }
  const sign = offset >= 0 ? 1 : -1;
  let remaining = Math.abs(offset);
  let face = startFace;
  let point = startPoint.clone();
  const y = startPoint.y;
  for (let step = 0; step < 48; step += 1) {
    const canonical = verticalFaceTangent(face, sideFactor);
    const direction = canonical.clone().multiplyScalar(sign).normalize();
    const a = verticalFaceEndpoint(face, 'u1', y);
    const b = verticalFaceEndpoint(face, 'u2', y);
    const da = a.clone().sub(point).dot(direction);
    const db = b.clone().sub(point).dot(direction);
    const candidates = [[da, a], [db, b]].filter(([distance]) => distance > EPSILON).sort((lhs, rhs) => lhs[0] - rhs[0]);

    // When the anchor itself sits exactly on a face boundary, the old walker
    // had no positive in-face distance and pinned every remaining strip to the
    // corner. Continue immediately onto the adjacent surface instead so the
    // sticker bends rather than visually compressing at the edge.
    if (!candidates.length) {
      const nextFace = adjacentVerticalFace(face, point, y, sideFactor, sign, direction);
      if (!nextFace) return { face, point, tangent: canonical, normal: faceNormal(face).multiplyScalar(sideFactor), blocked: true };
      face = nextFace;
      continue;
    }

    const [distanceToEdge, edgePoint] = candidates[0];
    if (remaining < distanceToEdge - EPSILON) {
      point.add(direction.multiplyScalar(remaining));
      return { face, point, tangent: canonical, normal: faceNormal(face).multiplyScalar(sideFactor), blocked: false };
    }
    if (Math.abs(remaining - distanceToEdge) <= EPSILON) {
      point.copy(edgePoint);
      return { face, point, tangent: canonical, normal: faceNormal(face).multiplyScalar(sideFactor), blocked: false };
    }
    remaining -= distanceToEdge;
    point.copy(edgePoint);
    const nextFace = adjacentVerticalFace(face, point, y, sideFactor, sign, direction);
    if (!nextFace) return { face, point, tangent: canonical, normal: faceNormal(face).multiplyScalar(sideFactor), blocked: true };
    face = nextFace;
  }
  return { face, point, tangent: verticalFaceTangent(face, sideFactor), normal: faceNormal(face).multiplyScalar(sideFactor), blocked: true };
}
function selectedFaceHighlightVisible(face) {
  return Boolean(selectedFaceSnapshot)
    && faceKey(face) === selectedFaceKey
    && textEditorPanel.hidden
    && !addMode
    && !placementMode;
}
function addSelectionMarkers(mesh, face) {
  if (!selectedFaceHighlightVisible(face)) return;
  const width = face.u2 - face.u1;
  const height = face.v2 - face.v1;
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x0e82d8, side: THREE.DoubleSide, depthTest: false });
  const markerGeometry = new THREE.RingGeometry(4, 6.5, 20);
  const z = selectedFaceSideFactor * 1.8;
  for (const [x, y] of [[-width/2,-height/2],[width/2,-height/2],[-width/2,height/2],[width/2,height/2]]) {
    const marker = new THREE.Mesh(markerGeometry, ringMaterial.clone());
    marker.position.set(x, y, z);
    marker.renderOrder = 5;
    mesh.add(marker);
  }
}
function makeSurfaceMesh(face) {
  const width = face.u2 - face.u1;
  const height = face.v2 - face.v1;
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshStandardMaterial({ color: DEFAULT_COLOR, roughness: 0.84, metalness: 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  const normal = faceNormal(face);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  const center = faceCenter(face);
  if (isLidLiftActive() && isTopFace(face)) center.y += LID_LIFT_MM;
  mesh.position.copy(center);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.cardboxSurface = true;
  mesh.userData.face = face;
  mesh.userData.faceKey = faceKey(face);
  mesh.userData.vertical = isVerticalFace(face);
  mesh.userData.top = isTopFace(face);
  mesh.userData.bottom = isBottomFace(face);
  addSelectionMarkers(mesh, face);
  return mesh;
}
function rebuildSurfaceMeshes() {
  clearGroup(boxGroup);
  surfaceMeshes = [];
  const metrics = calculateUnionMetrics(currentBoxes());
  surfaceDescriptors = metrics.faces;
  dimensionAnchors = [];
  for (const face of surfaceDescriptors) {
    const mesh = makeSurfaceMesh(face);
    boxGroup.add(mesh);
    surfaceMeshes.push(mesh);
    const highlighted = selectedFaceHighlightVisible(face);
    if (technicalEdgesVisible || highlighted) {
      const edgeMaterial = new THREE.LineBasicMaterial({ color: highlighted ? 0x0e82d8 : 0x755335, transparent: true, opacity: highlighted ? 0.95 : 0.38, depthTest: !highlighted });
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMaterial);
      edges.renderOrder = highlighted ? 4 : 0;
      mesh.add(edges);
    }
    if (isVerticalFace(face)) {
      const anchor = faceCenter(face);
      anchor.y = face.v2 + 24;
      dimensionAnchors.push({ point: anchor, label: displayLength(faceHorizontalWidth(face)) });
    }
  }
  renderPlacedTexts();
  renderDimensions();
  fitControlsTarget();
}

function boundsForBoxes(boxes = currentBoxes()) {
  return {
    minX: Math.min(...boxes.map((b) => b.minX)), maxX: Math.max(...boxes.map((b) => b.maxX)),
    minY: Math.min(...boxes.map((b) => b.minY)), maxY: Math.max(...boxes.map((b) => b.maxY)),
    minZ: Math.min(...boxes.map((b) => b.minZ)), maxZ: Math.max(...boxes.map((b) => b.maxZ)),
  };
}
function fitControlsTarget() {
  const b = boundsForBoxes();
  controls.target.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2 + (isLidLiftActive() ? LID_LIFT_MM * 0.08 : 0), (b.minZ + b.maxZ) / 2);
}

function createTextArtwork(spec) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontPx = clamp(spec.size || 54, 12, 180);
  const weight = spec.bold ? '700' : '500';
  const style = spec.italic ? 'italic' : 'normal';
  ctx.font = `${style} ${weight} ${fontPx}px ${spec.fontFamily}`;
  const padding = Math.max(16, fontPx * 0.35);
  const measured = Math.max(ctx.measureText(spec.text).width, fontPx);
  canvas.width = Math.ceil(measured + padding * 2);
  canvas.height = Math.ceil(fontPx + padding * 2 + (spec.underline ? fontPx * 0.3 : 0));
  const draw = canvas.getContext('2d');
  draw.clearRect(0, 0, canvas.width, canvas.height);
  if (!isTransparentColor(spec.backgroundColor)) {
    draw.fillStyle = spec.backgroundColor;
    draw.fillRect(0, 0, canvas.width, canvas.height);
  }
  draw.font = `${style} ${weight} ${fontPx}px ${spec.fontFamily}`;
  draw.textAlign = 'center'; draw.textBaseline = 'middle'; draw.fillStyle = spec.textColor;
  const textY = canvas.height / 2 - (spec.underline ? fontPx * 0.08 : 0);
  draw.fillText(spec.text, canvas.width / 2, textY);
  if (spec.underline) {
    const y = textY + fontPx * 0.42;
    draw.strokeStyle = spec.textColor; draw.lineWidth = Math.max(2, fontPx * 0.06);
    if (spec.underlineStyle === 'dashed') draw.setLineDash([12, 8]);
    if (spec.underlineStyle === 'dotted') { draw.setLineDash([2, 7]); draw.lineCap = 'round'; }
    if (spec.underlineStyle === 'double') {
      draw.beginPath(); draw.moveTo(padding, y - 3); draw.lineTo(canvas.width - padding, y - 3); draw.moveTo(padding, y + 3); draw.lineTo(canvas.width - padding, y + 3); draw.stroke();
    } else {
      draw.beginPath(); draw.moveTo(padding, y); draw.lineTo(canvas.width - padding, y); draw.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const worldHeight = clamp(fontPx * 1.8, 48, 360);
  const worldWidth = worldHeight * canvas.width / canvas.height;
  return { texture, worldWidth, worldHeight };
}
function makeArtworkPlane(artwork, width, height, opacity = 1, u0 = 0, u1 = 1) {
  const geometry = new THREE.PlaneGeometry(width, height);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) uv.setX(i, uv.getX(i) < 0.5 ? u0 : u1);
  uv.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({ map: artwork.texture, transparent: true, side: THREE.DoubleSide, opacity, depthWrite: opacity >= 1 });
  return new THREE.Mesh(geometry, material);
}
function createTextMesh(spec, opacity = 1) {
  const artwork = createTextArtwork(spec);
  return makeArtworkPlane(artwork, artwork.worldWidth, artwork.worldHeight, opacity);
}
function createWrappedSticker(spec, face, anchorPoint, sideFactor = 1, opacity = 1) {
  const artwork = createTextArtwork(spec);
  const availableHeight = Math.max(36, faceHeight(face) - 8);
  const scale = Math.min(1, availableHeight / artwork.worldHeight);
  const width = artwork.worldWidth * scale;
  const height = artwork.worldHeight * scale;
  const anchor = anchorPoint.clone();
  anchor.y = clamp(anchor.y, face.v1 + height / 2, face.v2 - height / 2);
  const group = new THREE.Group();
  const segments = [];
  const minimumSliceWidth = 0.18;

  function mappedAtU(u, insetDirection = 0, rangeWidth = width) {
    const inset = Math.min(0.04, Math.max(0, rangeWidth * 0.08));
    const adjustedOffset = -width / 2 + width * u + inset * insetDirection;
    return walkStickerOffset(face, anchor, sideFactor, adjustedOffset);
  }

  function emitRange(u0, u1) {
    const segmentWidth = width * (u1 - u0);
    if (segmentWidth <= EPSILON) return;
    const midU = (u0 + u1) / 2;
    const mapped = mappedAtU(midU, 0, segmentWidth);
    // If there is no physical surface after an edge, crop the sticker there.
    // Never keep drawing strips at the edge point because that makes the unused
    // artwork appear to float or collapse into a black spike in space.
    if (!mapped?.face || mapped.blocked) return;
    const segment = makeArtworkPlane(artwork, segmentWidth, height, opacity, u0, u1);
    const normal = mapped.normal.clone().normalize();
    const position = mapped.point.clone().add(normal.clone().multiplyScalar(SURFACE_TEXT_OFFSET_MM));
    segment.position.copy(position);
    segment.quaternion.copy(quaternionForNormal(normal));
    group.add(segment);
    segments.push({
      position: position.toArray(), quaternion: segment.quaternion.toArray(),
      u0, u1, width: segmentWidth, height, face: copyFace(mapped.face), sideFactor,
    });
  }

  function addRange(u0, u1, depth = 0) {
    const segmentWidth = width * (u1 - u0);
    if (segmentWidth <= EPSILON) return;
    const insetU = Math.min((0.04 / Math.max(width, 1)), (u1 - u0) * 0.2);
    const left = mappedAtU(u0 + insetU, 0, segmentWidth);
    const right = mappedAtU(u1 - insetU, 0, segmentWidth);
    const middle = mappedAtU((u0 + u1) / 2, 0, segmentWidth);
    const keys = [left, middle, right].map((mapped) => mapped?.face ? faceKey(mapped.face) : '');
    const samePhysicalFace = keys[0] && keys.every((key) => key === keys[0]);
    const blocked = Boolean(left?.blocked || middle?.blocked || right?.blocked);

    if (samePhysicalFace && !blocked) {
      emitRange(u0, u1);
      return;
    }
    if (segmentWidth <= minimumSliceWidth || depth >= 18) {
      // At a corner keep only the portion whose midpoint really lies on a
      // surface. This sub-millimetre fallback removes the last visual sliver
      // that could otherwise bridge the two planes.
      emitRange(u0, u1);
      return;
    }
    const mid = (u0 + u1) / 2;
    addRange(u0, mid, depth + 1);
    addRange(mid, u1, depth + 1);
  }

  // Coarse ranges make flat sections cheap; only ranges that actually cross a
  // corner are recursively subdivided down to the exact bend.
  const coarseCount = Math.max(4, Math.min(24, Math.ceil(width / 36)));
  for (let i = 0; i < coarseCount; i += 1) addRange(i / coarseCount, (i + 1) / coarseCount);
  return { group, segments };
}
function createStoredStickerSegments(spec, segments, opacity = 1) {
  const artwork = createTextArtwork(spec);
  const group = new THREE.Group();
  for (const segmentData of segments) {
    const segment = makeArtworkPlane(artwork, Number(segmentData.width) || 10, Number(segmentData.height) || artwork.worldHeight, opacity, Number(segmentData.u0) || 0, Number(segmentData.u1) || 1);
    segment.position.fromArray(segmentData.position || [0, 0, 0]);
    segment.quaternion.fromArray(segmentData.quaternion || [0, 0, 0, 1]);
    group.add(segment);
  }
  return group;
}
function tagTextRenderable(object, placementId) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.userData.cardboxText = true;
    child.userData.textPlacementId = placementId;
  });
}
function renderPlacedTexts() {
  clearGroup(textGroup);
  for (const placement of state.textPlacements) {
    const placementId = ensurePlacementId(placement);
    if (placementId === editingTextId) continue;
    const resolved = resolvePlacementFaceInfo(placement);
    if (resolved?.face && isVerticalFace(resolved.face) && resolved.anchor) {
      const sticker = createWrappedSticker(placement.spec, resolved.face, resolved.anchor.clone(), resolved.sideFactor, 1);
      placement.face = copyFace(resolved.face);
      placement.sideFactor = resolved.sideFactor;
      placement.anchor = resolved.anchor.toArray();
      placement.segments = sticker.segments.map((segment) => ({
        ...segment,
        position: [...segment.position], quaternion: [...segment.quaternion], face: copyFace(segment.face),
      }));
      placement.position = undefined;
      placement.quaternion = undefined;
      placement.topSurface = false;
      tagTextRenderable(sticker.group, placementId);
      textGroup.add(sticker.group);
      continue;
    }
    if (Array.isArray(placement.segments) && placement.segments.length) {
      const group = createStoredStickerSegments(placement.spec, placement.segments, 1);
      tagTextRenderable(group, placementId);
      textGroup.add(group);
      continue;
    }
    if (!Array.isArray(placement.position)) continue;
    const mesh = createTextMesh(placement.spec, 1);
    const position = new THREE.Vector3().fromArray(placement.position);
    if (placement.topSurface && isLidLiftActive()) position.y += LID_LIFT_MM;
    mesh.position.copy(position);
    mesh.quaternion.fromArray(placement.quaternion || [0,0,0,1]);
    mesh.userData.cardboxText = true;
    mesh.userData.textPlacementId = placementId;
    textGroup.add(mesh);
  }
}

function placementById(id) {
  return state.textPlacements.find((placement) => ensurePlacementId(placement) === id) || null;
}
function buildPlacementGeometry(spec, face, anchorPoint, sideFactor = 1) {
  const anchor = clampPointToFace(face, sideFactor, anchorPoint);
  if (isVerticalFace(face)) {
    const sticker = createWrappedSticker(spec, face, anchor, sideFactor, 1);
    const segments = sticker.segments.map((segment) => ({
      ...segment,
      position: [...segment.position],
      quaternion: [...segment.quaternion],
      face: copyFace(segment.face),
    }));
    clearGroup(sticker.group);
    return {
      face: copyFace(face), sideFactor, anchor: anchor.toArray(), segments,
      position: undefined, quaternion: undefined, topSurface: false,
    };
  }
  const normal = faceNormal(face).multiplyScalar(sideFactor).normalize();
  const position = anchor.clone().add(normal.multiplyScalar(SURFACE_TEXT_OFFSET_MM));
  const quaternion = quaternionForNormal(normal);
  return {
    face: copyFace(face), sideFactor, anchor: anchor.toArray(), segments: undefined,
    position: position.toArray(), quaternion: quaternion.toArray(), topSurface: isTopFace(face),
  };
}
function applyPlacementGeometry(placement, face, anchorPoint, sideFactor = 1) {
  if (!placement || !face) return false;
  const geometry = buildPlacementGeometry(placement.spec, face, anchorPoint, sideFactor);
  placement.face = geometry.face;
  placement.sideFactor = geometry.sideFactor;
  placement.anchor = geometry.anchor;
  placement.segments = geometry.segments;
  placement.position = geometry.position;
  placement.quaternion = geometry.quaternion;
  placement.topSurface = geometry.topSurface;
  return true;
}

function isTransparentColor(value) {
  return !value || value === 'transparent' || value === 'rgba(0,0,0,0)';
}
function syncPaletteSelection(container, value) {
  if (!container) return;
  container.querySelectorAll('[data-color]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.color === value);
  });
}
function renderEditorPreview() {
  clearGroup(editorPreviewGroup);
  editorPreviewSpec = null;
  if (textEditorPanel.hidden) return;
  const spec = buildTextSpec();
  editorPreviewSpec = { ...spec };
  let face = selectedFaceSnapshot;
  let sideFactor = selectedFaceSideFactor;
  let anchor = face ? faceCenter(face) : null;
  if (editingTextId) {
    const placement = placementById(editingTextId);
    const info = resolvePlacementFaceInfo(placement);
    if (!placement || !info) return;
    face = info.face;
    sideFactor = info.sideFactor;
    anchor = info.anchor;
  }
  if (!face || !anchor) return;
  if (isVerticalFace(face)) {
    const sticker = createWrappedSticker(spec, face, anchor.clone(), sideFactor, 0.94);
    editorPreviewGroup.add(sticker.group);
  } else {
    const mesh = createTextMesh(spec, 0.94);
    const normal = faceNormal(face).multiplyScalar(sideFactor);
    const previewAnchor = anchor.clone();
    if (isTopFace(face) && isLidLiftActive()) previewAnchor.y += LID_LIFT_MM;
    mesh.position.copy(previewAnchor.add(normal.clone().multiplyScalar(SURFACE_TEXT_OFFSET_MM)));
    mesh.quaternion.copy(quaternionForNormal(normal));
    editorPreviewGroup.add(mesh);
  }
}
function clearEditorPreview() {
  editorPreviewSpec = null;
  clearGroup(editorPreviewGroup);
}
function quaternionForNormal(normal) {
  const reference = Math.abs(normal.y) > 0.95 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3().crossVectors(reference, normal).normalize();
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent, bitangent, normal));
}

function textPlaneCorners(position, quaternion, width, height) {
  const xAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion).normalize();
  const yAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion).normalize();
  const halfW = width / 2;
  const halfH = height / 2;
  return [
    position.clone().add(xAxis.clone().multiplyScalar(-halfW)).add(yAxis.clone().multiplyScalar(-halfH)),
    position.clone().add(xAxis.clone().multiplyScalar(halfW)).add(yAxis.clone().multiplyScalar(-halfH)),
    position.clone().add(xAxis.clone().multiplyScalar(halfW)).add(yAxis.clone().multiplyScalar(halfH)),
    position.clone().add(xAxis.clone().multiplyScalar(-halfW)).add(yAxis.clone().multiplyScalar(halfH)),
  ];
}
function placementBoundsOnFace(placement, face, sideFactor = 1) {
  const basis = faceBasis(face, sideFactor);
  const points = [];
  if (Array.isArray(placement.segments) && placement.segments.length) {
    for (const segment of placement.segments) {
      const info = segmentFaceInfo(segment);
      if (!info || faceKey(info.face) !== faceKey(face)) continue;
      const position = new THREE.Vector3().fromArray(segment.position || [0,0,0]);
      const quaternion = new THREE.Quaternion().fromArray(segment.quaternion || [0,0,0,1]);
      points.push(...textPlaneCorners(position, quaternion, Number(segment.width) || 10, Number(segment.height) || 50));
    }
  } else if (Array.isArray(placement.position)) {
    const artwork = createTextArtwork(placement.spec);
    const position = new THREE.Vector3().fromArray(placement.position);
    if (placement.topSurface && isLidLiftActive()) position.y += LID_LIFT_MM;
    const quaternion = new THREE.Quaternion().fromArray(placement.quaternion || [0,0,0,1]);
    points.push(...textPlaneCorners(position, quaternion, artwork.worldWidth, artwork.worldHeight));
    artwork.texture.dispose();
  }
  if (!points.length) {
    const info = resolvePlacementFaceInfo(placement);
    if (!info) return null;
    const artwork = createTextArtwork(placement.spec);
    const anchor = info.anchor;
    const quaternion = quaternionForNormal(basis.normal);
    points.push(...textPlaneCorners(anchor.clone().add(basis.normal.clone().multiplyScalar(SURFACE_TEXT_OFFSET_MM)), quaternion, artwork.worldWidth, artwork.worldHeight));
    artwork.texture.dispose();
  }
  const coordinates = points.map((point) => {
    const relative = point.clone().sub(basis.center);
    return { h: relative.dot(basis.horizontal), v: relative.dot(basis.vertical) };
  });
  return {
    basis,
    hMin: Math.min(...coordinates.map((p0) => p0.h)), hMax: Math.max(...coordinates.map((p0) => p0.h)),
    vMin: Math.min(...coordinates.map((p0) => p0.v)), vMax: Math.max(...coordinates.map((p0) => p0.v)),
  };
}
function placementCenterFaceInfo(placement) {
  if (!placement) return null;
  if (Array.isArray(placement.segments) && placement.segments.length) {
    const ordered = [...placement.segments].sort((a, b) => {
      const ca = Math.abs((((Number(a.u0) || 0) + (Number(a.u1) || 1)) / 2) - 0.5);
      const cb = Math.abs((((Number(b.u0) || 0) + (Number(b.u1) || 1)) / 2) - 0.5);
      return ca - cb;
    });
    for (const segment of ordered) {
      const info = segmentFaceInfo(segment);
      if (!info) continue;
      const point = new THREE.Vector3().fromArray(segment.position || [0,0,0]);
      const basis = faceBasis(info.face, info.sideFactor);
      point.sub(basis.normal.clone().multiplyScalar(point.clone().sub(basis.center).dot(basis.normal)));
      return { face: info.face, sideFactor: info.sideFactor, anchor: point, segment };
    }
  }
  return resolvePlacementFaceInfo(placement);
}
function segmentHorizontalEdge(segment, edgeSign) {
  const position = new THREE.Vector3().fromArray(segment.position || [0,0,0]);
  const quaternion = new THREE.Quaternion().fromArray(segment.quaternion || [0,0,0,1]);
  const xAxis = new THREE.Vector3(1,0,0).applyQuaternion(quaternion).normalize();
  return position.add(xAxis.multiplyScalar((Number(segment.width) || 10) * 0.5 * edgeSign));
}
function placementHorizontalEndpoints(placement) {
  if (!placement) return null;
  if (Array.isArray(placement.segments) && placement.segments.length) {
    const ordered = [...placement.segments].sort((a,b) => {
      const ac = ((Number(a.u0) || 0) + (Number(a.u1) || 1)) / 2;
      const bc = ((Number(b.u0) || 0) + (Number(b.u1) || 1)) / 2;
      return ac - bc;
    });
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const firstInfo = segmentFaceInfo(first);
    const lastInfo = segmentFaceInfo(last);
    if (firstInfo && lastInfo) {
      return {
        left: { point: segmentHorizontalEdge(first, -1), face: firstInfo.face, sideFactor: firstInfo.sideFactor, direction: new THREE.Vector3(-1,0,0).applyQuaternion(new THREE.Quaternion().fromArray(first.quaternion || [0,0,0,1])).normalize() },
        right: { point: segmentHorizontalEdge(last, 1), face: lastInfo.face, sideFactor: lastInfo.sideFactor, direction: new THREE.Vector3(1,0,0).applyQuaternion(new THREE.Quaternion().fromArray(last.quaternion || [0,0,0,1])).normalize() },
      };
    }
  }
  if (Array.isArray(placement.position)) {
    const info = resolvePlacementFaceInfo(placement);
    if (!info) return null;
    const artwork = createTextArtwork(placement.spec);
    const position = new THREE.Vector3().fromArray(placement.position);
    if (placement.topSurface && isLidLiftActive()) position.y += LID_LIFT_MM;
    const quaternion = new THREE.Quaternion().fromArray(placement.quaternion || [0,0,0,1]);
    const xAxis = new THREE.Vector3(1,0,0).applyQuaternion(quaternion).normalize();
    const half = artwork.worldWidth / 2;
    artwork.texture.dispose();
    return {
      left: { point: position.clone().add(xAxis.clone().multiplyScalar(-half)), face: info.face, sideFactor: info.sideFactor, direction: xAxis.clone().multiplyScalar(-1) },
      right: { point: position.clone().add(xAxis.clone().multiplyScalar(half)), face: info.face, sideFactor: info.sideFactor, direction: xAxis.clone() },
    };
  }
  return null;
}
function flatBoundaryGuide(endpoint) {
  if (!endpoint?.face || !isVerticalFace(endpoint.face)) return null;
  const basis = faceBasis(endpoint.face, endpoint.sideFactor);
  const projected = endpoint.point.clone().sub(basis.normal.clone().multiplyScalar(endpoint.point.clone().sub(basis.center).dot(basis.normal)));
  const horizontal = verticalFaceTangent(endpoint.face, endpoint.sideFactor).normalize();
  const s = projected.dot(horizontal);
  const run = planeHorizontalRunAtY(endpoint.face, endpoint.sideFactor, projected.y, s);
  if (!run) return null;
  const directionSign = endpoint.direction.dot(horizontal) >= 0 ? 1 : -1;
  const targetS = directionSign > 0 ? run.max : run.min;
  const end = verticalPlanePoint(endpoint.face, endpoint.sideFactor, targetS, projected.y);
  return {
    start: projected,
    end,
    direction: endpoint.direction.clone().normalize(),
    normal: basis.normal,
    distance: Math.max(0, Math.abs(targetS - s)),
  };
}
function stickerDimensionsForPlacementOnFace(placement, face) {
  return stickerDimensionsForFace(placement.spec, face);
}

function makeGuideLine(start, end) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineDashedMaterial({ color: 0x0e82d8, dashSize: 2, gapSize: 4, transparent: true, opacity: 0.9, depthTest: false });
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  line.renderOrder = 20;
  return line;
}
function makeGuideArrow(point, direction, normal) {
  const dir = direction.clone().normalize();
  const side = new THREE.Vector3().crossVectors(normal, dir).normalize();
  const back = point.clone().add(dir.clone().multiplyScalar(-9));
  const vertices = new Float32Array([
    point.x, point.y, point.z,
    back.x + side.x * 4.2, back.y + side.y * 4.2, back.z + side.z * 4.2,
    back.x - side.x * 4.2, back.y - side.y * 4.2, back.z - side.z * 4.2,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({ color: 0x0e82d8, side: THREE.DoubleSide, depthTest: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 21;
  return mesh;
}
function addWorldDistanceGuide(id, start, end, outwardDirection, normal, distance) {
  const surfaceOffset = normal.clone().multiplyScalar(SURFACE_TEXT_OFFSET_MM + 3.2);
  const a = start.clone().add(surfaceOffset);
  const b = end.clone().add(surfaceOffset);
  textSelectionGroup.add(makeGuideLine(a, b));
  textSelectionGroup.add(makeGuideArrow(b, outwardDirection, normal));
  textSelectionGroup.add(makeGuideArrow(a, outwardDirection.clone().multiplyScalar(-1), normal));
  textGuidePoints.push({ id, point: a.clone().lerp(b, 0.5), label: displayLength(Math.max(0, distance)) });
}
function addDistanceGuide(id, start, end, outwardDirection, basis, distance) {
  addWorldDistanceGuide(id, start, end, outwardDirection, basis.normal, distance);
}
function selectedTextFaceInfo() {
  const placement = placementById(selectedTextId);
  if (!placement) return null;
  return placementCenterFaceInfo(placement) || resolvePlacementPrimaryFaceInfo(placement) || resolvePlacementFaceInfo(placement);
}
function renderTextGuideLabels() {
  textGuideLayer.innerHTML = textGuidePoints.map((guide) => `<div class="text-guide-label" data-text-guide="${guide.id}">${guide.label}</div>`).join('');
}
function renderTextSelection() {
  clearGroup(textSelectionGroup);
  textGuidePoints = [];
  textHudAnchor = null;
  textGuideLayer.innerHTML = '';
  textSelectionHud.hidden = true;
  textSelectionHud.style.display = 'none';
  canvasHost.classList.toggle('has-selected-text', Boolean(selectedTextId));
  textHorizontalLockButton.classList.toggle('is-active', selectedTextConstraint === 'horizontal');
  textVerticalLockButton.classList.toggle('is-active', selectedTextConstraint === 'vertical');
  textLiftTopButton.classList.toggle('is-active', isLidLiftActive());
  if (!selectedTextId || placementMode || addMode || editingTextId || !textEditorPanel.hidden) return;

  const placement = placementById(selectedTextId);
  const info = selectedTextFaceInfo();
  if (!placement || !info) return;
  const bounds = placementBoundsOnFace(placement, info.face, info.sideFactor);
  if (!bounds) return;
  const basis = bounds.basis;

  let surfaceHMin = basis.hMin;
  let surfaceHMax = basis.hMax;
  let surfaceVMin = basis.vMin;
  let surfaceVMax = basis.vMax;
  if (isVerticalFace(info.face)) {
    const horizontal = verticalFaceTangent(info.face, info.sideFactor).normalize();
    const centerS = info.anchor.dot(horizontal);
    const verticalRun = planeVerticalRunAtS(info.face, info.sideFactor, centerS, info.anchor.y);
    if (verticalRun) {
      surfaceVMin = verticalRun.min - basis.center.y;
      surfaceVMax = verticalRun.max - basis.center.y;
    }
    const flatRun = planeHorizontalRunAtY(info.face, info.sideFactor, info.anchor.y, centerS);
    if (flatRun) {
      const centerS0 = basis.center.dot(horizontal);
      surfaceHMin = flatRun.min - centerS0;
      surfaceHMax = flatRun.max - centerS0;
    }
  }

  const textHMin = Math.max(bounds.hMin, surfaceHMin);
  const textHMax = Math.min(bounds.hMax, surfaceHMax);
  const textVMin = Math.max(bounds.vMin, surfaceVMin);
  const textVMax = Math.min(bounds.vMax, surfaceVMax);
  const hCenter = (textHMin + textHMax) / 2;
  const vCenter = (textVMin + textVMax) / 2;

  const outlinePoints = [
    faceDisplayPointFromLocal(info.face, info.sideFactor, textHMin, textVMin, SURFACE_TEXT_OFFSET_MM + 3.4),
    faceDisplayPointFromLocal(info.face, info.sideFactor, textHMax, textVMin, SURFACE_TEXT_OFFSET_MM + 3.4),
    faceDisplayPointFromLocal(info.face, info.sideFactor, textHMax, textVMax, SURFACE_TEXT_OFFSET_MM + 3.4),
    faceDisplayPointFromLocal(info.face, info.sideFactor, textHMin, textVMax, SURFACE_TEXT_OFFSET_MM + 3.4),
  ];
  const outlineGeometry = new THREE.BufferGeometry().setFromPoints([...outlinePoints, outlinePoints[0]]);
  const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x0e82d8, transparent: true, opacity: 0.95, depthTest: false });
  const outline = new THREE.Line(outlineGeometry, outlineMaterial);
  outline.renderOrder = 20;
  textSelectionGroup.add(outline);

  // Horizontal measurements follow the actual sticker endpoints. When the text
  // bends around a corner, the right/left guide therefore continues from the
  // final strip on that adjacent side rather than reporting 0 mm at the seam.
  const endpoints = placementHorizontalEndpoints(placement);
  const leftGuide = endpoints ? flatBoundaryGuide(endpoints.left) : null;
  const rightGuide = endpoints ? flatBoundaryGuide(endpoints.right) : null;
  if (leftGuide) {
    addWorldDistanceGuide('left', leftGuide.start, leftGuide.end, leftGuide.direction, leftGuide.normal, leftGuide.distance);
  } else {
    addDistanceGuide('left',
      faceDisplayPointFromLocal(info.face, info.sideFactor, textHMin, vCenter),
      faceDisplayPointFromLocal(info.face, info.sideFactor, surfaceHMin, vCenter),
      basis.horizontal.clone().multiplyScalar(-1), basis, textHMin - surfaceHMin);
  }
  if (rightGuide) {
    addWorldDistanceGuide('right', rightGuide.start, rightGuide.end, rightGuide.direction, rightGuide.normal, rightGuide.distance);
  } else {
    addDistanceGuide('right',
      faceDisplayPointFromLocal(info.face, info.sideFactor, textHMax, vCenter),
      faceDisplayPointFromLocal(info.face, info.sideFactor, surfaceHMax, vCenter),
      basis.horizontal.clone(), basis, surfaceHMax - textHMax);
  }

  // Vertical distances are taken at the middle of the textbox. This makes an
  // L-shaped elevation report the local height directly above/below the text
  // center instead of using a larger rectangular bounding face elsewhere.
  addDistanceGuide('down',
    faceDisplayPointFromLocal(info.face, info.sideFactor, hCenter, textVMin),
    faceDisplayPointFromLocal(info.face, info.sideFactor, hCenter, surfaceVMin),
    basis.vertical.clone().multiplyScalar(-1), basis, textVMin - surfaceVMin);
  addDistanceGuide('up',
    faceDisplayPointFromLocal(info.face, info.sideFactor, hCenter, textVMax),
    faceDisplayPointFromLocal(info.face, info.sideFactor, hCenter, surfaceVMax),
    basis.vertical.clone(), basis, surfaceVMax - textVMax);

  // Put the action arc diagonally outside the selected text, between the right
  // and down measurement axes, so none of the four distance guides is hidden.
  textHudAnchor = faceDisplayPointFromLocal(info.face, info.sideFactor, textHMax, textVMin, SURFACE_TEXT_OFFSET_MM + 4);
  renderTextGuideLabels();
  textSelectionHud.hidden = false;
  textSelectionHud.style.display = '';
}
function selectTextPlacement(id) {
  const placement = placementById(id);
  if (!placement) return;
  deselectFace();
  selectedTextId = ensurePlacementId(placement);
  selectedTextConstraint = '';
  selectedTextConstraintFace = null;
  selectedTextConstraintSideFactor = 1;
  selectedTextConstraintFixedS = null;
  lidLiftEnabled = false;
  rebuildSurfaceMeshes();
  renderTextSelection();
}
function deselectTextPlacement() {
  if (typeof selectedTextId !== 'undefined') selectedTextId = '';
  lidLiftEnabled = false;
  selectedTextConstraint = '';
  selectedTextConstraintFace = null;
  selectedTextConstraintSideFactor = 1;
  selectedTextConstraintFixedS = null;
  textDragging = false;
  textDragPointerId = null;
  textDragMoved = false;
  controls.enabled = true;
  canvasHost.classList.remove('is-text-dragging', 'has-selected-text');
  rebuildSurfaceMeshes();
  renderTextSelection();
}

function renderTranslations() {
  document.documentElement.lang = locale.startsWith('ro') ? 'ro' : locale.startsWith('de') ? 'de' : 'en';
  document.querySelectorAll('[data-cardbox-i18n]').forEach((el) => { el.textContent = t(el.dataset.cardboxI18n); });
  document.querySelectorAll('[data-cardbox-i18n-title]').forEach((el) => { el.title = t(el.dataset.cardboxI18nTitle); el.setAttribute('aria-label', t(el.dataset.cardboxI18nTitle)); });
  viewerHint.textContent = placementMode ? t('viewer.hint.placement') : t('viewer.hint');
}
function renderInputs() {
  const base = baseBox();
  widthInput.value = round(fromMm(base.maxX - base.minX), units === 'imperial' ? 2 : 0);
  depthInput.value = round(fromMm(base.maxZ - base.minZ), units === 'imperial' ? 2 : 0);
  heightInput.value = round(fromMm(base.maxY - base.minY), units === 'imperial' ? 2 : 0);
  floorThicknessInput.value = round(fromMm(state.boardThickness), units === 'imperial' ? 2 : 1);
  const imperial = units === 'imperial';
  document.querySelectorAll('[data-unit-label]').forEach((el) => { el.textContent = imperial ? 'in' : 'mm'; });
}
function renderSummary() {
  const metrics = calculateUnionMetrics(state.boxes);
  const areaM2 = metrics.areaMm2 / 1_000_000;
  const volumeM3 = metrics.volumeMm3 / 1_000_000_000;
  const materialEur = areaM2 * BOARD_EUR_M2;
  const textEur = state.textPlacements.length * 0.35;
  const setupEur = 0.95 + Math.max(0, state.boxes.length - 1) * 0.18;
  const totalEur = materialEur + textEur + setupEur;
  $('#summaryPieces').textContent = String(state.boxes.length);
  $('#summarySides').textContent = String(metrics.faces.length);
  $('#summaryBoardArea').textContent = `${areaM2.toFixed(3)} m²`;
  $('#summaryVolume').textContent = `${volumeM3.toFixed(3)} m³`;
  $('#priceBreakdown').innerHTML = [[t('summary.material'), materialEur], [t('summary.text'), textEur], [t('summary.setup'), setupEur]].map(([label, value]) => `<div class="price-row"><span>${label}</span><strong>${formatMoney(value)}</strong></div>`).join('');
  summaryTotal.textContent = formatMoney(totalEur);
}

function renderFacePopup() {
  if (!selectedFaceSnapshot || addMode || placementMode || !textEditorPanel.hidden) {
    faceActionPopup.hidden = true;
    return;
  }
  faceActionPopup.hidden = false;
  updateFacePopupPosition();
}
function updateFacePopupPosition() {
  if (faceActionPopup.hidden || !selectedFaceSnapshot) return;
  const world = faceCenter(selectedFaceSnapshot).add(faceNormal(selectedFaceSnapshot).multiplyScalar(10 * selectedFaceSideFactor));
  const projected = world.project(camera);
  const rect = canvasHost.getBoundingClientRect();
  if (projected.z < -1 || projected.z > 1) { faceActionPopup.hidden = true; return; }
  const popupWidth = faceActionPopup.offsetWidth || 238;
  const popupHeight = faceActionPopup.offsetHeight || 132;
  const rawLeft = (projected.x * 0.5 + 0.5) * rect.width;
  const rawTop = (-projected.y * 0.5 + 0.5) * rect.height;
  const halfWidth = popupWidth / 2;
  const halfHeight = popupHeight / 2;
  faceActionPopup.style.left = `${clamp(rawLeft, halfWidth + 6, Math.max(halfWidth + 6, rect.width - halfWidth - 6))}px`;
  faceActionPopup.style.top = `${clamp(rawTop, halfHeight + 6, Math.max(halfHeight + 6, rect.height - halfHeight - 6))}px`;
}
function renderAll() {
  renderInputs(); renderTranslations(); renderSummary(); rebuildSurfaceMeshes(); renderFacePopup(); renderTextSelection();
}

function selectFace(face, sideFactor = 1) {
  deselectTextPlacement();
  const key = faceKey(face);
  if (selectedFaceKey === key) { deselectFace(); return; }
  selectedFaceKey = key;
  selectedFaceSnapshot = { ...face };
  selectedFaceSideFactor = sideFactor >= 0 ? 1 : -1;
  textEditorPanel.hidden = true;
  clearEditorPreview();
  renderAll();
}
function deselectFace() {
  selectedFaceKey = '';
  selectedFaceSnapshot = null;
  selectedFaceSideFactor = 1;
  faceActionPopup.hidden = true;
  textEditorPanel.hidden = true;
  clearEditorPreview();
  if (!addMode && !placementMode) rebuildSurfaceMeshes();
}

function newAttachedBox(face, width, height, depth) {
  const center = faceCenter(face);
  const normal = faceNormal(face);
  const halfW = width / 2;
  const halfH = height / 2;
  const minY = center.y - halfH;
  const maxY = center.y + halfH;
  if (face.axis === 'x') {
    const minZ = center.z - halfW, maxZ = center.z + halfW;
    if (face.sign > 0) return { id: `piece-${Date.now()}`, minX: face.coord, maxX: face.coord + depth, minY, maxY, minZ, maxZ };
    return { id: `piece-${Date.now()}`, minX: face.coord - depth, maxX: face.coord, minY, maxY, minZ, maxZ };
  }
  const minX = center.x - halfW, maxX = center.x + halfW;
  if (face.sign > 0) return { id: `piece-${Date.now()}`, minX, maxX, minY, maxY, minZ: face.coord, maxZ: face.coord + depth };
  return { id: `piece-${Date.now()}`, minX, maxX, minY, maxY, minZ: face.coord - depth, maxZ: face.coord };
}
function beginAddMode() {
  if (!selectedFaceSnapshot || !isVerticalFace(selectedFaceSnapshot)) return;
  const defaultWidth = faceHorizontalWidth(selectedFaceSnapshot) / 2;
  const defaultHeight = faceHeight(selectedFaceSnapshot) / 2;
  const defaultDepth = Math.min(defaultWidth, defaultHeight);
  draftBeforeState = { selectedFaceKey, selectedFaceSnapshot: { ...selectedFaceSnapshot }, selectedFaceSideFactor };
  draftBox = newAttachedBox(selectedFaceSnapshot, defaultWidth, defaultHeight, defaultDepth);
  addMode = true;
  faceActionPopup.hidden = true;
  textEditorPanel.hidden = true;
  clearEditorPreview();
  pieceWidthInput.value = round(fromMm(defaultWidth), units === 'imperial' ? 2 : 0);
  pieceHeightInput.value = round(fromMm(defaultHeight), units === 'imperial' ? 2 : 0);
  pieceDepthInput.value = round(fromMm(defaultDepth), units === 'imperial' ? 2 : 0);
  pieceError.hidden = true;
  addBoxEditor.hidden = false;
  renderAll();
}
function updateDraftFromEditor() {
  if (!addMode || !selectedFaceSnapshot) return;
  const width = clamp(toMm(pieceWidthInput.value), 20, 3000);
  const height = clamp(toMm(pieceHeightInput.value), 20, 3000);
  const depth = clamp(toMm(pieceDepthInput.value), 20, 3000);
  if (!(width > 0 && height > 0 && depth > 0)) {
    pieceError.textContent = t('error.invalidPiece'); pieceError.hidden = false; return;
  }
  pieceError.hidden = true;
  draftBox = newAttachedBox(selectedFaceSnapshot, width, height, depth);
  renderAll();
}
function finishAddMode() {
  if (!addMode || !draftBox) return;
  recordUndoCheckpoint();
  state.boxes.push(cloneBox(draftBox));
  draftBox = null;
  draftBeforeState = null;
  addMode = false;
  addBoxEditor.hidden = true;
  selectedFaceKey = '';
  selectedFaceSnapshot = null;
  renderAll();
  markConfigurationDirty();
}
function cancelAddMode() {
  draftBox = null;
  addMode = false;
  addBoxEditor.hidden = true;
  if (draftBeforeState) {
    selectedFaceKey = draftBeforeState.selectedFaceKey;
    selectedFaceSnapshot = { ...draftBeforeState.selectedFaceSnapshot };
    selectedFaceSideFactor = draftBeforeState.selectedFaceSideFactor || 1;
  }
  draftBeforeState = null;
  renderAll();
}

function buildTextSpec() {
  return {
    text: (textContentInput.value || '').trim() || 'TEXT',
    size: clamp(textSizeInput.value, 12, 180),
    fontFamily: textFontSelect.value,
    textColor: currentTextColor,
    backgroundColor: currentBackgroundColor,
    bold: textBoldToggle.checked,
    italic: textItalicToggle.checked,
    underline: textUnderlineToggle.checked,
    underlineStyle: textUnderlineStyle.value,
  };
}
function populateTextEditor(spec) {
  const source = spec || {};
  textContentInput.value = source.text || 'TEXT';
  textSizeInput.value = String(clamp(source.size || 54, 12, 180));
  textFontSelect.value = source.fontFamily || 'Arial, sans-serif';
  currentTextColor = source.textColor || '#1f2d36';
  currentBackgroundColor = source.backgroundColor || 'transparent';
  textBoldToggle.checked = Boolean(source.bold);
  textItalicToggle.checked = Boolean(source.italic);
  textUnderlineToggle.checked = Boolean(source.underline);
  textUnderlineStyle.value = source.underlineStyle || 'solid';
  syncPaletteSelection(textColorPalette, currentTextColor);
  syncPaletteSelection(textBackgroundPalette, currentBackgroundColor);
}
function startTextEditor() {
  if (!selectedFaceSnapshot) return;
  editingTextId = '';
  editingTextOriginalSpec = null;
  faceActionPopup.hidden = true;
  textEditorPanel.hidden = false;
  // Keep the actual face color untouched while styling text; selection is shown
  // only by the discrete outline/corner markers in the main face-action state.
  rebuildSurfaceMeshes();
  renderEditorPreview();
  renderTextSelection();
}
function editSelectedText() {
  const placement = placementById(selectedTextId);
  const info = resolvePlacementFaceInfo(placement);
  if (!placement || !info) return;
  editingTextId = ensurePlacementId(placement);
  editingTextOriginalSpec = { ...placement.spec };
  selectedFaceSnapshot = copyFace(info.face);
  selectedFaceSideFactor = info.sideFactor;
  selectedFaceKey = '';
  populateTextEditor(placement.spec);
  faceActionPopup.hidden = true;
  textEditorPanel.hidden = false;
  renderPlacedTexts();
  renderEditorPreview();
  renderTextSelection();
}
function backFromTextEditor() {
  textEditorPanel.hidden = true;
  clearEditorPreview();
  if (editingTextId) {
    editingTextId = '';
    editingTextOriginalSpec = null;
    selectedFaceSnapshot = null;
    selectedFaceKey = '';
    renderPlacedTexts();
    renderTextSelection();
    return;
  }
  rebuildSurfaceMeshes();
  renderFacePopup();
}
function enterPlacementMode() {
  if (editingTextId) {
    const placement = placementById(editingTextId);
    const info = resolvePlacementFaceInfo(placement);
    if (placement && info) {
      recordUndoCheckpoint();
      placement.spec = buildTextSpec();
      applyPlacementGeometry(placement, info.face, info.anchor, info.sideFactor);
    }
    editingTextId = '';
    editingTextOriginalSpec = null;
    textEditorPanel.hidden = true;
    clearEditorPreview();
    selectedFaceSnapshot = null;
    selectedFaceKey = '';
    renderAll();
    markConfigurationDirty();
    return;
  }
  pendingTextSpec = buildTextSpec();
  placementMode = true;
  faceActionPopup.hidden = true;
  textEditorPanel.hidden = true;
  clearEditorPreview();
  selectedFaceKey = '';
  selectedFaceSnapshot = null;
  cancelTextPlacementButton.hidden = false;
  renderAll();
}
function exitPlacementMode() {
  placementMode = false;
  pendingTextSpec = null;
  previewPlacement = null;
  previewTextMesh = null;
  clearGroup(previewGroup);
  cancelTextPlacementButton.hidden = true;
  renderAll();
}

function raycast(event, objects = surfaceMeshes, recursive = false) {
  const rect = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(objects, recursive)[0] || null;
  return { hit, raycaster };
}
function raycastText(event) {
  return raycast(event, textGroup.children, true);
}

function updateSelectedTextGeometry(placement, face, anchor, sideFactor) {
  if (!placement || !face || !anchor) return false;
  const applied = applyPlacementGeometry(placement, face, anchor, sideFactor);
  if (!applied) return false;
  renderPlacedTexts();
  renderTextSelection();
  return true;
}
function nearestPlaneEntryForS(referenceFace, sideFactor, s) {
  const entries = verticalPlaneEntries(referenceFace, sideFactor);
  if (!entries.length) return null;
  return [...entries].sort((a, b) => {
    const da = s < a.sMin ? a.sMin - s : s > a.sMax ? s - a.sMax : 0;
    const db = s < b.sMin ? b.sMin - s : s > b.sMax ? s - b.sMax : 0;
    return da - db;
  })[0] || null;
}
function horizontalConstraintAnchor(placement, referenceFace, sideFactor, desiredPoint) {
  const horizontal = verticalFaceTangent(referenceFace, sideFactor).normalize();
  const currentInfo = placementCenterFaceInfo(placement) || resolvePlacementFaceInfo(placement);
  if (!currentInfo) return null;
  const currentS = currentInfo.anchor.dot(horizontal);
  let desiredS = desiredPoint.dot(horizontal);
  let targetFace = planeFaceAt(referenceFace, sideFactor, desiredS, currentInfo.anchor.y);
  if (!targetFace) {
    const nearest = nearestPlaneEntryForS(referenceFace, sideFactor, desiredS);
    if (!nearest) return null;
    desiredS = clamp(desiredS, nearest.sMin, nearest.sMax);
    targetFace = nearest.face;
  }

  let verticalRun = planeVerticalRunAtS(referenceFace, sideFactor, desiredS, currentInfo.anchor.y);
  if (!verticalRun) return null;
  let targetY = (verticalRun.min + verticalRun.max) / 2;
  targetFace = planeFaceAt(referenceFace, sideFactor, desiredS, targetY) || targetFace;
  let flatRun = planeHorizontalRunAtY(referenceFace, sideFactor, targetY, desiredS);
  if (!flatRun) return null;
  let dimensions = stickerDimensionsForPlacementOnFace(placement, targetFace);
  const flatWidth = flatRun.max - flatRun.min;

  // A normal-size sticker stays entirely on the current flat side while the
  // horizontal-center lock is active. Its center is clamped by half the real
  // sticker width, so the textbox border can never slide through the side edge.
  if (dimensions.width <= flatWidth + EPSILON) {
    const minS = flatRun.min + dimensions.width / 2;
    const maxS = flatRun.max - dimensions.width / 2;
    desiredS = clamp(desiredS, Math.min(minS, maxS), Math.max(minS, maxS));
    selectedTextConstraintFixedS = desiredS; // last valid horizontal position

    verticalRun = planeVerticalRunAtS(referenceFace, sideFactor, desiredS, targetY) || verticalRun;
    targetY = (verticalRun.min + verticalRun.max) / 2;
    targetFace = planeFaceAt(referenceFace, sideFactor, desiredS, targetY) || targetFace;
    flatRun = planeHorizontalRunAtY(referenceFace, sideFactor, targetY, desiredS) || flatRun;
    dimensions = stickerDimensionsForPlacementOnFace(placement, targetFace);
    if (dimensions.width > flatRun.max - flatRun.min + EPSILON) return null;
    return { face: targetFace, anchor: verticalPlanePoint(referenceFace, sideFactor, desiredS, targetY), sideFactor, tooWide: false };
  }

  // If the artwork is literally wider than that side, wrapping is required.
  // Keep its horizontal coordinate fixed while the lock is active so dragging
  // cannot squeeze it into an edge or move it through empty space.
  const fixedS = Number.isFinite(selectedTextConstraintFixedS) ? selectedTextConstraintFixedS : currentS;
  const fixedVerticalRun = planeVerticalRunAtS(referenceFace, sideFactor, fixedS, currentInfo.anchor.y);
  if (!fixedVerticalRun) return null;
  const fixedY = (fixedVerticalRun.min + fixedVerticalRun.max) / 2;
  const fixedFace = planeFaceAt(referenceFace, sideFactor, fixedS, fixedY) || currentInfo.face;
  return { face: fixedFace, anchor: verticalPlanePoint(referenceFace, sideFactor, fixedS, fixedY), sideFactor, tooWide: true };
}
function verticalConstraintAnchor(placement, referenceFace, sideFactor, desiredPoint) {
  const horizontal = verticalFaceTangent(referenceFace, sideFactor).normalize();
  const currentInfo = placementCenterFaceInfo(placement) || resolvePlacementFaceInfo(placement);
  if (!currentInfo) return null;
  const currentS = currentInfo.anchor.dot(horizontal);
  let fixedS = Number.isFinite(selectedTextConstraintFixedS) ? selectedTextConstraintFixedS : currentS;
  const verticalRun = planeVerticalRunAtS(referenceFace, sideFactor, fixedS, desiredPoint.y);
  if (!verticalRun) return null;
  let targetY = desiredPoint.y;
  let targetFace = planeFaceAt(referenceFace, sideFactor, fixedS, targetY) || currentInfo.face;
  const dimensions = stickerDimensionsForPlacementOnFace(placement, targetFace);
  if (dimensions.height >= verticalRun.max - verticalRun.min - EPSILON) {
    targetY = (verticalRun.min + verticalRun.max) / 2;
  } else {
    targetY = clamp(targetY, verticalRun.min + dimensions.height / 2, verticalRun.max - dimensions.height / 2);
  }
  targetFace = planeFaceAt(referenceFace, sideFactor, fixedS, targetY) || targetFace;
  return { face: targetFace, anchor: verticalPlanePoint(referenceFace, sideFactor, fixedS, targetY), sideFactor };
}
function genericConstraintAnchor(placement, face, sideFactor, mode, desiredPoint) {
  const local = pointToFaceLocal(face, sideFactor, desiredPoint);
  const artwork = createTextArtwork(placement.spec);
  const marginH = artwork.worldWidth / 2;
  const marginV = artwork.worldHeight / 2;
  artwork.texture.dispose();
  let h = local.h;
  let v = local.v;
  if (mode === 'horizontal') {
    v = 0;
    if (marginH >= local.basis.hMax - local.basis.hMin) h = 0;
    else h = clamp(h, local.basis.hMin + marginH, local.basis.hMax - marginH);
  } else {
    h = 0;
    if (marginV >= local.basis.vMax - local.basis.vMin) v = 0;
    else v = clamp(v, local.basis.vMin + marginV, local.basis.vMax - marginV);
  }
  return { face, anchor: facePointFromLocal(face, sideFactor, h, v, 0), sideFactor };
}
function toggleSelectedTextConstraint(mode) {
  const placement = placementById(selectedTextId);
  if (!placement) return;
  if (selectedTextConstraint === mode) {
    selectedTextConstraint = '';
    selectedTextConstraintFace = null;
    selectedTextConstraintSideFactor = 1;
    selectedTextConstraintFixedS = null;
    renderTextSelection();
    return;
  }
  const info = placementCenterFaceInfo(placement) || resolvePlacementPrimaryFaceInfo(placement);
  if (!info) return;
  recordUndoCheckpoint();
  selectedTextConstraint = mode;
  selectedTextConstraintFace = copyFace(info.face);
  selectedTextConstraintSideFactor = info.sideFactor;
  selectedTextConstraintFixedS = null;

  let result;
  if (isVerticalFace(info.face)) {
    const horizontal = verticalFaceTangent(info.face, info.sideFactor).normalize();
    const currentS = info.anchor.dot(horizontal);
    if (mode === 'vertical') {
      const flatRun = planeHorizontalRunAtY(info.face, info.sideFactor, info.anchor.y, currentS);
      selectedTextConstraintFixedS = flatRun ? (flatRun.min + flatRun.max) / 2 : currentS;
      result = verticalConstraintAnchor(placement, info.face, info.sideFactor, info.anchor);
    } else {
      selectedTextConstraintFixedS = currentS;
      result = horizontalConstraintAnchor(placement, info.face, info.sideFactor, info.anchor);
    }
  } else {
    result = genericConstraintAnchor(placement, info.face, info.sideFactor, mode, info.anchor);
  }
  if (!result) return;
  selectedTextConstraintFace = copyFace(result.face);
  selectedTextConstraintSideFactor = result.sideFactor;
  updateSelectedTextGeometry(placement, result.face, result.anchor, result.sideFactor);
  markConfigurationDirty();
}
function toggleSelectedTextLidLift() {
  if (!selectedTextId) return;
  lidLiftEnabled = !lidLiftEnabled;
  rebuildSurfaceMeshes();
  renderPlacedTexts();
  renderTextSelection();
}
function deleteSelectedText() {
  if (!selectedTextId) return;
  recordUndoCheckpoint();
  state.textPlacements = state.textPlacements.filter((placement) => ensurePlacementId(placement) !== selectedTextId);
  editingTextId = '';
  editingTextOriginalSpec = null;
  deselectTextPlacement();
  renderAll();
  markConfigurationDirty();
}
function dragPointOnConstraintFace(event, placement, face, sideFactor, mode) {
  const { raycaster } = raycast(event, []);
  const basis = faceBasis(face, sideFactor);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(basis.normal, basis.center);
  const hitPoint = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, hitPoint)) return null;
  if (isVerticalFace(face)) {
    return mode === 'horizontal'
      ? horizontalConstraintAnchor(placement, face, sideFactor, hitPoint)
      : verticalConstraintAnchor(placement, face, sideFactor, hitPoint);
  }
  return genericConstraintAnchor(placement, face, sideFactor, mode, hitPoint);
}
function moveSelectedTextWithPointer(event) {
  if (!textDragging || !selectedTextId) return false;
  const placement = placementById(selectedTextId);
  if (!placement) return false;
  if (selectedTextConstraint && selectedTextConstraintFace) {
    const face = currentFaceForDescriptor(selectedTextConstraintFace) || selectedTextConstraintFace;
    const result = dragPointOnConstraintFace(event, placement, face, selectedTextConstraintSideFactor, selectedTextConstraint);
    if (!result) return false;
    selectedTextConstraintFace = copyFace(result.face);
    selectedTextConstraintSideFactor = result.sideFactor;
    textDragMoved = true;
    suppressCanvasClick = true;
    return updateSelectedTextGeometry(placement, result.face, result.anchor, result.sideFactor);
  }

  const { hit, raycaster } = raycast(event, surfaceMeshes, false);
  if (!hit?.object?.userData?.face) return false;
  const face = hit.object.userData.face;
  let normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  if (normal.dot(raycaster.ray.direction) > 0) normal.multiplyScalar(-1);
  const outward = faceNormal(face);
  const sideFactor = normal.dot(outward) >= 0 ? 1 : -1;
  const anchor = clampPointToFace(face, sideFactor, hit.point.clone());
  textDragMoved = true;
  suppressCanvasClick = true;
  return updateSelectedTextGeometry(placement, face, anchor, sideFactor);
}
function beginSelectedTextDrag(event) {
  if (event.button !== 0 || !selectedTextId || placementMode || addMode || editingTextId || !textEditorPanel.hidden) return false;
  const { hit } = raycastText(event);
  if (!hit || hit.object.userData.textPlacementId !== selectedTextId) return false;
  recordUndoCheckpoint();
  textDragging = true;
  textDragPointerId = event.pointerId;
  textDragMoved = false;
  controls.enabled = false;
  canvasHost.classList.add('is-text-dragging');
  try { renderer.domElement.setPointerCapture(event.pointerId); } catch { /* optional */ }
  event.preventDefault();
  return true;
}
function endSelectedTextDrag(event) {
  if (!textDragging) return false;
  if (textDragPointerId != null && event.pointerId !== textDragPointerId) return false;
  const moved = textDragMoved;
  textDragging = false;
  textDragPointerId = null;
  textDragMoved = false;
  controls.enabled = true;
  canvasHost.classList.remove('is-text-dragging');
  try { renderer.domElement.releasePointerCapture(event.pointerId); } catch { /* optional */ }
  renderTextSelection();
  if (moved) markConfigurationDirty();
  return true;
}
function updateTextPreview(event) {
  if (!placementMode || !pendingTextSpec) return;
  clearGroup(previewGroup);
  previewTextMesh = null;
  previewPlacement = null;
  const { hit, raycaster } = raycast(event);
  if (!hit) return;
  let normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  if (normal.dot(raycaster.ray.direction) > 0) normal.multiplyScalar(-1);
  const face = hit.object.userData.face;
  if (isVerticalFace(face)) {
    const outward = faceNormal(face);
    const sideFactor = normal.dot(outward) >= 0 ? 1 : -1;
    const anchor = clampPointToFace(face, sideFactor, hit.point.clone());
    const sticker = createWrappedSticker(pendingTextSpec, face, anchor.clone(), sideFactor, 0.78);
    previewGroup.add(sticker.group);
    previewPlacement = {
      id: makeTextPlacementId(), face: copyFace(face), sideFactor, anchor: anchor.toArray(),
      segments: sticker.segments.map((segment) => ({ ...segment, face: copyFace(segment.face) })),
      spec: { ...pendingTextSpec },
    };
    return;
  }
  const outward = faceNormal(face);
  const sideFactor = normal.dot(outward) >= 0 ? 1 : -1;
  const position = hit.point.clone().add(normal.clone().multiplyScalar(SURFACE_TEXT_OFFSET_MM));
  const quaternion = quaternionForNormal(normal);
  const mesh = createTextMesh(pendingTextSpec, 0.78);
  mesh.position.copy(position); mesh.quaternion.copy(quaternion);
  previewGroup.add(mesh); previewTextMesh = mesh;
  const topSurface = Boolean(hit.object.userData.top);
  const storedPosition = position.clone();
  const storedAnchor = hit.point.clone();
  if (topSurface && isLidLiftActive()) { storedPosition.y -= LID_LIFT_MM; storedAnchor.y -= LID_LIFT_MM; }
  previewPlacement = {
    id: makeTextPlacementId(), face: copyFace(face), sideFactor, anchor: storedAnchor.toArray(),
    position: storedPosition.toArray(), quaternion: quaternion.toArray(), topSurface, spec: { ...pendingTextSpec },
  };
}
function commitTextPlacement() {
  if (!previewPlacement) return;
  recordUndoCheckpoint();
  const placement = { ...previewPlacement, spec: { ...previewPlacement.spec } };
  ensurePlacementId(placement);
  state.textPlacements.push(placement);
  exitPlacementMode();
  markConfigurationDirty();
}

function renderDimensions() {
  dimensionLayer.hidden = !dimensionsVisible;
  if (!dimensionsVisible) { dimensionLayer.innerHTML = ''; return; }
  dimensionLayer.innerHTML = dimensionAnchors.map((item, i) => `<div class="dimension-label" data-dimension-index="${i}">${item.label}</div>`).join('');
}
function updateOverlayPositions() {
  const rect = canvasHost.getBoundingClientRect();
  dimensionAnchors.forEach((item, i) => {
    const projected = item.point.clone().project(camera);
    const el = dimensionLayer.querySelector(`[data-dimension-index="${i}"]`); if (!el) return;
    const visible = projected.z > -1 && projected.z < 1;
    el.style.display = visible ? '' : 'none';
    el.style.left = `${(projected.x * 0.5 + 0.5) * rect.width}px`;
    el.style.top = `${(-projected.y * 0.5 + 0.5) * rect.height}px`;
  });
  textGuidePoints.forEach((guide) => {
    const projected = guide.point.clone().project(camera);
    const el = textGuideLayer.querySelector(`[data-text-guide="${guide.id}"]`);
    if (!el) return;
    const visible = projected.z > -1 && projected.z < 1;
    el.style.display = visible ? '' : 'none';
    el.style.left = `${(projected.x * 0.5 + 0.5) * rect.width}px`;
    el.style.top = `${(-projected.y * 0.5 + 0.5) * rect.height}px`;
  });
  if (!textSelectionHud.hidden && textHudAnchor) {
    const projected = textHudAnchor.clone().project(camera);
    const visible = projected.z > -1 && projected.z < 1;
    textSelectionHud.style.display = visible ? '' : 'none';
    if (visible) {
      const rawLeft = (projected.x * 0.5 + 0.5) * rect.width;
      const rawTop = (-projected.y * 0.5 + 0.5) * rect.height;
      const hudWidth = textSelectionHud.offsetWidth || 230;
      const hudHeight = textSelectionHud.offsetHeight || 132;
      textSelectionHud.style.left = `${clamp(rawLeft, 4, Math.max(4, rect.width - hudWidth - 18))}px`;
      textSelectionHud.style.top = `${clamp(rawTop, 4, Math.max(4, rect.height - hudHeight - 18))}px`;
    }
  } else {
    textSelectionHud.style.display = 'none';
  }
  updateFacePopupPosition();
}

function updateBaseDimension(axis, value) {
  const base = baseBox();
  const mm = axis === 'height' ? clamp(toMm(value), 50, 2000) : clamp(toMm(value), 100, 3000);
  if (axis === 'width') { const c = (base.minX + base.maxX) / 2; base.minX = c - mm / 2; base.maxX = c + mm / 2; }
  if (axis === 'depth') { const c = (base.minZ + base.maxZ) / 2; base.minZ = c - mm / 2; base.maxZ = c + mm / 2; }
  if (axis === 'height') base.maxY = base.minY + mm;
  deselectFace(); renderAll();
}
function bindPalette(container, assign) {
  container?.querySelectorAll('[data-color]').forEach((button) => {
    button.addEventListener('click', () => {
      assign(button.dataset.color || 'transparent');
      syncPaletteSelection(container, button.dataset.color || 'transparent');
      renderEditorPreview();
    });
  });
}
function bindTextPreviewControls() {
  [textContentInput, textSizeInput, textFontSelect, textUnderlineStyle].forEach((input) => input.addEventListener('input', renderEditorPreview));
  [textBoldToggle, textItalicToggle, textUnderlineToggle].forEach((input) => input.addEventListener('change', renderEditorPreview));
  bindPalette(textColorPalette, (value) => { currentTextColor = value; });
  bindPalette(textBackgroundPalette, (value) => { currentBackgroundColor = value; });
  syncPaletteSelection(textColorPalette, currentTextColor);
  syncPaletteSelection(textBackgroundPalette, currentBackgroundColor);
}

function bindAccordions() {
  document.querySelectorAll('.accordion-toggle').forEach((button) => button.addEventListener('click', () => {
    const section = button.closest('.accordion-section'); const panel = section.querySelector('.accordion-panel'); const open = !section.classList.contains('is-open');
    section.classList.toggle('is-open', open); button.setAttribute('aria-expanded', String(open)); panel.hidden = !open;
  }));
}
function bindControls() {
  widthInput.addEventListener('change', () => updateBaseDimension('width', widthInput.value));
  depthInput.addEventListener('change', () => updateBaseDimension('depth', depthInput.value));
  heightInput.addEventListener('change', () => updateBaseDimension('height', heightInput.value));
  floorThicknessInput.addEventListener('change', () => { state.boardThickness = clamp(toMm(floorThicknessInput.value), 1, 20); renderInputs(); });
  $('#faceAddButton').addEventListener('click', beginAddMode);
  $('#faceTextButton').addEventListener('click', startTextEditor);
  faceDismissButton.addEventListener('click', deselectFace);
  $('#backFromTextButton').addEventListener('click', backFromTextEditor);
  $('#startTextPlacementButton').addEventListener('click', enterPlacementMode);
  cancelTextPlacementButton.addEventListener('click', exitPlacementMode);
  [pieceWidthInput, pieceHeightInput, pieceDepthInput].forEach((input) => input.addEventListener('change', updateDraftFromEditor));
  $('#confirmAddPieceButton').addEventListener('click', finishAddMode);
  $('#cancelAddPieceButton').addEventListener('click', cancelAddMode);
  textHorizontalLockButton.addEventListener('click', () => toggleSelectedTextConstraint('horizontal'));
  textVerticalLockButton.addEventListener('click', () => toggleSelectedTextConstraint('vertical'));
  textLiftTopButton.addEventListener('click', toggleSelectedTextLidLift);
  textEditButton.addEventListener('click', editSelectedText);
  textDeleteButton.addEventListener('click', deleteSelectedText);
  textDismissButton.addEventListener('click', deselectTextPlacement);
  bindTextPreviewControls();
}

renderer.domElement.addEventListener('dblclick', (event) => {
  if (
    addMode
    || placementMode
    || imagePlacementMode
    || editingTextId
    || !textEditorPanel.hidden
    || !faceColorPanel.hidden
    || !imageResizePanel.hidden
  ) return;

  const imageHit = raycastImage(event).hit;
  const imageId = imageHit?.object?.userData?.imagePlacementId || '';
  if (imageId) {
    selectImagePlacement(imageId);
    event.preventDefault();
    return;
  }

  const textHit = raycastText(event).hit;
  const placementId = textHit?.object?.userData?.textPlacementId || '';
  if (placementId) {
    selectTextPlacement(placementId);
    event.preventDefault();
    return;
  }

  const { hit, raycaster } = raycast(event);
  if (!hit?.object?.userData?.cardboxSurface || !hit.object.userData.face) return;
  const face = hit.object.userData.face;
  if (!decorationFaceAvailable(face)) return;
  const explicitSideFactor = Number(hit.object.userData.surfaceSideFactor);
  const outward = faceNormal(face);
  const inferredSideFactor = outward.dot(raycaster.ray.direction) < 0 ? 1 : -1;
  const sideFactor = explicitSideFactor < 0 ? -1 : explicitSideFactor > 0 ? 1 : inferredSideFactor;
  if (
    selectedFaceKey
    && selectedFaceKey === hit.object.userData.faceKey
    && selectedFaceSideFactor === sideFactor
  ) {
    deselectFace();
    return;
  }
  selectFace(face, sideFactor);
  event.preventDefault();
});

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (beginSelectedImageDrag(event)) return;
  beginSelectedTextDrag(event);
}, true);

renderer.domElement.addEventListener('pointermove', (event) => {
  if (imageDragging) {
    moveSelectedImageWithPointer(event);
    return;
  }
  if (textDragging) {
    moveSelectedTextWithPointer(event);
    return;
  }
  if (imagePlacementMode) {
    updateImagePreview(event);
    return;
  }
  updateTextPreview(event);
});

renderer.domElement.addEventListener('pointerup', (event) => {
  if (endSelectedImageDrag(event)) return;
  endSelectedTextDrag(event);
});
renderer.domElement.addEventListener('pointercancel', (event) => {
  if (endSelectedImageDrag(event)) return;
  endSelectedTextDrag(event);
});

renderer.domElement.addEventListener('click', (event) => {
  if (suppressCanvasClick) {
    suppressCanvasClick = false;
    return;
  }
  if (imagePlacementMode) {
    updateImagePreview(event);
    if (previewImagePlacement) commitImagePlacement();
    return;
  }
  if (placementMode) {
    updateTextPreview(event);
    if (previewPlacement) commitTextPlacement();
    return;
  }
  if (
    addMode
    || editingTextId
    || !textEditorPanel.hidden
    || !faceColorPanel.hidden
    || !imageResizePanel.hidden
  ) return;

  const imageHit = raycastImage(event).hit;
  const clickedImageId = imageHit?.object?.userData?.imagePlacementId || '';
  if (clickedImageId) {
    if (selectedTextId) deselectTextPlacement();
    if (selectedImageId && clickedImageId !== selectedImageId) deselectImagePlacement();
    return;
  }

  const textHit = raycastText(event).hit;
  const clickedTextId = textHit?.object?.userData?.textPlacementId || '';
  if (clickedTextId) {
    if (selectedImageId) deselectImagePlacement();
    if (selectedTextId && clickedTextId !== selectedTextId) deselectTextPlacement();
    return;
  }

  const { hit } = raycast(event);
  if (selectedImageId) {
    // Preserve selection while the user drags empty viewer space to orbit.
    // Clicking an actual box surface or other box artwork dismisses it.
    if (hit?.object?.userData?.cardboxSurface) deselectImagePlacement();
    return;
  }
  if (selectedTextId) {
    // Empty viewer space is commonly used to orbit the camera. Keep the text
    // selected there; deselect only when the click actually lands on the box.
    if (hit?.object?.userData?.cardboxSurface) deselectTextPlacement();
    return;
  }
  if (!hit) deselectFace();
});

function resizeRenderer() {
  const width = Math.max(1, canvasHost.clientWidth), height = Math.max(1, canvasHost.clientHeight);
  renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
}
resizeObserver = new ResizeObserver(resizeRenderer); resizeObserver.observe(canvasHost); resizeRenderer();
function animate() { requestAnimationFrame(animate); controls.update(); updateOverlayPositions(); renderer.render(scene, camera); }
animate();

function serializeTextPlacement(placement) {
  return {
    id: ensurePlacementId(placement),
    face: placement.face ? copyFace(placement.face) : undefined,
    sideFactor: Number(placement.sideFactor) < 0 ? -1 : 1,
    anchor: Array.isArray(placement.anchor) ? [...placement.anchor] : undefined,
    position: Array.isArray(placement.position) ? [...placement.position] : undefined,
    quaternion: Array.isArray(placement.quaternion) ? [...placement.quaternion] : undefined,
    topSurface: Boolean(placement.topSurface),
    segments: Array.isArray(placement.segments) ? placement.segments.map((segment) => ({
      position: [...segment.position], quaternion: [...segment.quaternion],
      u0: segment.u0, u1: segment.u1, width: segment.width, height: segment.height,
      face: segment.face ? copyFace(segment.face) : undefined,
      sideFactor: Number(segment.sideFactor) < 0 ? -1 : 1,
    })) : undefined,
    spec: { ...placement.spec },
  };
}
function captureState() {
  return {
    version: 4,
    boxes: state.boxes.map(cloneBox),
    boardThickness: round(state.boardThickness),
    textPlacements: state.textPlacements.map(serializeTextPlacement),
  };
}
function restoreTextPlacement(raw = {}) {
  const placement = {
    id: String(raw.id || makeTextPlacementId()),
    face: raw.face ? copyFace(raw.face) : undefined,
    sideFactor: Number(raw.sideFactor) < 0 ? -1 : 1,
    anchor: Array.isArray(raw.anchor) ? raw.anchor.map(Number) : undefined,
    position: Array.isArray(raw.position) ? raw.position.map(Number) : undefined,
    quaternion: Array.isArray(raw.quaternion) ? raw.quaternion.map(Number) : undefined,
    topSurface: Boolean(raw.topSurface),
    segments: Array.isArray(raw.segments) ? raw.segments.map((segment) => ({
      position: Array.isArray(segment.position) ? segment.position.map(Number) : [0,0,0],
      quaternion: Array.isArray(segment.quaternion) ? segment.quaternion.map(Number) : [0,0,0,1],
      u0: Number(segment.u0) || 0,
      u1: Number(segment.u1) || 1,
      width: Number(segment.width) || 10,
      height: Number(segment.height) || 50,
      face: segment.face ? copyFace(segment.face) : undefined,
      sideFactor: Number(segment.sideFactor) < 0 ? -1 : 1,
    })) : undefined,
    spec: {
      text: raw.spec?.text || 'TEXT',
      size: clamp(raw.spec?.size || 54, 12, 180),
      fontFamily: raw.spec?.fontFamily || 'Arial, sans-serif',
      textColor: raw.spec?.textColor || '#1f2d36',
      backgroundColor: raw.spec?.backgroundColor || 'transparent',
      bold: Boolean(raw.spec?.bold),
      italic: Boolean(raw.spec?.italic),
      underline: Boolean(raw.spec?.underline),
      underlineStyle: raw.spec?.underlineStyle || 'solid',
    },
  };
  return placement;
}
function restoreState(snapshot) {
  const source = snapshot?.state && !snapshot.boxes ? snapshot.state : snapshot;
  if (!source || !Array.isArray(source.boxes) || source.boxes.length === 0) return false;
  const boxes = source.boxes.map((box, index) => ({ id: String(box.id || (index === 0 ? 'base' : `piece-${index}`)), minX: Number(box.minX), maxX: Number(box.maxX), minY: Number(box.minY), maxY: Number(box.maxY), minZ: Number(box.minZ), maxZ: Number(box.maxZ) }));
  if (boxes.some((box) => ![box.minX,box.maxX,box.minY,box.maxY,box.minZ,box.maxZ].every(Number.isFinite) || box.maxX <= box.minX || box.maxY <= box.minY || box.maxZ <= box.minZ)) return false;
  state = {
    version: 4,
    boxes,
    boardThickness: clamp(source.boardThickness || 3, 1, 20),
    textPlacements: Array.isArray(source.textPlacements) ? source.textPlacements.map(restoreTextPlacement) : [],
  };
  addMode = false;
  draftBox = null;
  placementMode = false;
  selectedFaceKey = '';
  selectedFaceSnapshot = null;
  if (typeof selectedTextId !== 'undefined') selectedTextId = '';
  selectedTextConstraint = '';
  selectedTextConstraintFace = null;
  selectedTextConstraintFixedS = null;
  lidLiftEnabled = false;
  editingTextId = '';
  addBoxEditor.hidden = true;
  textEditorPanel.hidden = true;
  cancelTextPlacementButton.hidden = true;
  clearEditorPreview();
  renderAll();
  return true;
}
function resetConfiguration() {
  state = { version: 4, boxes: [makeBaseBox()], boardThickness: 3, textPlacements: [] };
  addMode = false;
  draftBox = null;
  placementMode = false;
  selectedFaceKey = '';
  selectedFaceSnapshot = null;
  if (typeof selectedTextId !== 'undefined') selectedTextId = '';
  selectedTextConstraint = '';
  selectedTextConstraintFace = null;
  selectedTextConstraintFixedS = null;
  lidLiftEnabled = false;
  editingTextId = '';
  addBoxEditor.hidden = true;
  textEditorPanel.hidden = true;
  cancelTextPlacementButton.hidden = true;
  clearEditorPreview();
  renderAll();
  return true;
}
function setUnits(value) { units = value === 'imperial' ? 'imperial' : 'metric'; renderAll(); }
function setCurrency(value) { currency = ['USD','RON','EUR'].includes(String(value).toUpperCase()) ? String(value).toUpperCase() : 'EUR'; renderSummary(); }
function setLocale(value) { if (TEXT[value]) locale = value; renderAll(); }
function setDarkMode(value) { document.body.classList.toggle('cardbox-dark-mode', Boolean(value)); scene.background.set(Boolean(value) ? 0x172027 : 0xf0f4f6); ground.material.color.set(Boolean(value) ? 0x141b20 : 0xe7ecef); }
function toggleDimensions() { dimensionsVisible = !dimensionsVisible; renderDimensions(); return dimensionsVisible; }
function toggleTechnicalEdges() { technicalEdgesVisible = !technicalEdgesVisible; rebuildSurfaceMeshes(); return technicalEdgesVisible; }
function cycleCamera() {
  cameraMode = (cameraMode + 1) % 3; const b = boundsForBoxes(); const maxDim = Math.max(b.maxX - b.minX, b.maxZ - b.minZ, b.maxY - b.minY + (isLidLiftActive() ? LID_LIFT_MM : 0), 400);
  if (cameraMode === 1) camera.position.set(0, maxDim * 1.8, 0.01); else if (cameraMode === 2) camera.position.set(maxDim * 1.45, maxDim * 0.65, 0); else camera.position.set(maxDim * 1.2, maxDim * 0.9, maxDim * 1.25);
  fitControlsTarget(); controls.update();
}
function getPrice() { const metrics = calculateUnionMetrics(state.boxes); const eur = metrics.areaMm2 / 1_000_000 * BOARD_EUR_M2 + state.textPlacements.length * 0.35 + 0.95 + Math.max(0, state.boxes.length - 1) * 0.18; return { amount: eur * (CURRENCY_FROM_EUR[currency] || 1), currency }; }


// ---------------------------------------------------------------------------
// Practical FEFCO catalogue, closures, die-cut features and paper recipes.
// The legacy arbitrary-volume add workflow remains intentionally unreachable:
// the product can now only use the nine manufacturing-oriented structures below.
// ---------------------------------------------------------------------------
const PACKAGING_CATALOG_SCHEMA_VERSION = 1;
const PACKAGING_BOX_TYPES = Object.freeze({
  standard: Object.freeze({ code: '0201', family: '02', dims: [600, 400, 300], top: 'simple-flaps', bottom: 'simple-flaps', topOptions: ['open','flat','simple-flaps','folded-flaps','full-overlap','interlocking','tuck'], bottomOptions: ['open','flat','simple-flaps','folded-flaps','full-overlap','interlocking','snap-lock','auto-lock'] }),
  'full-overlap': Object.freeze({ code: '0203', family: '02', dims: [600, 400, 300], top: 'full-overlap', bottom: 'full-overlap', topOptions: ['open','flat','simple-flaps','folded-flaps','full-overlap','interlocking'], bottomOptions: ['open','flat','simple-flaps','folded-flaps','full-overlap','interlocking'] }),
  telescope: Object.freeze({ code: '03xx', family: '03', dims: [520, 360, 240], top: 'telescope', bottom: 'flat', topOptions: ['telescope','open'], bottomOptions: ['flat','open'] }),
  archive: Object.freeze({ code: '04xx', family: '04', dims: [400, 320, 260], top: 'archive-lid', bottom: 'flat', topOptions: ['archive-lid','hinged','tuck','open'], bottomOptions: ['flat','open'], defaultHandle: 'die-cut' }),
  pizza: Object.freeze({ code: '0426', family: '04', dims: [330, 330, 50], top: 'pizza-lid', bottom: 'flat', topOptions: ['pizza-lid','hinged','self-locking','open'], bottomOptions: ['flat'], defaultHoles: 'vents' }),
  mailer: Object.freeze({ code: '0427', family: '04', dims: [360, 260, 100], top: 'mailer-lid', bottom: 'flat', topOptions: ['mailer-lid','hinged','tuck','self-locking','open'], bottomOptions: ['flat'] }),
  'auto-bottom': Object.freeze({ code: '07xx', family: '07', dims: [420, 300, 250], top: 'tuck', bottom: 'auto-lock', topOptions: ['open','simple-flaps','tuck'], bottomOptions: ['auto-lock','snap-lock'] }),
  'two-point-glued': Object.freeze({ code: '07xx · 2P', family: '07', dims: [420, 300, 180], top: 'tuck', bottom: 'two-point-glued', topOptions: ['open','simple-flaps','tuck'], bottomOptions: ['two-point-glued','flat'] }),
  'sleeve-drawer': Object.freeze({ code: '05xx', family: '05', dims: [400, 260, 110], top: 'sleeve', bottom: 'drawer', topOptions: ['sleeve','open'], bottomOptions: ['drawer'] }),
});
const PACKAGING_CLOSURES = Object.freeze({
  open: Object.freeze({ factor: 0 }),
  flat: Object.freeze({ factor: 1 }),
  'simple-flaps': Object.freeze({ factor: 2 }),
  'folded-flaps': Object.freeze({ factor: 2.1 }),
  'full-overlap': Object.freeze({ factor: 2.5 }),
  interlocking: Object.freeze({ factor: 2.2 }),
  tuck: Object.freeze({ factor: 1.3 }),
  hinged: Object.freeze({ factor: 1.18 }),
  'self-locking': Object.freeze({ factor: 1.42 }),
  telescope: Object.freeze({ factor: 1.45 }),
  'archive-lid': Object.freeze({ factor: 1.5 }),
  'pizza-lid': Object.freeze({ factor: 1.42 }),
  'mailer-lid': Object.freeze({ factor: 1.4 }),
  'snap-lock': Object.freeze({ factor: 1.35 }),
  'auto-lock': Object.freeze({ factor: 1.5 }),
  'two-point-glued': Object.freeze({ factor: 1.35 }),
  sleeve: Object.freeze({ factor: 1.55 }),
  drawer: Object.freeze({ factor: 1.2 }),
});
const PACKAGING_FLUTES = Object.freeze({
  E: Object.freeze({ thickness: 1.5, takeUp: 1.24, priceM2: 1.35 }),
  B: Object.freeze({ thickness: 3.0, takeUp: 1.35, priceM2: 1.55 }),
  C: Object.freeze({ thickness: 4.0, takeUp: 1.43, priceM2: 1.72 }),
  EB: Object.freeze({ thickness: 4.5, takeUp: [1.24, 1.35], priceM2: 2.35 }),
  BC: Object.freeze({ thickness: 7.0, takeUp: [1.35, 1.43], priceM2: 2.78 }),
});
const PACKAGING_PAPERS = Object.freeze({
  'testliner-natural': Object.freeze({ color: '#b88959', liner: true }),
  kraftliner: Object.freeze({ color: '#a87342', liner: true }),
  'white-top-testliner': Object.freeze({ color: '#f1efe7', liner: true }),
  'white-kraftliner': Object.freeze({ color: '#fafaf6', liner: true }),
  fluting: Object.freeze({ color: '#c99b68', medium: true }),
  'semi-chemical-fluting': Object.freeze({ color: '#c39058', medium: true }),
  'recycled-fluting': Object.freeze({ color: '#b98858', medium: true }),
});
const PACKAGING_COPY = Object.freeze({
  'en-US': Object.freeze({
    'intro.eyebrow':'Corrugated packaging','intro.title':'Cardboard box settings','intro.copy':'Choose a practical FEFCO-based box style, then configure its closures, features and board construction.',
    'section.structure':'1. Box structure','section.closures':'2. Closures','section.features':'3. Cut-outs & features','section.board':'4. Cardboard','section.summary':'5. Summary & BOM',
    'structure.type':'Box type','structure.typeHelp':'Approachable names are shown first; the corresponding FEFCO style or family remains visible underneath.',
    'dimension.width':'Width','dimension.depth':'Depth','dimension.height':'Height','dimension.thickness':'Nominal board thickness',
    'type.standard':'Standard shipping box','type.fullOverlap':'Full-overlap box','type.telescope':'Telescope lid box','type.archive':'Archive box','type.pizza':'Pizza box','type.mailer':'Postal mailer','type.autoBottom':'Self-erecting box','type.twoPoint':'Two-point glued box','type.sleeve':'Sleeve & drawer box',
    'desc.standard':'The familiar regular slotted shipping carton. Four wall panels and meeting top and bottom flaps make it the most versatile transport box.',
    'desc.full-overlap':'A slotted transport box whose outer flaps overlap for extra top and bottom protection.',
    'desc.telescope':'A base and a larger cap-style lid that slides over the body, useful for products that need a removable protective cover.',
    'desc.archive':'A rigid storage-oriented folder box with an accessible lid and optional carry handle.',
    'desc.pizza':'A shallow one-piece folder with a hinged self-locking lid, intended for pizza and similar flat products.',
    'desc.mailer':'A one-piece postal box with a hinged lid, side dust flaps and a front locking/tuck section.',
    'desc.autoBottom':'A ready-glued box that opens into shape and locks its bottom automatically for fast packing.',
    'desc.twoPoint':'A ready-glued construction secured at two manufacturing glue points, supplied flat and erected before use.',
    'desc.sleeve':'An inner tray that slides into an outer sleeve, suited to premium presentation and drawer-style packaging.',
    'closure.top':'Top closure','closure.bottom':'Bottom closure','closure.note':'Only closures compatible with the selected structural family are shown.','closure.open':'Open','closure.flat':'Flat panel','closure.simple-flaps':'Simple flaps','closure.folded-flaps':'Folded flaps','closure.full-overlap':'Full-overlap flaps','closure.interlocking':'Interlocking flaps','closure.tuck':'Tuck flap','closure.hinged':'Hinged lid','closure.self-locking':'Self-locking lid','closure.telescope':'Telescope cap','closure.archive-lid':'Archive lid','closure.pizza-lid':'Pizza self-locking lid','closure.mailer-lid':'Mailer locking lid','closure.snap-lock':'Snap-lock bottom','closure.auto-lock':'Automatic / crash-lock bottom','closure.two-point-glued':'Two-point glued bottom','closure.sleeve':'Outer sleeve','closure.drawer':'Inner drawer',
    'feature.handles':'Handles','feature.handlesHelp':'Add a real die-cut opening to the selected box faces.','feature.holes':'Holes & ventilation','feature.holesHelp':'Circular, oval or slotted openings are cut through the board.','feature.type':'Type','feature.position':'Position','feature.width':'Width','feature.height':'Height','feature.quantity':'Quantity / face','feature.none':'None','feature.dieCut':'Simple die-cut','feature.reinforced':'Reinforced die-cut','feature.round':'Circular','feature.oval':'Oval','feature.vents':'Ventilation slots','feature.front':'Front','feature.sides':'Both sides','feature.allSides':'All vertical sides','feature.lid':'Top / lid',
    'board.construction':'Construction','board.flute':'Flute profile','board.fluteHelp':'The available profiles depend on the selected single- or double-wall construction.','board.paperPreset':'Paper preset','board.paperPresetHelp':'T / A / F describe the outer liner, fluting medium and inner liner sequence used by the supplier.','board.tft':'Natural outside / natural inside','board.aft':'White outside / natural inside','board.afa':'White outside / white inside','board.stack':'Layer stack','board.estimatedGsm':'Estimated board weight','board.outside':'Outside','board.inside':'Inside','board.advanced':'Advanced paper composition','board.advancedHelp':'Edit the paper grade and grammage of every liner and fluting layer. Changing a row creates a custom paper recipe.','board.custom':'Custom recipe',
    'paper.outer':'Outer liner','paper.flute1':'Fluting medium','paper.middle':'Middle liner','paper.flute2':'Second fluting','paper.inner':'Inner liner','paper.testlinerNatural':'Natural testliner','paper.kraftliner':'Natural kraftliner','paper.whiteTop':'White-top testliner','paper.whiteKraft':'White kraftliner','paper.fluting':'Fluting','paper.semiChemical':'Semi-chemical fluting','paper.recycledFluting':'Recycled fluting',
    'summary.material':'Cardboard','summary.conversion':'Conversion','summary.features':'Features','summary.textCost':'Text',
    'summary.type':'Box type','summary.boardArea':'Estimated blank area','summary.mass':'Estimated mass','summary.volume':'Internal volume','summary.texts':'Text objects','summary.total':'Estimated total','summary.note':'Indicative material, conversion and personalization estimate for one configured box.','bom.structure':'Structure','bom.closures':'Closures','bom.board':'Board','bom.layers':'Paper composition','bom.features':'Features','bom.dimensions':'Finished dimensions','bom.none':'None',
  }),
  'ro-RO': Object.freeze({
    'intro.eyebrow':'Ambalaje din carton ondulat','intro.title':'Setări cutie din carton','intro.copy':'Alege un model de cutie bazat pe standardul FEFCO, apoi configurează închiderile, decupajele și structura cartonului.',
    'section.structure':'1. Structura cutiei','section.closures':'2. Închideri','section.features':'3. Decupaje și elemente','section.board':'4. Carton','section.summary':'5. Sumar și BOM',
    'structure.type':'Tip de cutie','structure.typeHelp':'Denumirea uzuală apare prima, iar stilul sau familia FEFCO rămâne vizibilă dedesubt.',
    'dimension.width':'Lățime','dimension.depth':'Adâncime','dimension.height':'Înălțime','dimension.thickness':'Grosime nominală carton',
    'type.standard':'Cutie standard de transport','type.fullOverlap':'Cutie cu clapete suprapuse','type.telescope':'Cutie telescopică','type.archive':'Cutie pentru arhivare','type.pizza':'Cutie pentru pizza','type.mailer':'Cutie poștală','type.autoBottom':'Cutie cu autoformare','type.twoPoint':'Cutie lipită în două puncte','type.sleeve':'Cutie tip manșon și sertar',
    'desc.standard':'Cutia de transport cu clapete clasice. Patru pereți și clapete superioare/inferioare care se întâlnesc o fac potrivită pentru majoritatea produselor.',
    'desc.full-overlap':'Cutie de transport ale cărei clapete exterioare se suprapun pentru protecție suplimentară sus și jos.',
    'desc.telescope':'O bază și un capac mai mare care culisează peste corp, potrivite pentru produse care necesită un capac detașabil.',
    'desc.archive':'Cutie de depozitare cu capac accesibil și posibilitate de mâner pentru transport.',
    'desc.pizza':'Cutie joasă dintr-o singură bucată, cu capac rabatabil și autoblocant pentru pizza și produse plate.',
    'desc.mailer':'Cutie poștală dintr-o bucată, cu capac rabatabil, aripioare laterale și blocare frontală.',
    'desc.autoBottom':'Cutie prelipită care se deschide în formă și își blochează automat baza pentru ambalare rapidă.',
    'desc.twoPoint':'Construcție prelipită în două puncte de fabricație, livrată plat și formată înainte de utilizare.',
    'desc.sleeve':'O tăviță interioară care culisează într-un manșon exterior, potrivită pentru ambalaje premium.',
    'closure.top':'Închidere superioară','closure.bottom':'Închidere inferioară','closure.note':'Sunt afișate doar închiderile compatibile cu familia structurală selectată.','closure.open':'Deschis','closure.flat':'Panou plat','closure.simple-flaps':'Clapete simple','closure.folded-flaps':'Clapete îndoite','closure.full-overlap':'Clapete suprapuse','closure.interlocking':'Clapete interblocabile','closure.tuck':'Clapetă de introducere','closure.hinged':'Capac rabatabil','closure.self-locking':'Capac autoblocant','closure.telescope':'Capac telescopic','closure.archive-lid':'Capac de arhivare','closure.pizza-lid':'Capac autoblocant pizza','closure.mailer-lid':'Capac cu blocare poștală','closure.snap-lock':'Bază cu blocare rapidă','closure.auto-lock':'Bază automată / crash-lock','closure.two-point-glued':'Bază lipită în două puncte','closure.sleeve':'Manșon exterior','closure.drawer':'Sertar interior',
    'feature.handles':'Mânere','feature.handlesHelp':'Adaugă un decupaj real în fețele selectate ale cutiei.','feature.holes':'Găuri și ventilație','feature.holesHelp':'Deschiderile circulare, ovale sau fantele sunt decupate prin carton.','feature.type':'Tip','feature.position':'Poziție','feature.width':'Lățime','feature.height':'Înălțime','feature.quantity':'Cantitate / față','feature.none':'Fără','feature.dieCut':'Decupaj simplu','feature.reinforced':'Decupaj ranforsat','feature.round':'Circulară','feature.oval':'Ovală','feature.vents':'Fante de ventilație','feature.front':'Față','feature.sides':'Ambele laterale','feature.allSides':'Toate fețele verticale','feature.lid':'Sus / capac',
    'board.construction':'Construcție','board.flute':'Tip ondulă','board.fluteHelp':'Profilele disponibile depind de construcția CO3 sau CO5 selectată.','board.paperPreset':'Preset hârtii','board.paperPresetHelp':'T / A / F descriu succesiunea feței exterioare, a hârtiei de ondulă și a feței interioare folosită de furnizor.','board.tft':'Natur exterior / natur interior','board.aft':'Alb exterior / natur interior','board.afa':'Alb exterior / alb interior','board.stack':'Structură straturi','board.estimatedGsm':'Greutate estimată carton','board.outside':'Exterior','board.inside':'Interior','board.advanced':'Compoziție avansată a hârtiilor','board.advancedHelp':'Editează tipul și gramajul fiecărui strat. Modificarea unui rând creează o rețetă personalizată.','board.custom':'Rețetă personalizată',
    'paper.outer':'Față exterioară','paper.flute1':'Hârtie ondulă','paper.middle':'Față intermediară','paper.flute2':'A doua ondulă','paper.inner':'Față interioară','paper.testlinerNatural':'Testliner natur','paper.kraftliner':'Kraftliner natur','paper.whiteTop':'Testliner alb','paper.whiteKraft':'Kraftliner alb','paper.fluting':'Fluting','paper.semiChemical':'Fluting semicelulozic','paper.recycledFluting':'Fluting reciclat',
    'summary.material':'Carton','summary.conversion':'Conversie','summary.features':'Elemente','summary.textCost':'Text',
    'summary.type':'Tip cutie','summary.boardArea':'Suprafață estimată ștanță','summary.mass':'Masă estimată','summary.volume':'Volum interior','summary.texts':'Elemente text','summary.total':'Total estimat','summary.note':'Estimare orientativă pentru material, conversie și personalizare pentru o cutie configurată.','bom.structure':'Structură','bom.closures':'Închideri','bom.board':'Carton','bom.layers':'Compoziție hârtii','bom.features':'Elemente','bom.dimensions':'Dimensiuni finite','bom.none':'Fără',
  }),
  'de-DE': Object.freeze({
    'intro.eyebrow':'Wellpappenverpackung','intro.title':'Kartonbox-Einstellungen','intro.copy':'Wählen Sie einen praxisnahen FEFCO-basierten Boxstil und konfigurieren Sie Verschlüsse, Ausschnitte und Kartonaufbau.',
    'section.structure':'1. Box-Struktur','section.closures':'2. Verschlüsse','section.features':'3. Ausschnitte & Merkmale','section.board':'4. Wellpappe','section.summary':'5. Übersicht & Stückliste',
    'structure.type':'Boxtyp','structure.typeHelp':'Zuerst erscheint die verständliche Bezeichnung; der entsprechende FEFCO-Stil oder die Familie bleibt darunter sichtbar.',
    'dimension.width':'Breite','dimension.depth':'Tiefe','dimension.height':'Höhe','dimension.thickness':'Nennstärke der Wellpappe',
    'type.standard':'Standard-Versandkarton','type.fullOverlap':'Vollüberlappende Box','type.telescope':'Teleskopbox','type.archive':'Archivbox','type.pizza':'Pizzakarton','type.mailer':'Versandbox','type.autoBottom':'Automatikbodenbox','type.twoPoint':'Zweipunkt-Klebebox','type.sleeve':'Schuber- & Schubladenbox',
    'desc.standard':'Der bekannte Faltkarton mit vier Wandfeldern und zusammentreffenden oberen und unteren Klappen für vielseitigen Versand.',
    'desc.fullOverlap':'Ein Versandkarton mit überlappenden Außenklappen für zusätzlichen Schutz oben und unten.',
    'desc.telescope':'Unterteil und größerer Stülpdeckel, der über den Körper gleitet und einen abnehmbaren Schutz bietet.',
    'desc.archive':'Lagerorientierte Faltbox mit leicht zugänglichem Deckel und optionalem Tragegriff.',
    'desc.pizza':'Flache einteilige Faltbox mit Klappdeckel und Selbstverriegelung für Pizza und andere flache Produkte.',
    'desc.mailer':'Einteilige Versandbox mit Klappdeckel, Staublaschen und vorderem Steck-/Verschlussbereich.',
    'desc.autoBottom':'Vorgeklebte Box, die sich aufrichtet und den Boden automatisch verriegelt.',
    'desc.twoPoint':'Vorgeklebte Konstruktion mit zwei Klebepunkten, flach geliefert und vor Gebrauch aufgerichtet.',
    'desc.sleeve':'Eine innere Schublade gleitet in einen äußeren Schuber – geeignet für hochwertige Präsentationsverpackungen.',
    'closure.top':'Oberer Verschluss','closure.bottom':'Unterer Verschluss','closure.note':'Es werden nur Verschlüsse angezeigt, die zur gewählten Struktur passen.','closure.open':'Offen','closure.flat':'Flache Platte','closure.simple-flaps':'Einfache Klappen','closure.folded-flaps':'Gefaltete Klappen','closure.full-overlap':'Vollüberlappende Klappen','closure.interlocking':'Ineinandergreifende Klappen','closure.tuck':'Stecklasche','closure.hinged':'Klappdeckel','closure.self-locking':'Selbstverriegelnder Deckel','closure.telescope':'Teleskopdeckel','closure.archive-lid':'Archivdeckel','closure.pizza-lid':'Selbstverriegelnder Pizzadeckel','closure.mailer-lid':'Verriegelnder Versanddeckel','closure.snap-lock':'Steckboden','closure.auto-lock':'Automatik- / Crash-Lock-Boden','closure.two-point-glued':'Zweipunkt-Klebeboden','closure.sleeve':'Außenschuber','closure.drawer':'Innenschublade',
    'feature.handles':'Griffe','feature.handlesHelp':'Fügt echte gestanzte Öffnungen in die ausgewählten Boxflächen ein.','feature.holes':'Löcher & Belüftung','feature.holesHelp':'Runde, ovale oder geschlitzte Öffnungen werden durch die Wellpappe gestanzt.','feature.type':'Typ','feature.position':'Position','feature.width':'Breite','feature.height':'Höhe','feature.quantity':'Anzahl / Fläche','feature.none':'Keine','feature.dieCut':'Einfach gestanzt','feature.reinforced':'Verstärkt gestanzt','feature.round':'Rund','feature.oval':'Oval','feature.vents':'Belüftungsschlitze','feature.front':'Vorderseite','feature.sides':'Beide Seiten','feature.allSides':'Alle vertikalen Seiten','feature.lid':'Oben / Deckel',
    'board.construction':'Aufbau','board.flute':'Wellenprofil','board.fluteHelp':'Die verfügbaren Profile hängen vom gewählten ein- oder zweiwelligen Aufbau ab.','board.paperPreset':'Papier-Voreinstellung','board.paperPresetHelp':'T / A / F beschreiben die Reihenfolge aus Außenliner, Wellenpapier und Innenliner.','board.tft':'Natur außen / Natur innen','board.aft':'Weiß außen / Natur innen','board.afa':'Weiß außen / Weiß innen','board.stack':'Schichtaufbau','board.estimatedGsm':'Geschätztes Flächengewicht','board.outside':'Außen','board.inside':'Innen','board.advanced':'Erweiterter Papieraufbau','board.advancedHelp':'Papiersorte und Grammatur jeder Lage bearbeiten. Eine Änderung erzeugt ein benutzerdefiniertes Rezept.','board.custom':'Benutzerdefiniertes Rezept',
    'paper.outer':'Außenliner','paper.flute1':'Wellenpapier','paper.middle':'Mittelliner','paper.flute2':'Zweites Wellenpapier','paper.inner':'Innenliner','paper.testlinerNatural':'Natur-Testliner','paper.kraftliner':'Natur-Kraftliner','paper.whiteTop':'White-Top-Testliner','paper.whiteKraft':'Weißer Kraftliner','paper.fluting':'Wellenstoff','paper.semiChemical':'Halbzellstoff-Wellenpapier','paper.recycledFluting':'Recycling-Wellenpapier',
    'summary.material':'Wellpappe','summary.conversion':'Verarbeitung','summary.features':'Merkmale','summary.textCost':'Text',
    'summary.type':'Boxtyp','summary.boardArea':'Geschätzte Zuschnittfläche','summary.mass':'Geschätzte Masse','summary.volume':'Innenvolumen','summary.texts':'Textobjekte','summary.total':'Geschätzter Gesamtpreis','summary.note':'Unverbindliche Schätzung für Material, Verarbeitung und Personalisierung einer konfigurierten Box.','bom.structure':'Struktur','bom.closures':'Verschlüsse','bom.board':'Wellpappe','bom.layers':'Papieraufbau','bom.features':'Merkmale','bom.dimensions':'Fertigmaße','bom.none':'Keine',
  }),
});
const PACKAGING_PAPER_COPY_KEYS = Object.freeze({
  'testliner-natural':'paper.testlinerNatural', kraftliner:'paper.kraftliner', 'white-top-testliner':'paper.whiteTop', 'white-kraftliner':'paper.whiteKraft', fluting:'paper.fluting', 'semi-chemical-fluting':'paper.semiChemical', 'recycled-fluting':'paper.recycledFluting',
});
const PACKAGING_ROLE_KEYS = Object.freeze({ outer:'paper.outer', flute1:'paper.flute1', middle:'paper.middle', flute2:'paper.flute2', inner:'paper.inner' });
const PACKAGING_CLOSURE_KEYS = Object.freeze({
  open:'closure.open', flat:'closure.flat', 'simple-flaps':'closure.simple-flaps', 'folded-flaps':'closure.folded-flaps', 'full-overlap':'closure.full-overlap', interlocking:'closure.interlocking', tuck:'closure.tuck', hinged:'closure.hinged', 'self-locking':'closure.self-locking', telescope:'closure.telescope', 'archive-lid':'closure.archive-lid', 'pizza-lid':'closure.pizza-lid', 'mailer-lid':'closure.mailer-lid', 'snap-lock':'closure.snap-lock', 'auto-lock':'closure.auto-lock', 'two-point-glued':'closure.two-point-glued', sleeve:'closure.sleeve', drawer:'closure.drawer',
});
const packagingClosureGroup = new THREE.Group(); scene.add(packagingClosureGroup);
const packagingFeatureGroup = new THREE.Group(); scene.add(packagingFeatureGroup);

function packT(key) { return PACKAGING_COPY[locale]?.[key] ?? PACKAGING_COPY['en-US'][key] ?? key; }
function packagingDefaultLayers(construction = 'CO3', preset = 'TFT') {
  if (construction === 'CO5') {
    const outer = preset === 'TFT' ? 'testliner-natural' : 'white-top-testliner';
    const inner = preset === 'AFA' ? 'white-top-testliner' : 'testliner-natural';
    return [
      { role:'outer', paper:outer, gsm:200 },
      { role:'flute1', paper:'fluting', gsm:160 },
      { role:'middle', paper:preset === 'AFA' ? 'white-top-testliner' : 'testliner-natural', gsm:180 },
      { role:'flute2', paper:'fluting', gsm:160 },
      { role:'inner', paper:inner, gsm:200 },
    ];
  }
  if (preset === 'AFT') return [{ role:'outer',paper:'white-top-testliner',gsm:200 },{ role:'flute1',paper:'fluting',gsm:200 },{ role:'inner',paper:'testliner-natural',gsm:200 }];
  if (preset === 'AFA') return [{ role:'outer',paper:'white-top-testliner',gsm:200 },{ role:'flute1',paper:'fluting',gsm:180 },{ role:'inner',paper:'white-top-testliner',gsm:200 }];
  return [{ role:'outer',paper:'testliner-natural',gsm:180 },{ role:'flute1',paper:'fluting',gsm:160 },{ role:'inner',paper:'testliner-natural',gsm:180 }];
}
function packagingDefaultFeatures(typeId = 'standard') {
  const def = PACKAGING_BOX_TYPES[typeId] || PACKAGING_BOX_TYPES.standard;
  return {
    handleType: def.defaultHandle || 'none', handlePlacement:'front', handleWidth:120, handleHeight:35,
    holeType: def.defaultHoles || 'none', holePlacement:def.defaultHoles ? 'sides' : 'front', holeCount:def.defaultHoles ? 2 : 2, holeWidth:30, holeHeight:20,
  };
}
function ensurePackagingState() {
  if (!PACKAGING_BOX_TYPES[state.boxType]) state.boxType = 'standard';
  const def = PACKAGING_BOX_TYPES[state.boxType];
  if (!state.closures || typeof state.closures !== 'object') state.closures = { top:def.top, bottom:def.bottom };
  if (!def.topOptions.includes(state.closures.top)) state.closures.top = def.top;
  if (!def.bottomOptions.includes(state.closures.bottom)) state.closures.bottom = def.bottom;
  if (!state.features || typeof state.features !== 'object') state.features = packagingDefaultFeatures(state.boxType);
  state.features = { ...packagingDefaultFeatures(state.boxType), ...state.features };
  if (!state.board || typeof state.board !== 'object') state.board = { construction:'CO3', flute:'B', preset:'TFT', layers:packagingDefaultLayers('CO3','TFT') };
  if (!['CO3','CO5'].includes(state.board.construction)) state.board.construction = 'CO3';
  const validFlutes = state.board.construction === 'CO5' ? ['EB','BC'] : ['E','B','C'];
  if (!validFlutes.includes(state.board.flute)) state.board.flute = state.board.construction === 'CO5' ? 'EB' : 'B';
  if (!Array.isArray(state.board.layers) || state.board.layers.length !== (state.board.construction === 'CO5' ? 5 : 3)) state.board.layers = packagingDefaultLayers(state.board.construction, ['TFT','AFT','AFA'].includes(state.board.preset) ? state.board.preset : 'TFT');
  if (!state.board.preset) state.board.preset = 'TFT';
  state.boardThickness = PACKAGING_FLUTES[state.board.flute]?.thickness || 3;
  state.catalogSchemaVersion = PACKAGING_CATALOG_SCHEMA_VERSION;
}
function packagingSetBaseDimensions(width, depth, height) {
  state.boxes = [makeBaseBox(width, depth, height)];
}
function packagingApplyType(typeId) {
  const def = PACKAGING_BOX_TYPES[typeId];
  if (!def) return;
  state.boxType = typeId;
  packagingSetBaseDimensions(...def.dims);
  state.closures = { top:def.top, bottom:def.bottom };
  state.features = packagingDefaultFeatures(typeId);
  selectedFaceKey = '';
  selectedFaceSnapshot = null;
  if (typeof selectedTextId !== 'undefined') selectedTextId = '';
  faceActionPopup.hidden = true;
  renderAll();
}
function packagingPaperColor(layer, fallback = '#b88959') { return PACKAGING_PAPERS[layer?.paper]?.color || fallback; }
function packagingOuterColor() { ensurePackagingState(); return packagingPaperColor(state.board.layers[0]); }
function packagingInnerColor() { ensurePackagingState(); return packagingPaperColor(state.board.layers[state.board.layers.length - 1]); }
function packagingNominalThickness() { ensurePackagingState(); return PACKAGING_FLUTES[state.board.flute]?.thickness || 3; }
function packagingBoardGsm() {
  ensurePackagingState();
  const flute = PACKAGING_FLUTES[state.board.flute];
  const factors = Array.isArray(flute.takeUp) ? flute.takeUp : [flute.takeUp];
  let mediumIndex = 0;
  return state.board.layers.reduce((sum, layer) => {
    const paper = PACKAGING_PAPERS[layer.paper];
    if (paper?.medium) return sum + Number(layer.gsm || 0) * (factors[Math.min(mediumIndex++, factors.length - 1)] || 1.3);
    return sum + Number(layer.gsm || 0);
  }, 0);
}
function packagingClosureLabel(id) { return packT(PACKAGING_CLOSURE_KEYS[id] || id); }
function packagingTypeKey(typeId) {
  return ({ standard:'type.standard','full-overlap':'type.fullOverlap',telescope:'type.telescope',archive:'type.archive',pizza:'type.pizza',mailer:'type.mailer','auto-bottom':'type.autoBottom','two-point-glued':'type.twoPoint','sleeve-drawer':'type.sleeve' })[typeId] || 'type.standard';
}
function packagingTypeLabel(typeId = state.boxType) { return packT(packagingTypeKey(typeId)); }
function packagingTypeDescriptionKey(typeId) { return `desc.${typeId === 'full-overlap' ? 'fullOverlap' : typeId === 'auto-bottom' ? 'autoBottom' : typeId === 'two-point-glued' ? 'twoPoint' : typeId === 'sleeve-drawer' ? 'sleeve' : typeId}`; }
function packagingEscape(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function packagingRenderClosureSelect(select, values, current) {
  select.innerHTML = values.map((value) => `<option value="${value}">${packagingEscape(packagingClosureLabel(value))}</option>`).join('');
  select.value = values.includes(current) ? current : values[0];
  select.disabled = values.length === 1;
}
function packagingRenderFlutes() {
  const container = document.querySelector('#fluteChoiceGrid');
  if (!container) return;
  const values = state.board.construction === 'CO5' ? ['EB','BC'] : ['E','B','C'];
  container.innerHTML = values.map((fluteId) => {
    const flute = PACKAGING_FLUTES[fluteId];
    return `<button type="button" class="flute-choice${state.board.flute === fluteId ? ' is-selected' : ''}" data-flute="${fluteId}"><b>${fluteId}</b><small>≈ ${flute.thickness.toFixed(1)} mm</small></button>`;
  }).join('');
}
function packagingRenderLayerEditor() {
  const container = document.querySelector('#paperLayerEditor');
  if (!container) return;
  container.innerHTML = state.board.layers.map((layer, index) => {
    const isMedium = PACKAGING_PAPERS[layer.paper]?.medium || layer.role.startsWith('flute');
    const paperIds = Object.keys(PACKAGING_PAPERS).filter((id) => isMedium ? PACKAGING_PAPERS[id].medium : PACKAGING_PAPERS[id].liner);
    const options = paperIds.map((paperId) => `<option value="${paperId}"${layer.paper === paperId ? ' selected' : ''}>${packagingEscape(packT(PACKAGING_PAPER_COPY_KEYS[paperId]))}</option>`).join('');
    return `<div class="paper-layer-row" data-layer-index="${index}"><span>${packagingEscape(packT(PACKAGING_ROLE_KEYS[layer.role]))}</span><select data-layer-paper>${options}</select><label class="gsm-input"><input data-layer-gsm type="number" min="80" max="500" step="5" value="${Number(layer.gsm || 0)}"/><em>g/m²</em></label></div>`;
  }).join('');
}
function packagingSetOptionLabels(select, map) {
  if (!select) return;
  [...select.options].forEach((option) => { option.textContent = packT(map[option.value] || option.value); });
}
function packagingApplyCopy() {
  document.querySelectorAll('[data-pack-copy]').forEach((node) => { node.textContent = packT(node.dataset.packCopy); });
  packagingSetOptionLabels(document.querySelector('#handleTypeSelect'), {none:'feature.none','die-cut':'feature.dieCut',reinforced:'feature.reinforced'});
  packagingSetOptionLabels(document.querySelector('#handlePlacementSelect'), {front:'feature.front',sides:'feature.sides','all-sides':'feature.allSides',lid:'feature.lid'});
  packagingSetOptionLabels(document.querySelector('#holeTypeSelect'), {none:'feature.none',round:'feature.round',oval:'feature.oval',vents:'feature.vents'});
  packagingSetOptionLabels(document.querySelector('#holePlacementSelect'), {front:'feature.front',sides:'feature.sides','all-sides':'feature.allSides',lid:'feature.lid'});
}
function packagingRenderCatalogControls() {
  ensurePackagingState();
  packagingApplyCopy();
  document.querySelectorAll('[data-box-type]').forEach((button) => button.classList.toggle('is-selected', button.dataset.boxType === state.boxType));
  const def = PACKAGING_BOX_TYPES[state.boxType];
  const description = document.querySelector('#boxTypeDescription');
  if (description) description.innerHTML = `<b>${packagingEscape(packagingTypeLabel())}</b><p>${packagingEscape(packT(packagingTypeDescriptionKey(state.boxType)))}</p><span>FEFCO ${packagingEscape(def.code)}</span>`;
  packagingRenderClosureSelect(document.querySelector('#topClosureSelect'), def.topOptions, state.closures.top);
  packagingRenderClosureSelect(document.querySelector('#bottomClosureSelect'), def.bottomOptions, state.closures.bottom);
  const note = document.querySelector('#closureCompatibilityNote');
  if (note) note.textContent = packT('closure.note');
  const construction = document.querySelector('#boardConstructionSelect'); if (construction) construction.value = state.board.construction;
  packagingRenderFlutes();
  document.querySelectorAll('[data-paper-preset]').forEach((button) => button.classList.toggle('is-selected', button.dataset.paperPreset === state.board.preset));
  const thickness = packagingNominalThickness();
  const nominal = document.querySelector('#nominalThicknessDisplay'); if (nominal) nominal.textContent = `≈ ${displayLength(thickness, 1)}`;
  floorThicknessInput.value = round(fromMm(thickness), units === 'imperial' ? 2 : 1);
  const stack = document.querySelector('#boardStackDisplay'); if (stack) stack.textContent = state.board.preset === 'CUSTOM' ? packT('board.custom') : `${state.board.preset} · ${state.board.construction} ${state.board.flute}`;
  const gsm = document.querySelector('#boardGsmDisplay'); if (gsm) gsm.textContent = `≈ ${Math.round(packagingBoardGsm())} g/m²`;
  const outer = document.querySelector('#outerPaperSwatch'); if (outer) outer.style.background = packagingOuterColor();
  const inner = document.querySelector('#innerPaperSwatch'); if (inner) inner.style.background = packagingInnerColor();
  packagingRenderLayerEditor();
  const f = state.features;
  const setValue = (id, value) => { const el = document.querySelector(id); if (el) el.value = String(value); };
  setValue('#handleTypeSelect', f.handleType); setValue('#handlePlacementSelect', f.handlePlacement); setValue('#handleWidthInput', round(fromMm(f.handleWidth), units === 'imperial' ? 2 : 0)); setValue('#handleHeightInput', round(fromMm(f.handleHeight), units === 'imperial' ? 2 : 0));
  setValue('#holeTypeSelect', f.holeType); setValue('#holePlacementSelect', f.holePlacement); setValue('#holeCountInput', f.holeCount); setValue('#holeWidthInput', round(fromMm(f.holeWidth), units === 'imperial' ? 2 : 0)); setValue('#holeHeightInput', round(fromMm(f.holeHeight), units === 'imperial' ? 2 : 0));
  const handleSizes = document.querySelector('#handleSizeControls'); if (handleSizes) handleSizes.hidden = f.handleType === 'none';
  const holeSizes = document.querySelector('#holeSizeControls'); if (holeSizes) holeSizes.hidden = f.holeType === 'none';
  packagingRenderClosurePreview();
}
function packagingRenderClosurePreview() {
  const svg = document.querySelector('#closurePreview');
  if (!svg) return;
  const top = state.closures.top; const bottom = state.closures.bottom;
  let topMarkup = '<path class="cut" d="M72 42h116"/>';
  if (top === 'simple-flaps') topMarkup += '<path class="fold" d="M130 14v28M72 28h116"/>';
  else if (top === 'full-overlap') topMarkup += '<path class="fold" d="M95 14v28m70-28v28"/>';
  else if (['tuck','hinged','pizza-lid','mailer-lid','archive-lid'].includes(top)) topMarkup += '<path class="fold" d="M72 18h116M88 18v24m84-24v24"/>';
  else if (top === 'interlocking') topMarkup += '<path class="fold" d="m72 28 15-8 15 16 15-16 15 16 15-16 15 16 15-16 15 8"/>';
  else if (top === 'telescope') topMarkup += '<path class="cut" d="M66 11h128v34H66z"/>';
  else if (top === 'open') topMarkup = '<path class="cut" d="M72 42h116"/><path class="fold" d="M74 18h112"/>';
  let bottomMarkup = '<path class="cut" d="M72 88h116"/>';
  if (bottom === 'simple-flaps') bottomMarkup += '<path class="fold" d="M130 60v28M72 74h116"/>';
  else if (bottom === 'full-overlap') bottomMarkup += '<path class="fold" d="M95 60v28m70-28v28"/>';
  else if (['auto-lock','snap-lock','two-point-glued'].includes(bottom)) bottomMarkup += '<path class="fold" d="m72 74 24-14 34 14 34-14 24 14M96 60l68 28m0-28L96 88"/>';
  svg.innerHTML = `<path class="body" d="M72 42h116v46H72z"/>${topMarkup}${bottomMarkup}`;
}
function packagingFaceMatchesPlacement(face, placement) {
  if (placement === 'lid') return face.axis === 'y' && face.sign > 0;
  if (!isVerticalFace(face)) return false;
  if (placement === 'all-sides') return true;
  if (placement === 'sides') return face.axis === 'x';
  return face.axis === 'z' && face.sign > 0;
}
function packagingRoundedRectPath(cx, cy, width, height, radius) {
  const p = new THREE.Path(); const x = cx - width/2, y = cy - height/2; const r = Math.min(radius, width/2, height/2);
  p.moveTo(x+r,y); p.lineTo(x+width-r,y); p.quadraticCurveTo(x+width,y,x+width,y+r); p.lineTo(x+width,y+height-r); p.quadraticCurveTo(x+width,y+height,x+width-r,y+height); p.lineTo(x+r,y+height); p.quadraticCurveTo(x,y+height,x,y+height-r); p.lineTo(x,y+r); p.quadraticCurveTo(x,y,x+r,y); return p;
}
function packagingFeatureHoles(face, width, height) {
  ensurePackagingState();
  const holes = [];
  const f = state.features;
  if (f.handleType !== 'none' && packagingFaceMatchesPlacement(face, f.handlePlacement)) {
    const w = Math.min(width * .72, Math.max(20, f.handleWidth)); const h = Math.min(height * .35, Math.max(10, f.handleHeight));
    holes.push({ path:packagingRoundedRectPath(0, isVerticalFace(face) ? height*.2 : 0, w, h, h*.48), reinforced:f.handleType === 'reinforced', cx:0, cy:isVerticalFace(face) ? height*.2 : 0, width:w, height:h });
  }
  if (f.holeType !== 'none' && packagingFaceMatchesPlacement(face, f.holePlacement)) {
    const count = Math.max(1, Math.min(12, Math.round(f.holeCount || 1))); const available = width * .7; const start = count === 1 ? 0 : -available/2; const step = count === 1 ? 0 : available/(count-1);
    for (let i=0;i<count;i+=1) {
      const cx = start + step*i; const cy = isVerticalFace(face) ? -height*.12 : 0;
      const w = Math.min(width*.3, Math.max(6, f.holeWidth)); const h = Math.min(height*.25, Math.max(6, f.holeHeight));
      if (f.holeType === 'round') { const p = new THREE.Path(); const r = Math.min(w,h)/2; p.absellipse(cx,cy,r,r,0,Math.PI*2,true); holes.push({path:p}); }
      else if (f.holeType === 'oval') { const p = new THREE.Path(); p.absellipse(cx,cy,w/2,h/2,0,Math.PI*2,true); holes.push({path:p}); }
      else holes.push({ path:packagingRoundedRectPath(cx,cy,w,h,h*.48) });
    }
  }
  return holes;
}
function packagingApplyBoardAndFeatures() {
  ensurePackagingState();
  clearGroup(packagingFeatureGroup);
  const outerColor = new THREE.Color(packagingOuterColor());
  for (const mesh of surfaceMeshes) {
    const face = mesh.userData?.face;
    if (!face || !mesh.geometry) continue;
    if (mesh.material?.color) mesh.material.color.copy(outerColor);
    const width = face.u2 - face.u1; const height = face.v2 - face.v1;
    const features = packagingFeatureHoles(face,width,height);
    if (!features.length) continue;
    const shape = new THREE.Shape(); shape.moveTo(-width/2,-height/2); shape.lineTo(width/2,-height/2); shape.lineTo(width/2,height/2); shape.lineTo(-width/2,height/2); shape.closePath();
    features.forEach((item) => shape.holes.push(item.path));
    mesh.geometry.dispose?.(); mesh.geometry = new THREE.ShapeGeometry(shape);
    for (const item of features.filter((entry) => entry.reinforced)) {
      const curve = new THREE.EllipseCurve(item.cx,item.cy,item.width/2+5,item.height/2+5,0,Math.PI*2,false,0);
      const points = curve.getPoints(40).map((p) => new THREE.Vector3(p.x,p.y,1));
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({color:0x7a542f,transparent:true,opacity:.75})); mesh.add(line);
    }
  }
}
function packagingLine(points, { color=0x725036, dashed=false, opacity=.65 } = {}) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = dashed ? new THREE.LineDashedMaterial({color,transparent:true,opacity,dashSize:12,gapSize:8}) : new THREE.LineBasicMaterial({color,transparent:true,opacity});
  const line = new THREE.Line(geometry,material); if (dashed) line.computeLineDistances(); packagingClosureGroup.add(line); return line;
}
function packagingTopMesh() { return surfaceMeshes.find((mesh) => mesh.userData?.top); }
function packagingBottomMesh() { return surfaceMeshes.find((mesh) => mesh.userData?.bottom); }
function packagingAddTopLine(x1,z1,x2,z2,y,opts) { packagingLine([new THREE.Vector3(x1,y,z1),new THREE.Vector3(x2,y,z2)],opts); }
function packagingRenderClosureVisuals() {
  ensurePackagingState();
  clearGroup(packagingClosureGroup);
  const b = boundsForBoxes(state.boxes); const topMesh = packagingTopMesh(); const bottomMesh = packagingBottomMesh();
  const topY = topMesh?.position?.y ?? b.maxY; const bottomY = bottomMesh?.position?.y ?? b.minY;
  if (topMesh) { topMesh.visible = state.closures.top !== 'open'; if (state.closures.top === 'open') topMesh.raycast = () => {}; }
  if (bottomMesh) { bottomMesh.visible = state.closures.bottom !== 'open'; if (state.closures.bottom === 'open') bottomMesh.raycast = () => {}; }
  const cx=(b.minX+b.maxX)/2, cz=(b.minZ+b.maxZ)/2, w=b.maxX-b.minX, d=b.maxZ-b.minZ;
  const top=state.closures.top, bottom=state.closures.bottom, seam={color:0x765035,opacity:.62};
  const cross=(y) => { packagingAddTopLine(cx,b.minZ,cx,b.maxZ,y,seam); packagingAddTopLine(b.minX,cz,b.maxX,cz,y,seam); };
  if (['simple-flaps','folded-flaps'].includes(top)) cross(topY+1.1);
  if (top === 'full-overlap') { packagingAddTopLine(b.minX,cz-d*.18,b.maxX,cz-d*.18,topY+1.1,seam); packagingAddTopLine(b.minX,cz+d*.18,b.maxX,cz+d*.18,topY+1.1,seam); }
  if (top === 'interlocking') { const pts=[]; for(let i=0;i<=10;i++) pts.push(new THREE.Vector3(b.minX+w*i/10,topY+1.1,cz+(i%2?d*.08:-d*.08))); packagingLine(pts,seam); }
  if (['tuck','hinged','self-locking','archive-lid','pizza-lid','mailer-lid'].includes(top)) {
    packagingAddTopLine(b.minX,b.minZ+w*0,b.maxX,b.minZ,topY+1.1,{...seam,dashed:true});
    packagingAddTopLine(b.minX+w*.12,b.maxZ-d*.08,b.maxX-w*.12,b.maxZ-d*.08,topY+1.1,seam);
    packagingAddTopLine(b.minX+w*.1,b.minZ,b.minX+w*.1,b.maxZ,topY+1.1,{...seam,opacity:.42}); packagingAddTopLine(b.maxX-w*.1,b.minZ,b.maxX-w*.1,b.maxZ,topY+1.1,{...seam,opacity:.42});
  }
  if (top === 'telescope') {
    const over=10; const y=topY+1.2; packagingLine([new THREE.Vector3(b.minX-over,y,b.minZ-over),new THREE.Vector3(b.maxX+over,y,b.minZ-over),new THREE.Vector3(b.maxX+over,y,b.maxZ+over),new THREE.Vector3(b.minX-over,y,b.maxZ+over),new THREE.Vector3(b.minX-over,y,b.minZ-over)],{...seam,opacity:.85});
  }
  if (top === 'sleeve') { packagingAddTopLine(b.minX+w*.16,b.minZ,b.minX+w*.16,b.maxZ,topY+1.1,seam); packagingAddTopLine(b.maxX-w*.16,b.minZ,b.maxX-w*.16,b.maxZ,topY+1.1,seam); }
  const bottomYLine=bottomY-1.1;
  if (['simple-flaps','folded-flaps'].includes(bottom)) cross(bottomYLine);
  if (bottom === 'full-overlap') { packagingAddTopLine(b.minX,cz-d*.18,b.maxX,cz-d*.18,bottomYLine,seam); packagingAddTopLine(b.minX,cz+d*.18,b.maxX,cz+d*.18,bottomYLine,seam); }
  if (['auto-lock','snap-lock','two-point-glued'].includes(bottom)) {
    packagingLine([new THREE.Vector3(b.minX,bottomYLine,b.minZ),new THREE.Vector3(cx,bottomYLine,cz),new THREE.Vector3(b.maxX,bottomYLine,b.minZ)],{...seam,dashed:true});
    packagingLine([new THREE.Vector3(b.minX,bottomYLine,b.maxZ),new THREE.Vector3(cx,bottomYLine,cz),new THREE.Vector3(b.maxX,bottomYLine,b.maxZ)],{...seam,dashed:true});
  }
  // Manufacturing seam / style-specific surface cues.
  if (['standard','full-overlap','auto-bottom','two-point-glued'].includes(state.boxType)) packagingLine([new THREE.Vector3(b.maxX+1,b.minY,b.minZ+w*.0),new THREE.Vector3(b.maxX+1,b.maxY,b.minZ)],{...seam,dashed:true,opacity:.42});
  if (state.boxType === 'sleeve-drawer') {
    packagingLine([new THREE.Vector3(b.minX+w*.08,b.minY+b.maxY*.13,b.maxZ+1),new THREE.Vector3(b.maxX-w*.08,b.minY+b.maxY*.13,b.maxZ+1)],seam);
    const pull=new THREE.EllipseCurve(cx,b.minY+b.maxY*.55,w*.08,Math.max(8,(b.maxY-b.minY)*.09),0,Math.PI,false,0); const points=pull.getPoints(24).map((p)=>new THREE.Vector3(p.x,p.y,b.maxZ+1.2)); packagingLine(points,seam);
  }
}
function packagingVerticalAreaMm2() {
  const metrics = calculateUnionMetrics(state.boxes);
  return metrics.faces.filter(isVerticalFace).reduce((sum,face)=>sum+(face.u2-face.u1)*(face.v2-face.v1),0);
}
function packagingBlankMetrics() {
  ensurePackagingState();
  const b=boundsForBoxes(state.boxes), opening=(b.maxX-b.minX)*(b.maxZ-b.minZ), vertical=packagingVerticalAreaMm2();
  const topFactor=PACKAGING_CLOSURES[state.closures.top]?.factor ?? 1, bottomFactor=PACKAGING_CLOSURES[state.closures.bottom]?.factor ?? 1;
  let areaMm2=vertical+opening*(topFactor+bottomFactor);
  if(state.boxType==='telescope') areaMm2+=vertical*.25;
  if(state.boxType==='sleeve-drawer') areaMm2+=vertical*.7+opening*.45;
  const gsm=packagingBoardGsm(); return {areaMm2,gsm,massKg:areaMm2/1_000_000*gsm/1000};
}
function packagingFeatureSummary() {
  const f=state.features, parts=[];
  if(f.handleType!=='none') parts.push(`${packT(f.handleType==='reinforced'?'feature.reinforced':'feature.dieCut')} · ${packT(({front:'feature.front',sides:'feature.sides','all-sides':'feature.allSides',lid:'feature.lid'})[f.handlePlacement])}`);
  if(f.holeType!=='none') parts.push(`${packT(({round:'feature.round',oval:'feature.oval',vents:'feature.vents'})[f.holeType])} × ${f.holeCount}`);
  return parts.join(' · ') || packT('bom.none');
}
function packagingLayerSummary() { return state.board.layers.map((layer)=>`${packT(PACKAGING_PAPER_COPY_KEYS[layer.paper])} ${Math.round(layer.gsm)} g/m²`).join(' / '); }
function packagingRenderSummaryExtension() {
  ensurePackagingState();
  const type=PACKAGING_BOX_TYPES[state.boxType], blank=packagingBlankMetrics(), b=boundsForBoxes(state.boxes), volume=(b.maxX-b.minX)*(b.maxY-b.minY)*(b.maxZ-b.minZ)/1_000_000_000;
  const set=(id,value)=>{const el=document.querySelector(id);if(el)el.textContent=value;};
  set('#summaryPieces',packagingTypeLabel()); set('#summarySides',type.code); set('#summaryBoardArea',`${(blank.areaMm2/1_000_000).toFixed(3)} m²`); set('#summaryMass',`${blank.massKg.toFixed(3)} kg`); set('#summaryVolume',`${volume.toFixed(3)} m³`); set('#summaryTextCount',String(state.textPlacements.length));
  const bom=document.querySelector('#bomList'); if(bom) bom.innerHTML=[
    [packT('bom.structure'),`${packagingTypeLabel()} · FEFCO ${type.code}`],
    [packT('bom.dimensions'),`${displayLength(b.maxX-b.minX)} × ${displayLength(b.maxZ-b.minZ)} × ${displayLength(b.maxY-b.minY)}`],
    [packT('bom.closures'),`${packagingClosureLabel(state.closures.top)} / ${packagingClosureLabel(state.closures.bottom)}`],
    [packT('bom.board'),`${state.board.construction} · ${state.board.flute} · ${state.board.preset==='CUSTOM'?packT('board.custom'):state.board.preset} · ≈ ${packagingNominalThickness().toFixed(1)} mm`],
    [packT('bom.layers'),packagingLayerSummary()],
    [packT('bom.features'),packagingFeatureSummary()],
  ].map(([label,value])=>`<div class="bom-row"><span>${packagingEscape(label)}</span><strong>${packagingEscape(value)}</strong></div>`).join('');
  const boardRate=PACKAGING_FLUTES[state.board.flute]?.priceM2||1.55; const whiteSurcharge=state.board.preset==='AFA'?1.12:state.board.preset==='AFT'?1.06:1; const material=blank.areaMm2/1_000_000*boardRate*whiteSurcharge; const conversion=.85+Object.keys(PACKAGING_BOX_TYPES).indexOf(state.boxType)*.07+(state.closures.top==='open'?0:.15)+(state.closures.bottom==='open'?0:.15); const features=(state.features.handleType==='none'?0:state.features.handleType==='reinforced'?.65:.35)+(state.features.holeType==='none'?0:.08*state.features.holeCount); const textCost=state.textPlacements.length*.35; const total=material+conversion+features+textCost;
  const breakdown=document.querySelector('#priceBreakdown'); if(breakdown) breakdown.innerHTML=[[packT('summary.material'),material],[packT('summary.conversion'),conversion],[packT('summary.features'),features],[packT('summary.textCost'),textCost]].map(([label,value])=>`<div class="price-row"><span>${packagingEscape(label)}</span><strong>${formatMoney(value)}</strong></div>`).join('');
  summaryTotal.textContent=formatMoney(total);
  return {totalEur:total};
}
function packagingBindControls() {
  document.querySelector('#boxTypeGrid')?.addEventListener('click',(event)=>{const button=event.target.closest('[data-box-type]');if(button)packagingApplyType(button.dataset.boxType);});
  document.querySelector('#topClosureSelect')?.addEventListener('change',(event)=>{state.closures.top=event.target.value;renderAll();});
  document.querySelector('#bottomClosureSelect')?.addEventListener('change',(event)=>{state.closures.bottom=event.target.value;renderAll();});
  document.querySelector('#boardConstructionSelect')?.addEventListener('change',(event)=>{const construction=event.target.value==='CO5'?'CO5':'CO3';state.board.construction=construction;state.board.flute=construction==='CO5'?'EB':'B';state.board.preset=['TFT','AFT','AFA'].includes(state.board.preset)?state.board.preset:'TFT';state.board.layers=packagingDefaultLayers(construction,state.board.preset);renderAll();});
  document.querySelector('#fluteChoiceGrid')?.addEventListener('click',(event)=>{const button=event.target.closest('[data-flute]');if(button&&PACKAGING_FLUTES[button.dataset.flute]){state.board.flute=button.dataset.flute;renderAll();}});
  document.querySelector('#paperPresetGrid')?.addEventListener('click',(event)=>{const button=event.target.closest('[data-paper-preset]');if(!button)return;state.board.preset=button.dataset.paperPreset;state.board.layers=packagingDefaultLayers(state.board.construction,state.board.preset);renderAll();});
  document.querySelector('#paperLayerEditor')?.addEventListener('change',(event)=>{const row=event.target.closest('[data-layer-index]');if(!row)return;const index=Number(row.dataset.layerIndex);const layer=state.board.layers[index];if(!layer)return;if(event.target.matches('[data-layer-paper]'))layer.paper=event.target.value;if(event.target.matches('[data-layer-gsm]'))layer.gsm=clamp(event.target.value,80,500);state.board.preset='CUSTOM';renderAll();});
  const featureChange=()=>{const read=(id)=>document.querySelector(id);state.features.handleType=read('#handleTypeSelect').value;state.features.handlePlacement=read('#handlePlacementSelect').value;state.features.handleWidth=clamp(toMm(read('#handleWidthInput').value),30,300);state.features.handleHeight=clamp(toMm(read('#handleHeightInput').value),15,120);state.features.holeType=read('#holeTypeSelect').value;state.features.holePlacement=read('#holePlacementSelect').value;state.features.holeCount=clamp(read('#holeCountInput').value,1,12);state.features.holeWidth=clamp(toMm(read('#holeWidthInput').value),8,180);state.features.holeHeight=clamp(toMm(read('#holeHeightInput').value),8,120);renderAll();};
  ['#handleTypeSelect','#handlePlacementSelect','#handleWidthInput','#handleHeightInput','#holeTypeSelect','#holePlacementSelect','#holeCountInput','#holeWidthInput','#holeHeightInput'].forEach((id)=>document.querySelector(id)?.addEventListener('change',featureChange));
}

// Preserve the full text-selection, wrapping, dragging and face-selection system.
// Only its arbitrary box-volume entry point is disabled.
beginAddMode = function disabledArbitraryBoxAdd() {};
const packagingLegacyRenderTranslations = renderTranslations;
renderTranslations = function renderTranslationsWithPackagingCatalog() { packagingLegacyRenderTranslations(); packagingApplyCopy(); };
const packagingLegacyRenderInputs = renderInputs;
renderInputs = function renderInputsWithPackagingCatalog() { packagingLegacyRenderInputs(); packagingRenderCatalogControls(); };
const packagingLegacyRebuildSurfaceMeshes = rebuildSurfaceMeshes;
rebuildSurfaceMeshes = function rebuildSurfaceMeshesWithPackagingDetails() { packagingLegacyRebuildSurfaceMeshes(); packagingApplyBoardAndFeatures(); packagingRenderClosureVisuals(); };
const packagingLegacyRenderSummary = renderSummary;
renderSummary = function renderSummaryWithPackagingBom() { packagingLegacyRenderSummary(); packagingRenderSummaryExtension(); };
const packagingLegacyCaptureState = captureState;
captureState = function capturePackagingState() { ensurePackagingState(); return { ...packagingLegacyCaptureState(), version:8, catalogSchemaVersion:PACKAGING_CATALOG_SCHEMA_VERSION, boxType:state.boxType, closures:{...state.closures}, features:{...state.features}, board:{...state.board,layers:state.board.layers.map((layer)=>({...layer}))} }; };
const packagingLegacyRestoreState = restoreState;
restoreState = function restorePackagingState(snapshot) { const source=snapshot?.state&&!snapshot.boxes?snapshot.state:snapshot; const restored=packagingLegacyRestoreState(snapshot); if(!restored)return false; state.boxType=PACKAGING_BOX_TYPES[source?.boxType]?source.boxType:'standard'; state.closures=source?.closures&&typeof source.closures==='object'?{...source.closures}:null; state.features=source?.features&&typeof source.features==='object'?{...source.features}:null; state.board=source?.board&&typeof source.board==='object'?{...source.board,layers:Array.isArray(source.board.layers)?source.board.layers.map((layer)=>({...layer})):null}:null; ensurePackagingState(); if(!source?.boxType&&state.boxes.length>1){const b=boundsForBoxes(state.boxes);packagingSetBaseDimensions(b.maxX-b.minX,b.maxZ-b.minZ,b.maxY-b.minY);} renderAll(); return true; };
const packagingLegacyResetConfiguration = resetConfiguration;
resetConfiguration = function resetPackagingConfiguration() { packagingLegacyResetConfiguration(); state.boxType='standard'; state.closures={top:'simple-flaps',bottom:'simple-flaps'}; state.features=packagingDefaultFeatures('standard'); state.board={construction:'CO3',flute:'B',preset:'TFT',layers:packagingDefaultLayers('CO3','TFT')}; packagingSetBaseDimensions(...PACKAGING_BOX_TYPES.standard.dims); renderAll(); return true; };
getPrice = function getPackagingPrice() { const total=packagingRenderSummaryExtension().totalEur; return {amount:total*(CURRENCY_FROM_EUR[currency]||1),currency}; };
ensurePackagingState();
packagingBindControls();


/* --------------------------------------------------------------------------
   Per-surface colours and image artwork
   -------------------------------------------------------------------------- */
const DECORATION_COPY = Object.freeze({
  'en-US': Object.freeze({
    'face.color': 'Colour surface', 'face.image': 'Add image', 'face.colorTitle': 'Surface colour',
    'face.outside': 'Outside surface', 'face.inside': 'Inside surface', 'face.currentColor': 'Current surface colour',
    'face.applyOuter': 'Apply to all outside surfaces', 'face.applyInner': 'Apply to all inside surfaces',
    'face.applyBoth': 'Apply to all outside & inside surfaces',
    'image.resize': 'Resize image', 'image.liftTop': 'Lift the top by 300 mm', 'image.delete': 'Delete image',
    'image.deselect': 'Deselect image', 'image.resizeTitle': 'Resize image',
    'image.resizeHelp': 'The image proportions are preserved automatically.', 'image.width': 'Width',
    'image.height': 'Height', 'image.scale': 'Scale', 'image.cancelPlacement': 'Cancel image placement',
    'image.uploadError': 'Choose a valid JPG or PNG image.', 'image.processing': 'Preparing the image…',
    'image.stateLimit': 'This configuration already contains too much image data. Remove an image or upload a smaller file.',
    'image.placeHint': 'Image placement mode: move over any outside or inside surface and click to place.',
    'summary.images': 'Image objects', 'summary.imageCost': 'Image finishing',
  }),
  'ro-RO': Object.freeze({
    'face.color': 'Colorează suprafața', 'face.image': 'Adaugă imagine', 'face.colorTitle': 'Culoare suprafață',
    'face.outside': 'Suprafață exterioară', 'face.inside': 'Suprafață interioară', 'face.currentColor': 'Culoarea curentă a suprafeței',
    'face.applyOuter': 'Aplică pe toate suprafețele exterioare', 'face.applyInner': 'Aplică pe toate suprafețele interioare',
    'face.applyBoth': 'Aplică pe toate suprafețele exterioare și interioare',
    'image.resize': 'Redimensionează imaginea', 'image.liftTop': 'Ridică partea superioară cu 300 mm', 'image.delete': 'Șterge imaginea',
    'image.deselect': 'Deselectează imaginea', 'image.resizeTitle': 'Redimensionează imaginea',
    'image.resizeHelp': 'Proporțiile imaginii sunt păstrate automat.', 'image.width': 'Lățime',
    'image.height': 'Înălțime', 'image.scale': 'Scală', 'image.cancelPlacement': 'Anulează plasarea imaginii',
    'image.uploadError': 'Alege o imagine JPG sau PNG validă.', 'image.processing': 'Se pregătește imaginea…',
    'image.stateLimit': 'Configurația conține deja prea multe date de imagine. Șterge o imagine sau încarcă un fișier mai mic.',
    'image.placeHint': 'Mod plasare imagine: mută cursorul pe orice suprafață exterioară sau interioară și apasă click.',
    'summary.images': 'Imagini', 'summary.imageCost': 'Finisaj imagini',
  }),
  'de-DE': Object.freeze({
    'face.color': 'Oberfläche färben', 'face.image': 'Bild hinzufügen', 'face.colorTitle': 'Oberflächenfarbe',
    'face.outside': 'Außenfläche', 'face.inside': 'Innenfläche', 'face.currentColor': 'Aktuelle Oberflächenfarbe',
    'face.applyOuter': 'Auf alle Außenflächen anwenden', 'face.applyInner': 'Auf alle Innenflächen anwenden',
    'face.applyBoth': 'Auf alle Außen- und Innenflächen anwenden',
    'image.resize': 'Bildgröße ändern', 'image.liftTop': 'Oberseite um 300 mm anheben', 'image.delete': 'Bild löschen',
    'image.deselect': 'Bild abwählen', 'image.resizeTitle': 'Bildgröße ändern',
    'image.resizeHelp': 'Das Seitenverhältnis des Bildes bleibt automatisch erhalten.', 'image.width': 'Breite',
    'image.height': 'Höhe', 'image.scale': 'Skalierung', 'image.cancelPlacement': 'Bildplatzierung abbrechen',
    'image.uploadError': 'Wählen Sie ein gültiges JPG- oder PNG-Bild.', 'image.processing': 'Bild wird vorbereitet…',
    'image.stateLimit': 'Diese Konfiguration enthält bereits zu viele Bilddaten. Entfernen Sie ein Bild oder laden Sie eine kleinere Datei hoch.',
    'image.placeHint': 'Bildplatzierungsmodus: Bewegen Sie den Cursor über eine Außen- oder Innenfläche und klicken Sie zum Platzieren.',
    'summary.images': 'Bildobjekte', 'summary.imageCost': 'Bildveredelung',
  }),
});
function decorationT(key) { return DECORATION_COPY[locale]?.[key] || DECORATION_COPY['en-US'][key] || key; }
function applyDecorationCopy() {
  document.querySelectorAll('[data-decoration-copy]').forEach((element) => { element.textContent = decorationT(element.dataset.decorationCopy); });
  document.querySelectorAll('[data-decoration-title]').forEach((element) => {
    const value = decorationT(element.dataset.decorationTitle);
    element.title = value;
    element.setAttribute('aria-label', value);
  });
}
function ensureDecorationState() {
  if (!state.faceColors || typeof state.faceColors !== 'object') state.faceColors = { outer: {}, inner: {} };
  if (!state.faceColors.outer || typeof state.faceColors.outer !== 'object') state.faceColors.outer = {};
  if (!state.faceColors.inner || typeof state.faceColors.inner !== 'object') state.faceColors.inner = {};
  if (!Array.isArray(state.imagePlacements)) state.imagePlacements = [];
}
function surfaceColorSlot(face) { return `${face.axis}:${face.sign >= 0 ? '+' : '-'}`; }
function surfaceColorBucket(sideFactor) { return sideFactor >= 0 ? 'outer' : 'inner'; }
function defaultSurfaceColor(sideFactor) {
  try { return sideFactor >= 0 ? packagingOuterColor() : packagingInnerColor(); }
  catch { return DEFAULT_COLOR; }
}
function resolvedSurfaceColor(face, sideFactor = 1) {
  ensureDecorationState();
  const bucket = surfaceColorBucket(sideFactor);
  return state.faceColors[bucket][surfaceColorSlot(face)] || defaultSurfaceColor(sideFactor);
}
function allSurfaceSlots() {
  return [...new Set(surfaceDescriptors.map(surfaceColorSlot))];
}
function setFaceColorOverride(face, sideFactor, color) {
  ensureDecorationState();
  state.faceColors[surfaceColorBucket(sideFactor)][surfaceColorSlot(face)] = color;
}
function renderFaceColorPanel() {
  if (!selectedFaceSnapshot || faceColorPanel.hidden) return;
  selectedFaceColor = resolvedSurfaceColor(selectedFaceSnapshot, selectedFaceSideFactor);
  faceColorSideLabel.textContent = decorationT(selectedFaceSideFactor >= 0 ? 'face.outside' : 'face.inside');
  faceCurrentColorSwatch.dataset.faceColor = selectedFaceColor;
  faceCurrentColorSwatch.style.setProperty('--swatch', selectedFaceColor);
  faceColorPalette.querySelectorAll('[data-face-color]').forEach((button) => {
    button.classList.toggle('is-active', String(button.dataset.faceColor).toLowerCase() === selectedFaceColor.toLowerCase());
  });
}
function openFaceColorPanel() {
  if (!selectedFaceSnapshot) return;
  faceActionPopup.hidden = true;
  textEditorPanel.hidden = true;
  imageResizePanel.hidden = true;
  faceColorPanel.hidden = false;
  renderFaceColorPanel();
  rebuildSurfaceMeshes();
}
function closeFaceColorPanel() {
  faceColorPanel.hidden = true;
  renderFacePopup();
}
function applySelectedFaceColor(color) {
  if (!selectedFaceSnapshot || !/^#[0-9a-f]{6}$/i.test(color)) return;
  recordUndoCheckpoint();
  selectedFaceColor = color.toLowerCase();
  setFaceColorOverride(selectedFaceSnapshot, selectedFaceSideFactor, selectedFaceColor);
  renderAll();
  markConfigurationDirty();
}
function applySelectedColorToScope(scope) {
  if (!/^#[0-9a-f]{6}$/i.test(selectedFaceColor)) return;
  ensureDecorationState();
  recordUndoCheckpoint();
  const slots = allSurfaceSlots();
  if (scope === 'outer' || scope === 'both') slots.forEach((slot) => { state.faceColors.outer[slot] = selectedFaceColor; });
  if (scope === 'inner' || scope === 'both') slots.forEach((slot) => { state.faceColors.inner[slot] = selectedFaceColor; });
  renderAll();
  markConfigurationDirty();
}

function displayFacePoint(face, point) {
  const result = point.clone();
  if (isTopFace(face) && isLidLiftActive()) result.y += LID_LIFT_MM;
  return result;
}
function storagePointForHit(face, point) {
  const result = point.clone();
  if (isTopFace(face) && isLidLiftActive()) result.y -= LID_LIFT_MM;
  return result;
}
function decorationFaceAvailable(face) {
  if (isTopFace(face) && state.closures?.top === 'open') return false;
  if (isBottomFace(face) && state.closures?.bottom === 'open') return false;
  return true;
}
function faceCoordinateRanges(face) {
  if (face.axis === 'x') return [{ axis: 'z', min: face.u1, max: face.u2 }, { axis: 'y', min: face.v1, max: face.v2 }];
  if (face.axis === 'y') return [{ axis: 'x', min: face.u1, max: face.u2 }, { axis: 'z', min: face.v1, max: face.v2 }];
  return [{ axis: 'x', min: face.u1, max: face.u2 }, { axis: 'y', min: face.v1, max: face.v2 }];
}
function worldPointOnFace(face, point, tolerance = 0.8) {
  const planeAxis = face.axis;
  if (Math.abs(point[planeAxis] - face.coord) > tolerance) return false;
  return faceCoordinateRanges(face).every((range) => point[range.axis] >= range.min - tolerance && point[range.axis] <= range.max + tolerance);
}
function faceBoundaryAlongDirection(face, point, direction) {
  let best = null;
  for (const range of faceCoordinateRanges(face)) {
    const component = direction[range.axis];
    if (Math.abs(component) < 1e-8) continue;
    const target = component > 0 ? range.max : range.min;
    const rawDistance = (target - point[range.axis]) / component;
    if (rawDistance < -1e-4) continue;
    const distance = Math.max(0, rawDistance);
    if (!best || distance < best.distance) best = { distance, axis: range.axis, target };
  }
  return best;
}
function adjacentSurfaceFace(currentFace, edgePoint, direction) {
  const candidates = surfaceDescriptors.filter((candidate) => {
    if (faceKey(candidate) === faceKey(currentFace) || !decorationFaceAvailable(candidate)) return false;
    if (!worldPointOnFace(candidate, edgePoint, 1.2)) return false;
    return faceNormal(candidate).dot(direction) > 1e-5;
  });
  return candidates.sort((a, b) => faceNormal(b).dot(direction) - faceNormal(a).dot(direction))[0] || null;
}
function cloneSurfaceFrame(frame) {
  return {
    face: frame.face,
    point: frame.point.clone(),
    horizontal: frame.horizontal.clone(),
    vertical: frame.vertical.clone(),
    normal: frame.normal.clone(),
    sideFactor: frame.sideFactor >= 0 ? 1 : -1,
    blocked: Boolean(frame.blocked),
  };
}
function transitionSurfaceFrame(frame, direction) {
  const nextFace = adjacentSurfaceFace(frame.face, frame.point, direction);
  if (!nextFace) {
    frame.blocked = true;
    return false;
  }
  const nextNormal = faceNormal(nextFace).multiplyScalar(frame.sideFactor).normalize();
  const rotation = new THREE.Quaternion().setFromUnitVectors(frame.normal.clone().normalize(), nextNormal);
  frame.horizontal.applyQuaternion(rotation).normalize();
  frame.vertical.applyQuaternion(rotation).normalize();
  frame.normal.copy(nextNormal);
  frame.face = nextFace;
  return true;
}
function walkSurfaceFrame(frame, offset, vectorKey) {
  const result = cloneSurfaceFrame(frame);
  const directionSign = offset >= 0 ? 1 : -1;
  let remaining = Math.abs(offset);
  if (remaining < EPSILON || result.blocked) return result;

  for (let step = 0; step < 128 && remaining > EPSILON; step += 1) {
    const direction = result[vectorKey].clone().multiplyScalar(directionSign).normalize();
    const boundary = faceBoundaryAlongDirection(result.face, result.point, direction);
    if (!boundary) {
      result.blocked = true;
      break;
    }

    // The frame may already sit exactly on an edge. Move onto the adjacent
    // surface immediately instead of travelling to the opposite edge of the
    // current face. This is what prevents artwork strips from collapsing at a
    // corner or generating thousands of tiny recursive cells.
    if (boundary.distance <= 1e-5) {
      if (!transitionSurfaceFrame(result, direction)) break;
      continue;
    }

    if (remaining <= boundary.distance + 1e-5) {
      result.point.add(direction.multiplyScalar(remaining));
      remaining = 0;
      break;
    }

    result.point.add(direction.multiplyScalar(boundary.distance));
    remaining -= boundary.distance;
    if (!transitionSurfaceFrame(result, direction)) break;
  }

  if (remaining > EPSILON) result.blocked = true;
  return result;
}
function traceSurfaceBreakpoints(startFrame, extent, vectorKey, directionSign) {
  const requested = Math.max(0, Number(extent) || 0);
  const result = cloneSurfaceFrame(startFrame);
  const breaks = [0];
  let travelled = 0;
  let remaining = requested;

  for (let step = 0; step < 128 && remaining > EPSILON; step += 1) {
    const direction = result[vectorKey].clone().multiplyScalar(directionSign).normalize();
    const boundary = faceBoundaryAlongDirection(result.face, result.point, direction);
    if (!boundary) {
      result.blocked = true;
      break;
    }
    if (boundary.distance <= 1e-5) {
      if (!transitionSurfaceFrame(result, direction)) break;
      continue;
    }
    if (remaining <= boundary.distance + 1e-5) {
      travelled += remaining;
      remaining = 0;
      breaks.push(directionSign * travelled);
      break;
    }
    result.point.add(direction.multiplyScalar(boundary.distance));
    travelled += boundary.distance;
    remaining -= boundary.distance;
    breaks.push(directionSign * travelled);
    if (!transitionSurfaceFrame(result, direction)) break;
  }

  if (requested <= EPSILON) return { breaks, reachable: 0 };
  if (remaining > EPSILON) {
    result.blocked = true;
    if (travelled > EPSILON && Math.abs(breaks[breaks.length - 1] - directionSign * travelled) > 1e-5) {
      breaks.push(directionSign * travelled);
    }
  }
  return { breaks, reachable: travelled, blocked: result.blocked };
}
function sortedUniqueBreakpoints(values) {
  return [...values]
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .filter((value, index, array) => index === 0 || Math.abs(value - array[index - 1]) > 1e-5);
}
function sameMappedSurface(lhs, rhs) {
  if (!lhs?.face || !rhs?.face || lhs.blocked || rhs.blocked) return false;
  if (faceKey(lhs.face) !== faceKey(rhs.face)) return false;
  return lhs.normal.dot(rhs.normal) > 0.9999
    && lhs.horizontal.dot(rhs.horizontal) > 0.9999
    && lhs.vertical.dot(rhs.vertical) > 0.9999;
}
function pruneRedundantSurfaceBreakpoints(breaks, mapper) {
  let result = sortedUniqueBreakpoints(breaks);
  let changed = true;
  while (changed && result.length > 2) {
    changed = false;
    const next = [result[0]];
    for (let index = 1; index < result.length - 1; index += 1) {
      const value = result[index];
      const leftGap = value - result[index - 1];
      const rightGap = result[index + 1] - value;
      const probe = Math.max(1e-4, Math.min(leftGap, rightGap) * 0.2);
      const before = mapper(value - probe);
      const after = mapper(value + probe);
      if (sameMappedSurface(before, after)) {
        changed = true;
        continue;
      }
      next.push(value);
    }
    next.push(result[result.length - 1]);
    result = next;
  }
  return result;
}
function mapSurfaceArtworkPoint(startFace, startAnchor, sideFactor, horizontalOffset, verticalOffset) {
  const basis = faceBasis(startFace, sideFactor);
  let frame = {
    face: startFace,
    point: startAnchor.clone(),
    horizontal: basis.horizontal.clone(),
    vertical: basis.vertical.clone(),
    normal: basis.normal.clone(),
    sideFactor: sideFactor >= 0 ? 1 : -1,
    blocked: false,
  };
  frame = walkSurfaceFrame(frame, horizontalOffset, 'horizontal');
  if (frame.blocked) return frame;
  return walkSurfaceFrame(frame, verticalOffset, 'vertical');
}
function quaternionForSurfaceFrame(horizontal, vertical, normal) {
  const h = horizontal.clone().normalize();
  const v = vertical.clone().normalize();
  const n = normal.clone().normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(h, v, n));
}
function computeSurfaceWrappedSegments(face, anchorPoint, sideFactor, width, height) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const anchor = clampPointToFace(face, sideFactor, anchorPoint, 0, 0);
  const basis = faceBasis(face, sideFactor);
  const startFrame = {
    face,
    point: anchor.clone(),
    horizontal: basis.horizontal.clone(),
    vertical: basis.vertical.clone(),
    normal: basis.normal.clone(),
    sideFactor: sideFactor >= 0 ? 1 : -1,
    blocked: false,
  };

  const leftTrace = traceSurfaceBreakpoints(startFrame, safeWidth / 2, 'horizontal', -1);
  const rightTrace = traceSurfaceBreakpoints(startFrame, safeWidth / 2, 'horizontal', 1);
  const horizontalBreaks = pruneRedundantSurfaceBreakpoints([
    ...leftTrace.breaks,
    0,
    ...rightTrace.breaks,
  ], (offset) => walkSurfaceFrame(startFrame, offset, 'horizontal'));
  const segments = [];

  for (let hIndex = 0; hIndex < horizontalBreaks.length - 1; hIndex += 1) {
    const h0 = horizontalBreaks[hIndex];
    const h1 = horizontalBreaks[hIndex + 1];
    if (h1 - h0 <= 1e-5) continue;
    const hMid = (h0 + h1) / 2;
    const horizontalFrame = walkSurfaceFrame(startFrame, hMid, 'horizontal');
    if (!horizontalFrame?.face || horizontalFrame.blocked) continue;

    const downTrace = traceSurfaceBreakpoints(horizontalFrame, safeHeight / 2, 'vertical', -1);
    const upTrace = traceSurfaceBreakpoints(horizontalFrame, safeHeight / 2, 'vertical', 1);
    const verticalBreaks = pruneRedundantSurfaceBreakpoints([
      ...downTrace.breaks,
      0,
      ...upTrace.breaks,
    ], (offset) => walkSurfaceFrame(horizontalFrame, offset, 'vertical'));

    for (let vIndex = 0; vIndex < verticalBreaks.length - 1; vIndex += 1) {
      const v0Offset = verticalBreaks[vIndex];
      const v1Offset = verticalBreaks[vIndex + 1];
      if (v1Offset - v0Offset <= 1e-5) continue;
      const vMid = (v0Offset + v1Offset) / 2;
      const mapped = mapSurfaceArtworkPoint(face, anchor, sideFactor, hMid, vMid);
      if (!mapped?.face || mapped.blocked) continue;
      const normal = mapped.normal.clone().normalize();
      const u0 = clamp(h0 / safeWidth + 0.5, 0, 1);
      const u1 = clamp(h1 / safeWidth + 0.5, 0, 1);
      const v0 = clamp(v0Offset / safeHeight + 0.5, 0, 1);
      const v1 = clamp(v1Offset / safeHeight + 0.5, 0, 1);
      const position = mapped.point.clone().add(normal.clone().multiplyScalar(SURFACE_TEXT_OFFSET_MM));
      segments.push({
        position: position.toArray(),
        quaternion: quaternionForSurfaceFrame(mapped.horizontal, mapped.vertical, normal).toArray(),
        u0, u1, v0, v1,
        width: h1 - h0,
        height: v1Offset - v0Offset,
        face: copyFace(mapped.face),
        sideFactor: sideFactor >= 0 ? 1 : -1,
      });
    }
  }

  return { anchor, segments };
}

const decorationLegacyMakeArtworkPlane = makeArtworkPlane;
makeArtworkPlane = function makeArtworkPlaneWithVerticalCrop(artwork, width, height, opacity = 1, u0 = 0, u1 = 1, v0 = 0, v1 = 1) {
  const geometry = new THREE.PlaneGeometry(width, height);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setX(i, uv.getX(i) < 0.5 ? u0 : u1);
    uv.setY(i, uv.getY(i) < 0.5 ? v0 : v1);
  }
  uv.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({ map: artwork.texture, transparent: true, side: THREE.DoubleSide, opacity, depthWrite: opacity >= 1, alphaTest: 0.001 });
  return new THREE.Mesh(geometry, material);
};
function renderArtworkSegments(artwork, segments, opacity = 1) {
  const group = new THREE.Group();
  for (const segmentData of segments || []) {
    const segment = makeArtworkPlane(
      artwork,
      Number(segmentData.width) || 10,
      Number(segmentData.height) || 10,
      opacity,
      Number.isFinite(Number(segmentData.u0)) ? Number(segmentData.u0) : 0,
      Number.isFinite(Number(segmentData.u1)) ? Number(segmentData.u1) : 1,
      Number.isFinite(Number(segmentData.v0)) ? Number(segmentData.v0) : 0,
      Number.isFinite(Number(segmentData.v1)) ? Number(segmentData.v1) : 1,
    );
    const position = new THREE.Vector3().fromArray(segmentData.position || [0,0,0]);
    const segmentFace = currentFaceForDescriptor(segmentData.face) || segmentData.face;
    if (segmentFace && isTopFace(segmentFace) && isLidLiftActive()) position.y += LID_LIFT_MM;
    segment.position.copy(position);
    segment.quaternion.fromArray(segmentData.quaternion || [0,0,0,1]);
    group.add(segment);
  }
  return group;
}
createStoredStickerSegments = function createStoredStickerSegmentsWithTopAndBottomWrapping(spec, segments, opacity = 1) {
  const artwork = createTextArtwork(spec);
  return renderArtworkSegments(artwork, segments, opacity);
};
function createGeneralTextSticker(spec, face, anchorPoint, sideFactor = 1, opacity = 1) {
  const artwork = createTextArtwork(spec);
  const computed = computeSurfaceWrappedSegments(face, anchorPoint, sideFactor, artwork.worldWidth, artwork.worldHeight);
  return { group: renderArtworkSegments(artwork, computed.segments, opacity), segments: computed.segments, anchor: computed.anchor };
}

const decorationLegacyBuildPlacementGeometry = buildPlacementGeometry;
buildPlacementGeometry = function buildPlacementGeometryWithHorizontalSurfaceWrapping(spec, face, anchorPoint, sideFactor = 1) {
  if (isVerticalFace(face)) return decorationLegacyBuildPlacementGeometry(spec, face, anchorPoint, sideFactor);
  const sticker = createGeneralTextSticker(spec, face, anchorPoint, sideFactor, 1);
  clearGroup(sticker.group);
  return {
    face: copyFace(face), sideFactor, anchor: sticker.anchor.toArray(),
    segments: sticker.segments.map((segment) => ({ ...segment, position: [...segment.position], quaternion: [...segment.quaternion], face: copyFace(segment.face) })),
    position: undefined, quaternion: undefined, topSurface: isTopFace(face),
  };
};
renderPlacedTexts = function renderPlacedTextsWithTopAndBottomWrapping() {
  clearGroup(textGroup);
  for (const placement of state.textPlacements) {
    const placementId = ensurePlacementId(placement);
    if (placementId === editingTextId) continue;
    const resolved = resolvePlacementFaceInfo(placement);
    if (resolved?.face && resolved.anchor) {
      const sticker = isVerticalFace(resolved.face)
        ? createWrappedSticker(placement.spec, resolved.face, resolved.anchor.clone(), resolved.sideFactor, 1)
        : createGeneralTextSticker(placement.spec, resolved.face, resolved.anchor.clone(), resolved.sideFactor, 1);
      placement.face = copyFace(resolved.face);
      placement.sideFactor = resolved.sideFactor;
      placement.anchor = resolved.anchor.toArray();
      placement.segments = sticker.segments.map((segment) => ({
        ...segment, position: [...segment.position], quaternion: [...segment.quaternion], face: copyFace(segment.face),
      }));
      placement.position = undefined;
      placement.quaternion = undefined;
      placement.topSurface = isTopFace(resolved.face);
      tagTextRenderable(sticker.group, placementId);
      textGroup.add(sticker.group);
      continue;
    }
    if (Array.isArray(placement.segments) && placement.segments.length) {
      const group = createStoredStickerSegments(placement.spec, placement.segments, 1);
      tagTextRenderable(group, placementId);
      textGroup.add(group);
    }
  }
};
renderEditorPreview = function renderEditorPreviewWithHorizontalWrapping() {
  clearGroup(editorPreviewGroup);
  editorPreviewSpec = null;
  if (textEditorPanel.hidden) return;
  const spec = buildTextSpec();
  editorPreviewSpec = { ...spec };
  let face = selectedFaceSnapshot;
  let sideFactor = selectedFaceSideFactor;
  let anchor = face ? faceCenter(face) : null;
  if (editingTextId) {
    const placement = placementById(editingTextId);
    const info = resolvePlacementFaceInfo(placement);
    if (!placement || !info) return;
    face = info.face; sideFactor = info.sideFactor; anchor = info.anchor;
  }
  if (!face || !anchor) return;
  const sticker = isVerticalFace(face)
    ? createWrappedSticker(spec, face, anchor.clone(), sideFactor, 0.94)
    : createGeneralTextSticker(spec, face, anchor.clone(), sideFactor, 0.94);
  editorPreviewGroup.add(sticker.group);
};
updateTextPreview = function updateTextPreviewWithAllSurfaceWrapping(event) {
  if (!placementMode || !pendingTextSpec) return;
  clearGroup(previewGroup);
  previewTextMesh = null;
  previewPlacement = null;
  const { hit, raycaster } = raycast(event);
  if (!hit?.object?.userData?.face) return;
  const face = hit.object.userData.face;
  if (!decorationFaceAvailable(face)) return;
  let normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  if (normal.dot(raycaster.ray.direction) > 0) normal.multiplyScalar(-1);
  const outward = faceNormal(face);
  const sideFactor = Number(hit.object.userData.surfaceSideFactor) || (normal.dot(outward) >= 0 ? 1 : -1);
  const hitStoragePoint = storagePointForHit(face, hit.point);
  const anchor = clampPointToFace(face, sideFactor, hitStoragePoint);
  const sticker = isVerticalFace(face)
    ? createWrappedSticker(pendingTextSpec, face, anchor.clone(), sideFactor, 0.78)
    : createGeneralTextSticker(pendingTextSpec, face, anchor.clone(), sideFactor, 0.78);
  previewGroup.add(sticker.group);
  previewPlacement = {
    id: makeTextPlacementId(), face: copyFace(face), sideFactor, anchor: anchor.toArray(),
    segments: sticker.segments.map((segment) => ({ ...segment, face: copyFace(segment.face) })),
    topSurface: isTopFace(face), spec: { ...pendingTextSpec },
  };
};

function makeImagePlacementId() {
  if (globalThis.crypto?.randomUUID) return `image-${globalThis.crypto.randomUUID()}`;
  return `image-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
}
function ensureImagePlacementId(placement) {
  if (!placement.id) placement.id = makeImagePlacementId();
  return placement.id;
}
function imagePlacementById(id) { return state.imagePlacements.find((placement) => ensureImagePlacementId(placement) === id) || null; }
function serializeImagePlacement(placement) {
  return {
    id: ensureImagePlacementId(placement),
    face: placement.face ? copyFace(placement.face) : undefined,
    sideFactor: Number(placement.sideFactor) < 0 ? -1 : 1,
    anchor: Array.isArray(placement.anchor) ? [...placement.anchor] : undefined,
    segments: Array.isArray(placement.segments) ? placement.segments.map((segment) => ({
      position: [...segment.position], quaternion: [...segment.quaternion],
      u0: segment.u0, u1: segment.u1, v0: segment.v0, v1: segment.v1,
      width: segment.width, height: segment.height,
      face: segment.face ? copyFace(segment.face) : undefined,
      sideFactor: Number(segment.sideFactor) < 0 ? -1 : 1,
    })) : undefined,
    spec: { ...placement.spec },
  };
}
function restoreImagePlacement(raw = {}) {
  return {
    id: String(raw.id || makeImagePlacementId()),
    face: raw.face ? copyFace(raw.face) : undefined,
    sideFactor: Number(raw.sideFactor) < 0 ? -1 : 1,
    anchor: Array.isArray(raw.anchor) ? raw.anchor.map(Number) : undefined,
    segments: Array.isArray(raw.segments) ? raw.segments.map((segment) => ({
      position: Array.isArray(segment.position) ? segment.position.map(Number) : [0,0,0],
      quaternion: Array.isArray(segment.quaternion) ? segment.quaternion.map(Number) : [0,0,0,1],
      u0: Number(segment.u0) || 0, u1: Number(segment.u1) || 1,
      v0: Number.isFinite(Number(segment.v0)) ? Number(segment.v0) : 0,
      v1: Number.isFinite(Number(segment.v1)) ? Number(segment.v1) : 1,
      width: Math.max(1, Number(segment.width) || 10), height: Math.max(1, Number(segment.height) || 10),
      face: segment.face ? copyFace(segment.face) : undefined,
      sideFactor: Number(segment.sideFactor) < 0 ? -1 : 1,
    })) : [],
    spec: {
      dataUrl: String(raw.spec?.dataUrl || ''),
      fileName: String(raw.spec?.fileName || 'image'),
      mimeType: String(raw.spec?.mimeType || 'image/webp'),
      naturalWidth: Math.max(1, Number(raw.spec?.naturalWidth) || 1),
      naturalHeight: Math.max(1, Number(raw.spec?.naturalHeight) || 1),
      width: clamp(raw.spec?.width || 120, 5, 5000),
      height: clamp(raw.spec?.height || 80, 5, 5000),
    },
  };
}
function resolveImagePlacementFaceInfo(placement) {
  if (!placement) return null;
  ensureImagePlacementId(placement);
  let face = currentFaceForDescriptor(placement.face);
  let sideFactor = Number(placement.sideFactor) < 0 ? -1 : 1;
  let anchor = Array.isArray(placement.anchor) ? new THREE.Vector3().fromArray(placement.anchor) : null;
  if ((!face || !anchor) && Array.isArray(placement.segments) && placement.segments.length) {
    const ordered = [...placement.segments].sort((a,b) => {
      const au = ((Number(a.u0)||0)+(Number(a.u1)||1))/2 - .5;
      const av = ((Number(a.v0)||0)+(Number(a.v1)||1))/2 - .5;
      const bu = ((Number(b.u0)||0)+(Number(b.u1)||1))/2 - .5;
      const bv = ((Number(b.v0)||0)+(Number(b.v1)||1))/2 - .5;
      return au*au+av*av - (bu*bu+bv*bv);
    });
    const segment = ordered[0];
    const info = segmentFaceInfo(segment);
    if (info) {
      face = face || info.face;
      sideFactor = info.sideFactor;
      anchor = anchor || new THREE.Vector3().fromArray(segment.position || [0,0,0]);
    }
  }
  if (!face) return null;
  if (!anchor) anchor = faceCenter(face);
  const basis = faceBasis(face, sideFactor);
  anchor.sub(basis.normal.clone().multiplyScalar(anchor.clone().sub(basis.center).dot(basis.normal)));
  placement.face = copyFace(face); placement.sideFactor = sideFactor; placement.anchor = anchor.toArray();
  return { face, sideFactor, anchor };
}
function resolveImagePrimaryFaceInfo(placement) {
  if (!placement?.segments?.length) return resolveImagePlacementFaceInfo(placement);
  const weights = new Map();
  const centers = new Map();
  const sideFactors = new Map();
  for (const segment of placement.segments) {
    const info = segmentFaceInfo(segment); if (!info) continue;
    const key = faceKey(info.face); const weight = Math.max(1, Number(segment.width)||1) * Math.max(1, Number(segment.height)||1);
    weights.set(key,(weights.get(key)||0)+weight);
    const entry=centers.get(key)||{point:new THREE.Vector3(),weight:0};
    entry.point.add(new THREE.Vector3().fromArray(segment.position||[0,0,0]).multiplyScalar(weight)); entry.weight+=weight; centers.set(key,entry); sideFactors.set(key,info.sideFactor);
  }
  if (!weights.size) return resolveImagePlacementFaceInfo(placement);
  const key=[...weights.entries()].sort((a,b)=>b[1]-a[1])[0][0];
  const face=surfaceDescriptors.find((candidate)=>faceKey(candidate)===key); if(!face)return resolveImagePlacementFaceInfo(placement);
  const sideFactor=sideFactors.get(key)||1; const entry=centers.get(key); const anchor=entry?.weight?entry.point.multiplyScalar(1/entry.weight):faceCenter(face);
  const basis=faceBasis(face,sideFactor); anchor.sub(basis.normal.clone().multiplyScalar(anchor.clone().sub(basis.center).dot(basis.normal)));
  return {face,sideFactor,anchor};
}
function applyImagePlacementGeometry(placement, face, anchorPoint, sideFactor = 1) {
  if (!placement || !face || !anchorPoint) return false;
  const computed = computeSurfaceWrappedSegments(face, anchorPoint, sideFactor, placement.spec.width, placement.spec.height);
  placement.face = copyFace(face); placement.sideFactor = sideFactor; placement.anchor = computed.anchor.toArray();
  placement.segments = computed.segments.map((segment) => ({ ...segment, position:[...segment.position], quaternion:[...segment.quaternion], face:copyFace(segment.face) }));
  return true;
}
function loadImageElement(dataUrl) {
  if (!dataUrl) return Promise.reject(new Error('Missing image data.'));
  if (imageElementCache.has(dataUrl)) return imageElementCache.get(dataUrl);
  const promise = new Promise((resolve,reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The uploaded image could not be decoded.'));
    image.src = dataUrl;
  });
  imageElementCache.set(dataUrl,promise);
  return promise;
}
function createImageArtwork(spec, image) {
  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return { texture, worldWidth: spec.width, worldHeight: spec.height };
}
function tagImageRenderable(object, placementId) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.userData.cardboxImage = true;
    child.userData.imagePlacementId = placementId;
  });
}
async function renderPlacedImages() {
  ensureDecorationState();
  const generation = ++imageRenderGeneration;
  clearGroup(imageGroup);
  const placements = [...state.imagePlacements];
  await Promise.all(placements.map(async (placement) => {
    try {
      const image = await loadImageElement(placement.spec.dataUrl);
      if (generation !== imageRenderGeneration) return;
      const info = resolveImagePlacementFaceInfo(placement);
      if (!info) return;
      applyImagePlacementGeometry(placement, info.face, info.anchor, info.sideFactor);
      const artwork = createImageArtwork(placement.spec, image);
      const group = renderArtworkSegments(artwork, placement.segments, 1);
      tagImageRenderable(group, ensureImagePlacementId(placement));
      imageGroup.add(group);
    } catch (error) {
      console.warn('A saved Cardbox image could not be rendered.', error);
    }
  }));
  if (generation === imageRenderGeneration) renderImageSelection();
}
function raycastImage(event) { return raycast(event, imageGroup.children, true); }
function totalEmbeddedImageChars() {
  ensureDecorationState();
  return state.imagePlacements.reduce((total, placement) => total + String(placement?.spec?.dataUrl || '').length, 0);
}
function normalizedImageMimeAllowed(file) {
  const mimeType = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  return mimeType === 'image/jpeg' || mimeType === 'image/png' || /\.(jpe?g|png)$/.test(name);
}
function normalizeImageFile(file) {
  return new Promise((resolve,reject) => {
    if (!file || !normalizedImageMimeAllowed(file) || file.size > MAX_IMAGE_FILE_BYTES) {
      reject(new Error(decorationT('image.uploadError')));
      return;
    }
    const remainingBudget = MAX_TOTAL_IMAGE_DATA_URL_CHARS - totalEmbeddedImageChars();
    const targetChars = Math.min(MAX_IMAGE_DATA_URL_CHARS, remainingBudget);
    if (targetChars < 24_000) {
      reject(new Error(decorationT('image.stateLimit')));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(decorationT('image.uploadError')));
    reader.onload = async () => {
      try {
        const originalUrl = String(reader.result || '');
        const original = await loadImageElement(originalUrl);
        let scale = Math.min(1, 1400 / Math.max(original.naturalWidth, original.naturalHeight));
        let width = Math.max(1, Math.round(original.naturalWidth * scale));
        let height = Math.max(1, Math.round(original.naturalHeight * scale));
        let dataUrl = originalUrl;

        for (let attempt = 0; attempt < 10; attempt += 1) {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          context.clearRect(0, 0, width, height);
          context.drawImage(original, 0, 0, width, height);
          const quality = Math.max(0.5, 0.9 - attempt * 0.045);
          const webpCandidate = canvas.toDataURL('image/webp', quality);
          dataUrl = webpCandidate.startsWith('data:image/webp')
            ? webpCandidate
            : canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality);
          if (dataUrl.length <= targetChars) break;

          const ratio = Math.sqrt(targetChars / Math.max(1, dataUrl.length)) * 0.92;
          const shrink = clamp(ratio, 0.58, 0.84);
          const nextWidth = Math.max(180, Math.round(width * shrink));
          const nextHeight = Math.max(180, Math.round(height * shrink));
          if (nextWidth === width && nextHeight === height) break;
          width = nextWidth;
          height = nextHeight;
        }

        if (dataUrl.length > targetChars || totalEmbeddedImageChars() + dataUrl.length > MAX_TOTAL_IMAGE_DATA_URL_CHARS) {
          throw new Error(decorationT('image.stateLimit'));
        }
        const normalizedImage = await loadImageElement(dataUrl);
        resolve({
          dataUrl,
          image: normalizedImage,
          fileName: String(file.name || 'image').slice(0,120),
          mimeType: dataUrl.slice(5,dataUrl.indexOf(';')) || file.type,
          naturalWidth: normalizedImage.naturalWidth,
          naturalHeight: normalizedImage.naturalHeight,
        });
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsDataURL(file);
  });
}

function initialImageDimensions(face, sideFactor, naturalWidth, naturalHeight) {
  const basis = faceBasis(face, sideFactor);
  const faceWidth = basis.hMax - basis.hMin;
  const faceHeightValue = basis.vMax - basis.vMin;
  const aspect = Math.max(.01, naturalWidth / Math.max(1,naturalHeight));
  let width; let height;
  if (naturalWidth >= naturalHeight) { width = faceWidth * .5; height = width / aspect; }
  else { height = faceHeightValue * .5; width = height * aspect; }
  const fitScale = Math.min(1, faceWidth*.92/Math.max(width,1), faceHeightValue*.92/Math.max(height,1));
  return { width: Math.max(10,width*fitScale), height: Math.max(10,height*fitScale) };
}
function showImagePlacementPreview(face, anchor, sideFactor) {
  clearGroup(imagePreviewGroup);
  if (!pendingImageSpec || !pendingImageElement) return;
  const placement = { id:makeImagePlacementId(), face:copyFace(face), sideFactor, anchor:anchor.toArray(), spec:{...pendingImageSpec}, segments:[] };
  applyImagePlacementGeometry(placement,face,anchor,sideFactor);
  const artwork=createImageArtwork(placement.spec,pendingImageElement);
  const group=renderArtworkSegments(artwork,placement.segments,.78);
  imagePreviewGroup.add(group);
  previewImagePlacement=placement;
}
async function startImageUpload() {
  if (!selectedFaceSnapshot) return;
  faceActionPopup.hidden = true;
  faceColorPanel.hidden = true;
  faceImageInput.value = '';
  faceImageInput.click();
}
async function handleImageUploadFile(file) {
  if (!selectedFaceSnapshot || !file) { renderFacePopup(); return; }
  viewerHint.textContent = decorationT('image.processing');
  try {
    const normalized = await normalizeImageFile(file);
    const dimensions = initialImageDimensions(selectedFaceSnapshot, selectedFaceSideFactor, normalized.naturalWidth, normalized.naturalHeight);
    pendingImageSpec = {
      dataUrl: normalized.dataUrl, fileName: normalized.fileName, mimeType: normalized.mimeType,
      naturalWidth: normalized.naturalWidth, naturalHeight: normalized.naturalHeight,
      width: dimensions.width, height: dimensions.height,
    };
    pendingImageElement = normalized.image;
    imagePlacementMode = true;
    cancelImagePlacementButton.hidden = false;
    const initialFace = copyFace(selectedFaceSnapshot);
    const initialSideFactor = selectedFaceSideFactor;
    const initialAnchor = faceCenter(initialFace);
    selectedFaceKey=''; selectedFaceSnapshot=null;
    rebuildSurfaceMeshes();
    showImagePlacementPreview(currentFaceForDescriptor(initialFace)||initialFace, initialAnchor, initialSideFactor);
    viewerHint.textContent = decorationT('image.placeHint');
  } catch (error) {
    console.error('Cardbox image upload failed.', error);
    viewerHint.textContent = error?.message || decorationT('image.uploadError');
    renderFacePopup();
  }
}
function updateImagePreview(event) {
  if (!imagePlacementMode || !pendingImageSpec || !pendingImageElement) return;
  clearGroup(imagePreviewGroup); previewImagePlacement=null;
  const {hit,raycaster}=raycast(event);
  if(!hit?.object?.userData?.face)return;
  const face=hit.object.userData.face; if(!decorationFaceAvailable(face))return;
  let normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  if(normal.dot(raycaster.ray.direction)>0)normal.multiplyScalar(-1);
  const outward=faceNormal(face);
  const sideFactor=Number(hit.object.userData.surfaceSideFactor)||(normal.dot(outward)>=0?1:-1);
  const anchor=clampPointToFace(face,sideFactor,storagePointForHit(face,hit.point));
  showImagePlacementPreview(face,anchor,sideFactor);
}
function exitImagePlacementMode({selectId=''}={}) {
  imagePlacementMode=false; pendingImageSpec=null; pendingImageElement=null; previewImagePlacement=null;
  clearGroup(imagePreviewGroup); cancelImagePlacementButton.hidden=true;
  if(selectId)selectedImageId=selectId;
  renderAll();
}
function commitImagePlacement() {
  if(!previewImagePlacement)return;
  recordUndoCheckpoint();
  const placement=restoreImagePlacement(serializeImagePlacement(previewImagePlacement));
  ensureImagePlacementId(placement); state.imagePlacements.push(placement);
  const id=placement.id; exitImagePlacementMode({selectId:id}); markConfigurationDirty();
}
function selectImagePlacement(id) {
  const placement=imagePlacementById(id); if(!placement)return;
  if(selectedImageId===id){deselectImagePlacement();return;}
  deselectFace();
  if(selectedTextId)deselectTextPlacement();
  selectedImageId=id; lidLiftEnabled=false;
  canvasHost.classList.add('has-selected-image');
  rebuildSurfaceMeshes(); renderImageSelection();
}
function deselectImagePlacement() {
  selectedImageId=''; imageDragging=false; imageDragPointerId=null; imageDragMoved=false; controls.enabled=true;
  lidLiftEnabled=false; canvasHost.classList.remove('is-image-dragging','has-selected-image');
  imageResizePanel.hidden=true; imageResizeOriginal=null;
  clearGroup(imageSelectionGroup); imageSelectionHud.hidden=true; imageSelectionHud.style.display='none'; imageHudAnchor=null;
  rebuildSurfaceMeshes();
}
function imagePlacementBoundsOnFace(placement,face,sideFactor) {
  const basis=faceBasis(face,sideFactor); const points=[];
  for(const segment of placement.segments||[]){const info=segmentFaceInfo(segment);if(!info||faceKey(info.face)!==faceKey(face))continue;const position=new THREE.Vector3().fromArray(segment.position||[0,0,0]);if(isTopFace(info.face)&&isLidLiftActive())position.y+=LID_LIFT_MM;const quaternion=new THREE.Quaternion().fromArray(segment.quaternion||[0,0,0,1]);points.push(...textPlaneCorners(position,quaternion,Number(segment.width)||10,Number(segment.height)||10));}
  if(!points.length)return null;
  const coords=points.map((point)=>{const relative=point.clone().sub(basis.center);return{h:relative.dot(basis.horizontal),v:relative.dot(basis.vertical)};});
  return{basis,hMin:Math.min(...coords.map(p=>p.h)),hMax:Math.max(...coords.map(p=>p.h)),vMin:Math.min(...coords.map(p=>p.v)),vMax:Math.max(...coords.map(p=>p.v))};
}
function renderImageSelection() {
  clearGroup(imageSelectionGroup); imageHudAnchor=null; imageSelectionHud.hidden=true; imageSelectionHud.style.display='none';
  canvasHost.classList.toggle('has-selected-image',Boolean(selectedImageId));
  imageLiftTopButton.classList.toggle('is-active',isLidLiftActive());
  if(!selectedImageId||imagePlacementMode||placementMode||addMode||!imageResizePanel.hidden||!textEditorPanel.hidden||!faceColorPanel.hidden)return;
  const placement=imagePlacementById(selectedImageId); const info=resolveImagePrimaryFaceInfo(placement); if(!placement||!info)return;
  const bounds=imagePlacementBoundsOnFace(placement,info.face,info.sideFactor); if(!bounds)return;
  const hMin=Math.max(bounds.hMin,bounds.basis.hMin),hMax=Math.min(bounds.hMax,bounds.basis.hMax),vMin=Math.max(bounds.vMin,bounds.basis.vMin),vMax=Math.min(bounds.vMax,bounds.basis.vMax);
  const points=[faceDisplayPointFromLocal(info.face,info.sideFactor,hMin,vMin,SURFACE_TEXT_OFFSET_MM+3.5),faceDisplayPointFromLocal(info.face,info.sideFactor,hMax,vMin,SURFACE_TEXT_OFFSET_MM+3.5),faceDisplayPointFromLocal(info.face,info.sideFactor,hMax,vMax,SURFACE_TEXT_OFFSET_MM+3.5),faceDisplayPointFromLocal(info.face,info.sideFactor,hMin,vMax,SURFACE_TEXT_OFFSET_MM+3.5)];
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([...points,points[0]]),new THREE.LineBasicMaterial({color:0x0e82d8,transparent:true,opacity:.95,depthTest:false})); line.renderOrder=25; imageSelectionGroup.add(line);
  imageHudAnchor=faceDisplayPointFromLocal(info.face,info.sideFactor,hMax,vMin,SURFACE_TEXT_OFFSET_MM+4);
  imageSelectionHud.hidden=false; imageSelectionHud.style.display='';
}
function toggleSelectedImageLidLift(){if(!selectedImageId)return;lidLiftEnabled=!lidLiftEnabled;rebuildSurfaceMeshes();renderImageSelection();}
function deleteSelectedImage(){if(!selectedImageId)return;recordUndoCheckpoint();state.imagePlacements=state.imagePlacements.filter((p)=>ensureImagePlacementId(p)!==selectedImageId);selectedImageId='';lidLiftEnabled=false;renderAll();markConfigurationDirty();}
function beginSelectedImageDrag(event){
  if(event.button!==0||!selectedImageId||imagePlacementMode||placementMode||addMode||!imageResizePanel.hidden||!textEditorPanel.hidden||!faceColorPanel.hidden)return false;
  const hit=raycastImage(event).hit;if(!hit||hit.object.userData.imagePlacementId!==selectedImageId)return false;
  recordUndoCheckpoint();imageDragging=true;imageDragPointerId=event.pointerId;imageDragMoved=false;controls.enabled=false;canvasHost.classList.add('is-image-dragging');
  try{renderer.domElement.setPointerCapture(event.pointerId);}catch{} event.preventDefault();return true;
}
function moveSelectedImageWithPointer(event){
  if(!imageDragging||!selectedImageId)return false;const placement=imagePlacementById(selectedImageId);if(!placement)return false;
  const{hit,raycaster}=raycast(event,surfaceMeshes,false);if(!hit?.object?.userData?.face)return false;const face=hit.object.userData.face;if(!decorationFaceAvailable(face))return false;
  let normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();if(normal.dot(raycaster.ray.direction)>0)normal.multiplyScalar(-1);
  const sideFactor=Number(hit.object.userData.surfaceSideFactor)||(normal.dot(faceNormal(face))>=0?1:-1);const anchor=clampPointToFace(face,sideFactor,storagePointForHit(face,hit.point));
  imageDragMoved=true;suppressCanvasClick=true;applyImagePlacementGeometry(placement,face,anchor,sideFactor);void renderPlacedImages();renderImageSelection();return true;
}
function endSelectedImageDrag(event){
  if(!imageDragging)return false;if(imageDragPointerId!=null&&event.pointerId!==imageDragPointerId)return false;const moved=imageDragMoved;imageDragging=false;imageDragPointerId=null;imageDragMoved=false;controls.enabled=true;canvasHost.classList.remove('is-image-dragging');
  try{renderer.domElement.releasePointerCapture(event.pointerId);}catch{} renderImageSelection();if(moved)markConfigurationDirty();return true;
}
function openImageResizePanel(){
  const placement=imagePlacementById(selectedImageId);if(!placement)return;recordUndoCheckpoint();
  imageResizeOriginal={width:placement.spec.width,height:placement.spec.height};imageResizeStartWidth=placement.spec.width;imageResizeStartHeight=placement.spec.height;
  imageSelectionHud.hidden=true;imageResizePanel.hidden=false;renderImageResizeInputs(placement,100);
}
function renderImageResizeInputs(placement,scalePercent=null){
  imageResizeUpdating=true;imageWidthInput.value=round(fromMm(placement.spec.width),units==='imperial'?2:0);imageHeightInput.value=round(fromMm(placement.spec.height),units==='imperial'?2:0);
  const percent=scalePercent??Math.round(placement.spec.width/Math.max(1,imageResizeStartWidth)*100);imageScaleInput.value=String(clamp(percent,10,250));imageScaleValue.textContent=`${Math.round(clamp(percent,10,250))}%`;imageResizeUpdating=false;
}
function resizeSelectedImageFromWidth(value){
  if(imageResizeUpdating)return;const placement=imagePlacementById(selectedImageId);if(!placement)return;const aspect=placement.spec.naturalWidth/Math.max(1,placement.spec.naturalHeight);placement.spec.width=clamp(toMm(value),5,5000);placement.spec.height=placement.spec.width/aspect;const info=resolveImagePlacementFaceInfo(placement);if(info)applyImagePlacementGeometry(placement,info.face,info.anchor,info.sideFactor);renderImageResizeInputs(placement);void renderPlacedImages();renderImageSelection();
}
function resizeSelectedImageFromHeight(value){
  if(imageResizeUpdating)return;const placement=imagePlacementById(selectedImageId);if(!placement)return;const aspect=placement.spec.naturalWidth/Math.max(1,placement.spec.naturalHeight);placement.spec.height=clamp(toMm(value),5,5000);placement.spec.width=placement.spec.height*aspect;const info=resolveImagePlacementFaceInfo(placement);if(info)applyImagePlacementGeometry(placement,info.face,info.anchor,info.sideFactor);renderImageResizeInputs(placement);void renderPlacedImages();renderImageSelection();
}
function resizeSelectedImageFromScale(value){
  if(imageResizeUpdating)return;const placement=imagePlacementById(selectedImageId);if(!placement)return;const scale=clamp(value,10,250)/100;placement.spec.width=imageResizeStartWidth*scale;placement.spec.height=imageResizeStartHeight*scale;const info=resolveImagePlacementFaceInfo(placement);if(info)applyImagePlacementGeometry(placement,info.face,info.anchor,info.sideFactor);renderImageResizeInputs(placement,scale*100);void renderPlacedImages();renderImageSelection();
}
function finishImageResize(){if(!selectedImageId)return;imageResizePanel.hidden=true;imageResizeOriginal=null;renderImageSelection();markConfigurationDirty();}
function cancelImageResize(){const placement=imagePlacementById(selectedImageId);if(placement&&imageResizeOriginal){placement.spec.width=imageResizeOriginal.width;placement.spec.height=imageResizeOriginal.height;const info=resolveImagePlacementFaceInfo(placement);if(info)applyImagePlacementGeometry(placement,info.face,info.anchor,info.sideFactor);}imageResizePanel.hidden=true;imageResizeOriginal=null;void renderPlacedImages();renderImageSelection();}

function makeColoredSurfaceMesh(face, sideFactor) {
  const width=face.u2-face.u1,height=face.v2-face.v1;
  const geometry=new THREE.PlaneGeometry(width,height);
  const material=new THREE.MeshStandardMaterial({color:resolvedSurfaceColor(face,sideFactor),roughness:.84,metalness:0,side:sideFactor>=0?THREE.FrontSide:THREE.BackSide});
  const mesh=new THREE.Mesh(geometry,material);const normal=faceNormal(face);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
  const center=faceCenter(face);if(isLidLiftActive()&&isTopFace(face))center.y+=LID_LIFT_MM;mesh.position.copy(center);mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData.cardboxSurface=true;mesh.userData.face=face;mesh.userData.faceKey=faceKey(face);mesh.userData.vertical=isVerticalFace(face);mesh.userData.top=isTopFace(face);mesh.userData.bottom=isBottomFace(face);mesh.userData.surfaceSideFactor=sideFactor;
  if(selectedFaceSnapshot&&faceKey(face)===selectedFaceKey&&selectedFaceSideFactor===sideFactor&&selectedFaceHighlightVisible(face))addSelectionMarkers(mesh,face);
  return mesh;
}
function applyFeaturesAndSurfaceColours() {
  ensurePackagingState();ensureDecorationState();clearGroup(packagingFeatureGroup);
  for(const mesh of surfaceMeshes){
    const face=mesh.userData?.face;if(!face||!mesh.geometry)continue;const sideFactor=Number(mesh.userData.surfaceSideFactor)||1;if(mesh.material?.color)mesh.material.color.set(resolvedSurfaceColor(face,sideFactor));
    const width=face.u2-face.u1,height=face.v2-face.v1;const features=packagingFeatureHoles(face,width,height);if(!features.length)continue;
    const shape=new THREE.Shape();shape.moveTo(-width/2,-height/2);shape.lineTo(width/2,-height/2);shape.lineTo(width/2,height/2);shape.lineTo(-width/2,height/2);shape.closePath();features.forEach((item)=>shape.holes.push(item.path));mesh.geometry.dispose?.();mesh.geometry=new THREE.ShapeGeometry(shape);
    if(sideFactor<0)continue;
    for(const item of features.filter((entry)=>entry.reinforced)){const curve=new THREE.EllipseCurve(item.cx,item.cy,item.width/2+5,item.height/2+5,0,Math.PI*2,false,0);const points=curve.getPoints(40).map((p)=>new THREE.Vector3(p.x,p.y,1));const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x7a542f,transparent:true,opacity:.75}));mesh.add(line);}
  }
}
rebuildSurfaceMeshes = function rebuildSurfaceMeshesWithInsideOutsideColoursAndImages() {
  ensureDecorationState();clearGroup(boxGroup);surfaceMeshes=[];const metrics=calculateUnionMetrics(currentBoxes());surfaceDescriptors=metrics.faces;dimensionAnchors=[];
  for(const face of surfaceDescriptors){
    const outer=makeColoredSurfaceMesh(face,1);const inner=makeColoredSurfaceMesh(face,-1);boxGroup.add(outer);boxGroup.add(inner);surfaceMeshes.push(outer,inner);
    const highlighted=selectedFaceHighlightVisible(face);
    if(technicalEdgesVisible||highlighted){const edgeMaterial=new THREE.LineBasicMaterial({color:highlighted?0x0e82d8:0x755335,transparent:true,opacity:highlighted?.95:.38,depthTest:!highlighted});const edges=new THREE.LineSegments(new THREE.EdgesGeometry(outer.geometry),edgeMaterial);edges.renderOrder=highlighted?4:0;outer.add(edges);}
    if(isVerticalFace(face)){const anchor=faceCenter(face);anchor.y=face.v2+24;dimensionAnchors.push({point:anchor,label:displayLength(faceHorizontalWidth(face))});}
  }
  applyFeaturesAndSurfaceColours();packagingRenderClosureVisuals();
  const topVisible=state.closures?.top!=='open',bottomVisible=state.closures?.bottom!=='open';
  surfaceMeshes.forEach((mesh)=>{if(mesh.userData.top)mesh.visible=topVisible;if(mesh.userData.bottom)mesh.visible=bottomVisible;});
  renderPlacedTexts();void renderPlacedImages();renderDimensions();fitControlsTarget();
};

const decorationLegacySelectedFaceHighlightVisible = selectedFaceHighlightVisible;
selectedFaceHighlightVisible = function selectedFaceHighlightVisibleWithPanels(face) {
  return Boolean(selectedFaceSnapshot)&&faceKey(face)===selectedFaceKey&&textEditorPanel.hidden&&faceColorPanel.hidden&&imageResizePanel.hidden&&!addMode&&!placementMode&&!imagePlacementMode;
};
renderFacePopup = function renderFacePopupWithDecorationActions() {
  if(!selectedFaceSnapshot||addMode||placementMode||imagePlacementMode||!textEditorPanel.hidden||!faceColorPanel.hidden||!imageResizePanel.hidden||selectedTextId||selectedImageId){faceActionPopup.hidden=true;return;}
  faceActionPopup.hidden=false;updateFacePopupPosition();
};
const decorationLegacySelectFace = selectFace;
selectFace = function selectAnyDecoratableFace(face,sideFactor=1){
  if(selectedTextId)deselectTextPlacement();if(selectedImageId)deselectImagePlacement();
  const key=faceKey(face);if(selectedFaceKey===key&&selectedFaceSideFactor===(sideFactor>=0?1:-1)){deselectFace();return;}
  selectedFaceKey=key;selectedFaceSnapshot={...face};selectedFaceSideFactor=sideFactor>=0?1:-1;textEditorPanel.hidden=true;faceColorPanel.hidden=true;imageResizePanel.hidden=true;clearEditorPreview();renderAll();
};
deselectFace = function deselectFaceAndDecorationPanels(){selectedFaceKey='';selectedFaceSnapshot=null;selectedFaceSideFactor=1;faceActionPopup.hidden=true;textEditorPanel.hidden=true;faceColorPanel.hidden=true;imageResizePanel.hidden=true;clearEditorPreview();if(!addMode&&!placementMode&&!imagePlacementMode)rebuildSurfaceMeshes();};

const decorationLegacyRenderTranslations = renderTranslations;
renderTranslations = function renderTranslationsWithDecorations(){decorationLegacyRenderTranslations();applyDecorationCopy();if(imagePlacementMode)viewerHint.textContent=decorationT('image.placeHint');};
const decorationLegacyRenderAll = renderAll;
renderAll = function renderAllWithImagesAndColours(){ensureDecorationState();decorationLegacyRenderAll();renderFaceColorPanel();renderImageSelection();};
const decorationLegacyUpdateOverlayPositions = updateOverlayPositions;
updateOverlayPositions = function updateOverlayPositionsWithImageHud(){decorationLegacyUpdateOverlayPositions();if(!imageSelectionHud.hidden&&imageHudAnchor){const rect=canvasHost.getBoundingClientRect();const projected=imageHudAnchor.clone().project(camera);const visible=projected.z>-1&&projected.z<1;imageSelectionHud.style.display=visible?'':'none';if(visible){const rawLeft=(projected.x*.5+.5)*rect.width,rawTop=(-projected.y*.5+.5)*rect.height;const hudWidth=imageSelectionHud.offsetWidth||218,hudHeight=imageSelectionHud.offsetHeight||128;imageSelectionHud.style.left=`${clamp(rawLeft,4,Math.max(4,rect.width-hudWidth-18))}px`;imageSelectionHud.style.top=`${clamp(rawTop,4,Math.max(4,rect.height-hudHeight-18))}px`;}}else imageSelectionHud.style.display='none';};

const decorationLegacyBindControls = bindControls;
bindControls = function bindControlsWithSurfaceColoursAndImages(){
  decorationLegacyBindControls();
  faceColorButton.addEventListener('click',openFaceColorPanel);faceImageButton.addEventListener('click',startImageUpload);backFromColorButton.addEventListener('click',closeFaceColorPanel);
  faceColorPalette.addEventListener('click',(event)=>{const button=event.target.closest('[data-face-color]');if(button)applySelectedFaceColor(button.dataset.faceColor);});
  applyOuterColorButton.addEventListener('click',()=>applySelectedColorToScope('outer'));applyInnerColorButton.addEventListener('click',()=>applySelectedColorToScope('inner'));applyBothColorButton.addEventListener('click',()=>applySelectedColorToScope('both'));
  faceImageInput.addEventListener('change',()=>{const[file]=faceImageInput.files||[];void handleImageUploadFile(file);});faceImageInput.addEventListener('cancel',()=>renderFacePopup());cancelImagePlacementButton.addEventListener('click',()=>exitImagePlacementMode());
  imageResizeButton.addEventListener('click',openImageResizePanel);imageLiftTopButton.addEventListener('click',toggleSelectedImageLidLift);imageDeleteButton.addEventListener('click',deleteSelectedImage);imageDismissButton.addEventListener('click',deselectImagePlacement);
  imageWidthInput.addEventListener('change',()=>resizeSelectedImageFromWidth(imageWidthInput.value));imageHeightInput.addEventListener('change',()=>resizeSelectedImageFromHeight(imageHeightInput.value));imageScaleInput.addEventListener('input',()=>resizeSelectedImageFromScale(imageScaleInput.value));confirmImageResizeButton.addEventListener('click',finishImageResize);cancelImageResizeButton.addEventListener('click',cancelImageResize);
};

const decorationLegacySerializeTextPlacement = serializeTextPlacement;
serializeTextPlacement = function serializeTextPlacementWithVerticalUvs(placement){const result=decorationLegacySerializeTextPlacement(placement);if(result.segments)result.segments=result.segments.map((segment,index)=>({...segment,v0:Number.isFinite(Number(placement.segments?.[index]?.v0))?Number(placement.segments[index].v0):0,v1:Number.isFinite(Number(placement.segments?.[index]?.v1))?Number(placement.segments[index].v1):1}));return result;};
const decorationLegacyRestoreTextPlacement = restoreTextPlacement;
restoreTextPlacement = function restoreTextPlacementWithVerticalUvs(raw){const placement=decorationLegacyRestoreTextPlacement(raw);if(placement.segments)placement.segments=placement.segments.map((segment,index)=>({...segment,v0:Number.isFinite(Number(raw.segments?.[index]?.v0))?Number(raw.segments[index].v0):0,v1:Number.isFinite(Number(raw.segments?.[index]?.v1))?Number(raw.segments[index].v1):1}));return placement;};

const decorationLegacyPackagingSummary = packagingRenderSummaryExtension;
packagingRenderSummaryExtension = function packagingRenderSummaryWithImages(){
  const base=decorationLegacyPackagingSummary();ensureDecorationState();const imageCost=state.imagePlacements.length*.5;const total=base.totalEur+imageCost;
  const count=document.querySelector('#summaryImageCount');if(count)count.textContent=String(state.imagePlacements.length);
  const breakdown=document.querySelector('#priceBreakdown');if(breakdown&&imageCost>0)breakdown.insertAdjacentHTML('beforeend',`<div class="price-row"><span>${packagingEscape(decorationT('summary.imageCost'))}</span><strong>${formatMoney(imageCost)}</strong></div>`);
  summaryTotal.textContent=formatMoney(total);return{totalEur:total};
};
const decorationLegacyCaptureState = captureState;
captureState = function captureDecorationState(){ensureDecorationState();return{...decorationLegacyCaptureState(),version:9,decorationSchemaVersion:1,faceColors:{outer:{...state.faceColors.outer},inner:{...state.faceColors.inner}},imagePlacements:state.imagePlacements.map(serializeImagePlacement)};};
const decorationLegacyRestoreState = restoreState;
restoreState = function restoreDecorationState(snapshot){const source=snapshot?.state&&!snapshot.boxes?snapshot.state:snapshot;const restored=decorationLegacyRestoreState(snapshot);if(!restored)return false;state.faceColors=source?.faceColors&&typeof source.faceColors==='object'?{outer:{...(source.faceColors.outer||{})},inner:{...(source.faceColors.inner||{})}}:{outer:{},inner:{}};state.imagePlacements=Array.isArray(source?.imagePlacements)?source.imagePlacements.map(restoreImagePlacement):[];selectedImageId='';imagePlacementMode=false;imageResizePanel.hidden=true;faceColorPanel.hidden=true;cancelImagePlacementButton.hidden=true;ensureDecorationState();renderAll();return true;};
const decorationLegacyResetConfiguration = resetConfiguration;
resetConfiguration = function resetDecorationState(){decorationLegacyResetConfiguration();state.faceColors={outer:{},inner:{}};state.imagePlacements=[];selectedImageId='';imagePlacementMode=false;imageResizePanel.hidden=true;faceColorPanel.hidden=true;cancelImagePlacementButton.hidden=true;renderAll();return true;};
getPrice = function getDecorationPrice(){const total=packagingRenderSummaryExtension().totalEur;return{amount:total*(CURRENCY_FROM_EUR[currency]||1),currency};};
ensureDecorationState();


/* --------------------------------------------------------------------------
   Cardbox inspection and presentation tools
   -------------------------------------------------------------------------- */

const CARDBOX_TOOL_BOX_LIFT_MM = 500;
const CARDBOX_TOOL_LID_ANGLE = Math.PI * 0.58;
const CARDBOX_TOOL_TWEEN_MS = 420;
const CARDBOX_FOLD_ANIMATION_MS = 3200;
const CARDBOX_FOLD_WATCHDOG_MS = 9000;

const CARDBOX_TOOL_COPY = Object.freeze({
  'en-US': Object.freeze({
    closureTitle: 'Open / close',
    closureHelp: 'Inspect the upper and lower closures independently.',
    upper: 'Upper closure',
    upperHelp: 'Top lid or flaps',
    lower: 'Lower closure',
    lowerHelp: 'Bottom lid or flaps',
    open: 'Open',
    close: 'Close',
    unavailable: 'Not available',
    panelClose: 'Close',
    foldTitle: 'Fold animation in progress',
    foldDetail: 'The configurator is temporarily locked.',
  }),
  'ro-RO': Object.freeze({
    closureTitle: 'Deschide / închide',
    closureHelp: 'Inspectează independent închiderea superioară și cea inferioară.',
    upper: 'Închidere superioară',
    upperHelp: 'Capac sau clapete superioare',
    lower: 'Închidere inferioară',
    lowerHelp: 'Capac sau clapete inferioare',
    open: 'Deschide',
    close: 'Închide',
    unavailable: 'Indisponibil',
    panelClose: 'Închide',
    foldTitle: 'Animația de pliere este în curs',
    foldDetail: 'Configuratorul este blocat temporar.',
  }),
  'de-DE': Object.freeze({
    closureTitle: 'Öffnen / schließen',
    closureHelp: 'Oberen und unteren Verschluss getrennt prüfen.',
    upper: 'Oberer Verschluss',
    upperHelp: 'Oberer Deckel oder Klappen',
    lower: 'Unterer Verschluss',
    lowerHelp: 'Unterer Deckel oder Klappen',
    open: 'Öffnen',
    close: 'Schließen',
    unavailable: 'Nicht verfügbar',
    panelClose: 'Schließen',
    foldTitle: 'Faltanimation läuft',
    foldDetail: 'Der Konfigurator ist vorübergehend gesperrt.',
  }),
});

const boxClosureToolPanel = $('#boxClosureToolPanel');
const closureToolTitle = $('#closureToolTitle');
const closureToolHelp = $('#closureToolHelp');
const topClosureToolLabel = $('#topClosureToolLabel');
const topClosureToolDescription = $('#topClosureToolDescription');
const bottomClosureToolLabel = $('#bottomClosureToolLabel');
const bottomClosureToolDescription = $('#bottomClosureToolDescription');
const topClosureToolState = $('#topClosureToolState');
const bottomClosureToolState = $('#bottomClosureToolState');
const toggleTopClosureButton = $('#toggleTopClosureButton');
const toggleBottomClosureButton = $('#toggleBottomClosureButton');
const closeClosureToolPanelButton = $('#closeClosureToolPanelButton');
const foldAnimationOverlay = $('#foldAnimationOverlay');
const foldAnimationOverlayTitle = $('#foldAnimationOverlayTitle');
const foldAnimationOverlayDetail = $('#foldAnimationOverlayDetail');

let closurePanelOpen = false;
let topClosureProgress = 0;
let bottomClosureProgress = 0;
let boxLiftCurrent = 0;
let boxLiftTarget = 0;
let transparentMode = false;
let artworkVisible = true;
let foldAnimationActive = false;
let interactionLocked = false;
let configuredClosureSignature = '';
let lidTweenToken = 0;
let liftTweenToken = 0;
let foldAnimationFrame = 0;
let foldAnimationWatchdog = 0;
let foldAnimationRestoreState = null;
let foldInertSnapshot = [];

const CARD_BOX_MOVABLE_GROUPS = Object.freeze([
  boxGroup,
  textGroup,
  editorPreviewGroup,
  previewGroup,
  textSelectionGroup,
  imageGroup,
  imagePreviewGroup,
  imageSelectionGroup,
  packagingClosureGroup,
  packagingFeatureGroup,
]);

function cardboxToolCopy() {
  return CARDBOX_TOOL_COPY[locale] || CARDBOX_TOOL_COPY['en-US'];
}

function cardboxToolState() {
  return {
    closurePanelOpen,
    boxLifted: boxLiftTarget > 0.5,
    transparentMode,
    artworkVisible,
    foldAnimationActive,
    interactionLocked,
    topOpen: topClosureProgress > 0.5,
    bottomOpen: bottomClosureProgress > 0.5,
  };
}

function notifyCardboxToolState() {
  window.dispatchEvent(new CustomEvent('cardbox:tool-state', { detail: cardboxToolState() }));
}

function configuredClosureAvailable(which) {
  const value = state.closures?.[which];
  return Boolean(value && value !== 'open');
}

function reconcileConfiguredClosures() {
  const signature = `${state.boxType || ''}|${state.closures?.top || ''}|${state.closures?.bottom || ''}`;
  if (configuredClosureSignature && configuredClosureSignature !== signature && !foldAnimationActive) {
    topClosureProgress = 0;
    bottomClosureProgress = 0;
    lidTweenToken += 1;
  }
  configuredClosureSignature = signature;
  if (!configuredClosureAvailable('top')) topClosureProgress = 0;
  if (!configuredClosureAvailable('bottom')) bottomClosureProgress = 0;
}

function renderClosureToolPanel() {
  const copy = cardboxToolCopy();
  closureToolTitle.textContent = copy.closureTitle;
  closureToolHelp.textContent = copy.closureHelp;
  topClosureToolLabel.textContent = copy.upper;
  topClosureToolDescription.textContent = copy.upperHelp;
  bottomClosureToolLabel.textContent = copy.lower;
  bottomClosureToolDescription.textContent = copy.lowerHelp;
  closeClosureToolPanelButton.textContent = copy.panelClose;
  foldAnimationOverlayTitle.textContent = copy.foldTitle;
  foldAnimationOverlayDetail.textContent = copy.foldDetail;

  const topAvailable = configuredClosureAvailable('top');
  const bottomAvailable = configuredClosureAvailable('bottom');
  const topOpen = topClosureProgress > 0.5;
  const bottomOpen = bottomClosureProgress > 0.5;

  toggleTopClosureButton.disabled = !topAvailable || foldAnimationActive;
  toggleBottomClosureButton.disabled = !bottomAvailable || foldAnimationActive;
  toggleTopClosureButton.setAttribute('aria-disabled', String(toggleTopClosureButton.disabled));
  toggleBottomClosureButton.setAttribute('aria-disabled', String(toggleBottomClosureButton.disabled));
  toggleTopClosureButton.setAttribute('aria-pressed', String(topOpen));
  toggleBottomClosureButton.setAttribute('aria-pressed', String(bottomOpen));
  toggleTopClosureButton.classList.toggle('is-open', topOpen);
  toggleBottomClosureButton.classList.toggle('is-open', bottomOpen);
  topClosureToolState.textContent = !topAvailable ? copy.unavailable : topOpen ? copy.close : copy.open;
  bottomClosureToolState.textContent = !bottomAvailable ? copy.unavailable : bottomOpen ? copy.close : copy.open;
  boxClosureToolPanel.hidden = !closurePanelOpen || foldAnimationActive;
}

function clearInspectionSelections() {
  if (placementMode) exitPlacementMode();
  if (imagePlacementMode) exitImagePlacementMode();
  if (selectedTextId) deselectTextPlacement();
  if (selectedImageId) deselectImagePlacement();
  if (selectedFaceSnapshot) deselectFace();
  textEditorPanel.hidden = true;
  faceColorPanel.hidden = true;
  imageResizePanel.hidden = true;
  clearEditorPreview();
}

function closeToolPanels() {
  if (!closurePanelOpen) return false;
  closurePanelOpen = false;
  renderClosureToolPanel();
  notifyCardboxToolState();
  return true;
}

function toggleClosureToolPanel() {
  if (interactionLocked) return false;
  clearInspectionSelections();
  closurePanelOpen = !closurePanelOpen;
  renderClosureToolPanel();
  notifyCardboxToolState();
  return closurePanelOpen;
}

function toolTopDisplayY() {
  const b = boundsForBoxes(state.boxes);
  return b.maxY + (isLidLiftActive() ? LID_LIFT_MM : 0);
}

function toolBottomDisplayY() {
  return boundsForBoxes(state.boxes).minY;
}

function closurePivot(which) {
  const b = boundsForBoxes(state.boxes);
  const x = (b.minX + b.maxX) / 2;
  if (which === 'top') return new THREE.Vector3(x, toolTopDisplayY(), b.minZ);
  return new THREE.Vector3(x, toolBottomDisplayY(), b.maxZ);
}

function closureQuaternion(which, progress) {
  if (!progress) return new THREE.Quaternion();
  const angle = -CARDBOX_TOOL_LID_ANGLE * clamp(progress, 0, 1);
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
}

function captureToolBaseTransform(object) {
  if (object.userData.cardboxToolBaseTransform) return object.userData.cardboxToolBaseTransform;
  const base = {
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
    scale: object.scale.clone(),
  };
  object.userData.cardboxToolBaseTransform = base;
  return base;
}

function resetToolRenderable(object) {
  const base = captureToolBaseTransform(object);
  object.position.copy(base.position);
  object.quaternion.copy(base.quaternion);
  object.scale.copy(base.scale);
  object.updateMatrix();
}

function baseObjectNormal(object) {
  const base = captureToolBaseTransform(object);
  return new THREE.Vector3(0, 0, 1).applyQuaternion(base.quaternion).normalize();
}

function baseObjectCenter(object) {
  const base = captureToolBaseTransform(object);
  if (!object.geometry) return base.position.clone();
  object.geometry.computeBoundingBox?.();
  const center = object.geometry.boundingBox?.getCenter(new THREE.Vector3()) || new THREE.Vector3();
  center.multiply(base.scale).applyQuaternion(base.quaternion).add(base.position);
  return center;
}

function classifyToolSurface(object) {
  if (object.userData.cardboxToolSurface) return object.userData.cardboxToolSurface;
  if (object.userData.top) return 'top';
  if (object.userData.bottom) return 'bottom';

  const center = baseObjectCenter(object);
  const tolerance = Math.max(18, state.boardThickness * 8);
  const isClosureLine = object.isLine || object.isLineSegments || object.isLineLoop;
  if (isClosureLine) {
    if (Math.abs(center.y - toolTopDisplayY()) <= tolerance) return 'top';
    if (Math.abs(center.y - toolBottomDisplayY()) <= tolerance) return 'bottom';
    return '';
  }

  const normal = baseObjectNormal(object);
  if (Math.abs(normal.y) < 0.78) return '';
  if (Math.abs(center.y - toolTopDisplayY()) <= tolerance) return 'top';
  if (Math.abs(center.y - toolBottomDisplayY()) <= tolerance) return 'bottom';
  return '';
}

function transformToolRenderable(object, which, progress) {
  const base = captureToolBaseTransform(object);
  object.position.copy(base.position);
  object.quaternion.copy(base.quaternion);
  if (!progress) return;
  const pivot = closurePivot(which);
  const rotation = closureQuaternion(which, progress);
  object.position.sub(pivot).applyQuaternion(rotation).add(pivot);
  object.quaternion.premultiply(rotation);
  object.updateMatrix();
}

function hasSurfaceMeshAncestor(object) {
  let parent = object.parent;
  while (parent) {
    if (surfaceMeshes.includes(parent)) return true;
    if (CARD_BOX_MOVABLE_GROUPS.includes(parent)) break;
    parent = parent.parent;
  }
  return false;
}

function toolRenderables() {
  const objects = new Set(surfaceMeshes);
  [textGroup, editorPreviewGroup, previewGroup, imageGroup, imagePreviewGroup, packagingClosureGroup, packagingFeatureGroup].forEach((group) => {
    group.traverse((object) => {
      if (!(object.isMesh || object.isLine || object.isLineSegments || object.isLineLoop)) return;
      if (surfaceMeshes.includes(object) || hasSurfaceMeshAncestor(object)) return;
      objects.add(object);
    });
  });
  return [...objects];
}

function restoreMaterialPresentation(material) {
  if (!material?.userData?.cardboxPresentationBase) return;
  const base = material.userData.cardboxPresentationBase;
  material.transparent = base.transparent;
  material.opacity = base.opacity;
  material.depthWrite = base.depthWrite;
  material.alphaTest = base.alphaTest;
  material.needsUpdate = true;
}

function applyMaterialTransparency(material, opacity = 0.27) {
  if (!material) return;
  if (!material.userData.cardboxPresentationBase) {
    material.userData.cardboxPresentationBase = {
      transparent: material.transparent,
      opacity: material.opacity,
      depthWrite: material.depthWrite,
      alphaTest: material.alphaTest,
    };
  }
  if (!transparentMode) {
    restoreMaterialPresentation(material);
    return;
  }
  material.transparent = true;
  material.opacity = Math.min(Number(material.opacity) || 1, opacity);
  material.depthWrite = false;
  material.alphaTest = 0;
  material.needsUpdate = true;
}

function applyTransparentPresentation() {
  surfaceMeshes.forEach((mesh) => {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => applyMaterialTransparency(material, 0.27));
  });
  packagingClosureGroup.traverse((object) => {
    const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
    materials.forEach((material) => applyMaterialTransparency(material, 0.42));
  });
  packagingFeatureGroup.traverse((object) => {
    const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
    materials.forEach((material) => applyMaterialTransparency(material, 0.55));
  });
}

function applyArtworkVisibility() {
  textGroup.visible = artworkVisible;
  imageGroup.visible = artworkVisible;
  editorPreviewGroup.visible = artworkVisible;
  previewGroup.visible = artworkVisible;
  imagePreviewGroup.visible = artworkVisible;
  textSelectionGroup.visible = artworkVisible;
  imageSelectionGroup.visible = artworkVisible;
  if (!artworkVisible) {
    textSelectionHud.hidden = true;
    imageSelectionHud.hidden = true;
    textGuideLayer.hidden = true;
  } else {
    textGuideLayer.hidden = false;
  }
}

function applyBoxLift() {
  CARD_BOX_MOVABLE_GROUPS.forEach((group) => { group.position.y = boxLiftCurrent; group.updateMatrixWorld(true); });
}

function applyToolVisualState() {
  reconcileConfiguredClosures();
  const topProgress = configuredClosureAvailable('top') ? topClosureProgress : 0;
  const bottomProgress = configuredClosureAvailable('bottom') ? bottomClosureProgress : 0;
  toolRenderables().forEach((object) => {
    resetToolRenderable(object);
    const surface = classifyToolSurface(object);
    object.userData.cardboxToolSurface = surface;
    if (surface === 'top') transformToolRenderable(object, 'top', topProgress);
    else if (surface === 'bottom') transformToolRenderable(object, 'bottom', bottomProgress);
  });
  applyTransparentPresentation();
  applyArtworkVisibility();
  applyBoxLift();
  renderClosureToolPanel();
}

function inverseClosurePoint(point, which) {
  const progress = which === 'top' ? topClosureProgress : bottomClosureProgress;
  if (!progress) return point;
  const pivot = closurePivot(which);
  const inverse = closureQuaternion(which, progress).invert();
  return point.sub(pivot).applyQuaternion(inverse).add(pivot);
}

function modelPointFromToolWorld(point, object) {
  const result = point.clone();
  result.y -= boxLiftCurrent;
  const surface = object?.userData?.cardboxToolSurface || classifyToolSurface(object);
  if (surface === 'top' || surface === 'bottom') inverseClosurePoint(result, surface);
  return result;
}

function easeInOutCubic(value) {
  const t = clamp(value, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function animateClosure(which, target, duration = CARDBOX_TOOL_TWEEN_MS) {
  if (interactionLocked || !configuredClosureAvailable(which)) return Promise.resolve(false);
  const token = ++lidTweenToken;
  const start = which === 'top' ? topClosureProgress : bottomClosureProgress;
  const startedAt = performance.now();
  toggleTopClosureButton.disabled = true;
  toggleBottomClosureButton.disabled = true;

  return new Promise((resolve) => {
    const frame = (now) => {
      if (token !== lidTweenToken || foldAnimationActive) { resolve(false); return; }
      const ratio = Math.min(1, (now - startedAt) / duration);
      const value = start + (target - start) * easeInOutCubic(ratio);
      if (which === 'top') topClosureProgress = value;
      else bottomClosureProgress = value;
      applyToolVisualState();
      if (ratio < 1) requestAnimationFrame(frame);
      else {
        if (which === 'top') topClosureProgress = target;
        else bottomClosureProgress = target;
        applyToolVisualState();
        notifyCardboxToolState();
        resolve(true);
      }
    };
    requestAnimationFrame(frame);
  });
}

function toggleTopClosure() {
  clearInspectionSelections();
  return animateClosure('top', topClosureProgress > 0.5 ? 0 : 1);
}

function toggleBottomClosure() {
  clearInspectionSelections();
  return animateClosure('bottom', bottomClosureProgress > 0.5 ? 0 : 1);
}

function animateBoxLift(target) {
  if (interactionLocked) return Promise.resolve(false);
  const token = ++liftTweenToken;
  const start = boxLiftCurrent;
  const startedAt = performance.now();
  boxLiftTarget = target;
  notifyCardboxToolState();
  return new Promise((resolve) => {
    const frame = (now) => {
      if (token !== liftTweenToken || foldAnimationActive) { resolve(false); return; }
      const ratio = Math.min(1, (now - startedAt) / 360);
      const previous = boxLiftCurrent;
      boxLiftCurrent = start + (target - start) * easeInOutCubic(ratio);
      const delta = boxLiftCurrent - previous;
      controls.target.y += delta;
      camera.position.y += delta * 0.36;
      applyToolVisualState();
      if (ratio < 1) requestAnimationFrame(frame);
      else {
        boxLiftCurrent = target;
        applyToolVisualState();
        notifyCardboxToolState();
        resolve(true);
      }
    };
    requestAnimationFrame(frame);
  });
}

function toggleBoxLift() {
  if (interactionLocked) return false;
  clearInspectionSelections();
  closeToolPanels();
  const target = boxLiftTarget > 0.5 ? 0 : CARDBOX_TOOL_BOX_LIFT_MM;
  void animateBoxLift(target);
  return target > 0;
}

function toggleTransparentMode() {
  if (interactionLocked) return transparentMode;
  clearInspectionSelections();
  closeToolPanels();
  transparentMode = !transparentMode;
  applyToolVisualState();
  notifyCardboxToolState();
  return transparentMode;
}

function toggleArtworkVisibility() {
  if (interactionLocked) return artworkVisible;
  closeToolPanels();
  artworkVisible = !artworkVisible;
  if (!artworkVisible) clearInspectionSelections();
  applyArtworkVisibility();
  notifyCardboxToolState();
  return artworkVisible;
}

function lockFoldInteraction() {
  if (interactionLocked) return;
  interactionLocked = true;
  foldAnimationOverlay.hidden = false;
  foldInertSnapshot = [...document.body.children]
    .filter((element) => element !== foldAnimationOverlay)
    .map((element) => ({ element, inert: Boolean(element.inert), ariaBusy: element.getAttribute('aria-busy') }));
  foldInertSnapshot.forEach(({ element }) => { element.inert = true; element.setAttribute('aria-busy', 'true'); });
  controls.enabled = false;
  document.body.classList.add('cardbox-fold-animation-active');
  notifyCardboxToolState();
}

function unlockFoldInteraction() {
  interactionLocked = false;
  foldAnimationOverlay.hidden = true;
  foldInertSnapshot.forEach(({ element, inert, ariaBusy }) => {
    element.inert = inert;
    if (ariaBusy == null) element.removeAttribute('aria-busy');
    else element.setAttribute('aria-busy', ariaBusy);
  });
  foldInertSnapshot = [];
  controls.enabled = true;
  document.body.classList.remove('cardbox-fold-animation-active');
  notifyCardboxToolState();
}

function cancelFoldAnimation({ restore = true } = {}) {
  if (!foldAnimationActive && !interactionLocked) return false;
  if (foldAnimationFrame) cancelAnimationFrame(foldAnimationFrame);
  if (foldAnimationWatchdog) clearTimeout(foldAnimationWatchdog);
  foldAnimationFrame = 0;
  foldAnimationWatchdog = 0;
  lidTweenToken += 1;
  liftTweenToken += 1;
  if (restore && foldAnimationRestoreState) {
    topClosureProgress = foldAnimationRestoreState.top;
    bottomClosureProgress = foldAnimationRestoreState.bottom;
  }
  foldAnimationRestoreState = null;
  foldAnimationActive = false;
  applyToolVisualState();
  unlockFoldInteraction();
  return true;
}

function playFoldAnimation() {
  if (foldAnimationActive || interactionLocked) return Promise.resolve(false);
  clearInspectionSelections();
  closeToolPanels();
  lidTweenToken += 1;
  liftTweenToken += 1;
  foldAnimationRestoreState = { top: topClosureProgress, bottom: bottomClosureProgress };
  foldAnimationActive = true;
  renderClosureToolPanel();
  lockFoldInteraction();

  const topAvailable = configuredClosureAvailable('top');
  const bottomAvailable = configuredClosureAvailable('bottom');
  const initialTop = topClosureProgress;
  const initialBottom = bottomClosureProgress;
  const startedAt = performance.now();

  foldAnimationWatchdog = window.setTimeout(() => cancelFoldAnimation({ restore: true }), CARDBOX_FOLD_WATCHDOG_MS);

  return new Promise((resolve) => {
    const frame = (now) => {
      if (!foldAnimationActive) { resolve(false); return; }
      try {
        const elapsed = now - startedAt;
        if (elapsed < 700) {
          const p = easeInOutCubic(elapsed / 700);
          topClosureProgress = topAvailable ? initialTop + (1 - initialTop) * p : 0;
          bottomClosureProgress = bottomAvailable ? initialBottom + (1 - initialBottom) * p : 0;
        } else if (elapsed < 1050) {
          topClosureProgress = topAvailable ? 1 : 0;
          bottomClosureProgress = bottomAvailable ? 1 : 0;
        } else if (elapsed < 1850) {
          const p = easeInOutCubic((elapsed - 1050) / 800);
          topClosureProgress = topAvailable ? 1 : 0;
          bottomClosureProgress = bottomAvailable ? 1 - p : 0;
        } else if (elapsed < 2150) {
          topClosureProgress = topAvailable ? 1 : 0;
          bottomClosureProgress = 0;
        } else if (elapsed < CARDBOX_FOLD_ANIMATION_MS) {
          const p = easeInOutCubic((elapsed - 2150) / (CARDBOX_FOLD_ANIMATION_MS - 2150));
          topClosureProgress = topAvailable ? 1 - p : 0;
          bottomClosureProgress = 0;
        } else {
          topClosureProgress = 0;
          bottomClosureProgress = 0;
          foldAnimationActive = false;
          foldAnimationRestoreState = null;
          if (foldAnimationWatchdog) clearTimeout(foldAnimationWatchdog);
          foldAnimationWatchdog = 0;
          foldAnimationFrame = 0;
          applyToolVisualState();
          unlockFoldInteraction();
          resolve(true);
          return;
        }
        applyToolVisualState();
        foldAnimationFrame = requestAnimationFrame(frame);
      } catch (error) {
        console.error('Cardbox fold animation was cancelled.', error);
        cancelFoldAnimation({ restore: true });
        resolve(false);
      }
    };
    foldAnimationFrame = requestAnimationFrame(frame);
  });
}

function resetCardboxToolViewState() {
  lidTweenToken += 1;
  liftTweenToken += 1;
  if (foldAnimationActive || interactionLocked) cancelFoldAnimation({ restore: false });
  closurePanelOpen = false;
  topClosureProgress = 0;
  bottomClosureProgress = 0;
  boxLiftCurrent = 0;
  boxLiftTarget = 0;
  transparentMode = false;
  artworkVisible = true;
  configuredClosureSignature = '';
  CARD_BOX_MOVABLE_GROUPS.forEach((group) => { group.position.y = 0; });
  applyToolVisualState();
  notifyCardboxToolState();
}

closeClosureToolPanelButton.addEventListener('click', closeToolPanels);
toggleTopClosureButton.addEventListener('click', () => { void toggleTopClosure(); });
toggleBottomClosureButton.addEventListener('click', () => { void toggleBottomClosure(); });

window.addEventListener('offline', () => cancelFoldAnimation({ restore: true }));
window.addEventListener('pagehide', () => cancelFoldAnimation({ restore: true }));
window.addEventListener('beforeunload', () => cancelFoldAnimation({ restore: false }));
window.addEventListener('error', () => cancelFoldAnimation({ restore: true }));
window.addEventListener('unhandledrejection', () => cancelFoldAnimation({ restore: true }));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') cancelFoldAnimation({ restore: true });
});

const cardboxToolsLegacyRaycast = raycast;
raycast = function raycastWithInspectionTransforms(event, objects = surfaceMeshes, recursive = false) {
  const result = cardboxToolsLegacyRaycast(event, objects, recursive);
  result.raycaster.ray.origin.y -= boxLiftCurrent;
  if (result.hit?.point) result.hit.point.copy(modelPointFromToolWorld(result.hit.point, result.hit.object));
  return result;
};

const cardboxToolsLegacyFitControlsTarget = fitControlsTarget;
fitControlsTarget = function fitControlsTargetWithBoxLift() {
  cardboxToolsLegacyFitControlsTarget();
  controls.target.y += boxLiftCurrent;
};

const cardboxToolsLegacyCycleCamera = cycleCamera;
cycleCamera = function cycleCameraWithBoxLift() {
  const previousLift = boxLiftCurrent;
  cardboxToolsLegacyCycleCamera();
  camera.position.y += previousLift;
};

const cardboxToolsLegacyUpdateOverlayPositions = updateOverlayPositions;
updateOverlayPositions = function updateOverlayPositionsWithBoxLift() {
  if (!boxLiftCurrent) {
    cardboxToolsLegacyUpdateOverlayPositions();
    return;
  }
  dimensionAnchors.forEach((item) => { item.point.y += boxLiftCurrent; });
  textGuidePoints.forEach((item) => { item.point.y += boxLiftCurrent; });
  if (textHudAnchor) textHudAnchor.y += boxLiftCurrent;
  if (imageHudAnchor) imageHudAnchor.y += boxLiftCurrent;
  try {
    cardboxToolsLegacyUpdateOverlayPositions();
  } finally {
    dimensionAnchors.forEach((item) => { item.point.y -= boxLiftCurrent; });
    textGuidePoints.forEach((item) => { item.point.y -= boxLiftCurrent; });
    if (textHudAnchor) textHudAnchor.y -= boxLiftCurrent;
    if (imageHudAnchor) imageHudAnchor.y -= boxLiftCurrent;
  }
};

const cardboxToolsLegacyRebuildSurfaceMeshes = rebuildSurfaceMeshes;
rebuildSurfaceMeshes = function rebuildSurfaceMeshesWithInspectionTools() {
  cardboxToolsLegacyRebuildSurfaceMeshes();
  applyToolVisualState();
};

const cardboxToolsLegacyRenderPlacedTexts = renderPlacedTexts;
renderPlacedTexts = function renderPlacedTextsWithInspectionTools() {
  cardboxToolsLegacyRenderPlacedTexts();
  applyToolVisualState();
};

const cardboxToolsLegacyRenderPlacedImages = renderPlacedImages;
renderPlacedImages = async function renderPlacedImagesWithInspectionTools() {
  await cardboxToolsLegacyRenderPlacedImages();
  applyToolVisualState();
};

const cardboxToolsLegacyRenderTranslations = renderTranslations;
renderTranslations = function renderTranslationsWithInspectionTools() {
  cardboxToolsLegacyRenderTranslations();
  renderClosureToolPanel();
};

const cardboxToolsLegacyRestoreState = restoreState;
restoreState = function restoreStateAndResetInspectionTools(snapshot) {
  const restored = cardboxToolsLegacyRestoreState(snapshot);
  if (restored) resetCardboxToolViewState();
  return restored;
};

const cardboxToolsLegacyResetConfiguration = resetConfiguration;
resetConfiguration = function resetConfigurationAndInspectionTools() {
  const reset = cardboxToolsLegacyResetConfiguration();
  resetCardboxToolViewState();
  return reset;
};

applyToolVisualState();


window.CARDBOX_CONFIGURATOR_API = {
  captureState,
  restoreState,
  resetConfiguration,
  setUnits,
  setCurrency,
  setLocale,
  setDarkMode,
  toggleDimensions,
  cycleCamera,
  getPrice,
  toggleClosureToolPanel,
  closeToolPanels,
  toggleBoxLift,
  toggleTransparentMode,
  playFoldAnimation,
  cancelFoldAnimation,
  toggleArtworkVisibility,
  getToolState: cardboxToolState,
  syncToolButtons() { notifyCardboxToolState(); },
};

bindAccordions(); bindControls(); renderAll();
window.addEventListener('beforeunload', () => resizeObserver?.disconnect());
