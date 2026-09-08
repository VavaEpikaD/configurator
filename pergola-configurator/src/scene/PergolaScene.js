import * as THREE from 'three';
import { createSurfaceSystem, applySurfaceUVs } from '../../../shared-3d/src/index.js?v=1';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { buildPergola } from './buildPergola.js';
import { AssetLibrary, fitAssetToBox } from './AssetLibrary.js';
import { pergolaT } from '../i18n.js';

function disposeObject(object) {
  const geometries = new Set();
  const materials = new Set();
  object.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    for (const item of (Array.isArray(child.material) ? child.material : [child.material])) {
      if (item) materials.add(item);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  // Surface maps are library-owned and may still be used by the deck or the
  // next product rebuild. Only the locally generated compass owns its map.
  materials.forEach((item) => {
    if (item.userData?.ownsCompassMap) item.map?.dispose();
    item.dispose?.();
  });
}

function makeMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.7,
    metalness: options.metalness ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
  });
}


function createCompassTexture(locale, size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  const drawTriangle = (points, fill) => {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  drawTriangle([[cx, cy - size * 0.25], [cx - size * 0.04, cy], [cx, cy + size * 0.038], [cx + size * 0.04, cy]], '#e34f53');
  drawTriangle([[cx + size * 0.25, cy], [cx, cy - size * 0.04], [cx - size * 0.038, cy], [cx, cy + size * 0.04]], '#0b6aa5');
  drawTriangle([[cx, cy + size * 0.25], [cx - size * 0.04, cy], [cx, cy - size * 0.038], [cx + size * 0.04, cy]], '#0b5d97');
  drawTriangle([[cx - size * 0.25, cy], [cx, cy - size * 0.04], [cx + size * 0.038, cy], [cx, cy + size * 0.04]], '#084d7e');
  drawTriangle([[cx, cy - size * 0.07], [cx + size * 0.07, cy], [cx, cy + size * 0.07], [cx - size * 0.07, cy]], '#0661a8');

  const cardinal = [
    [pergolaT(locale, 'compass.north'), 0, -size * 0.34, '#b31d2c'],
    [pergolaT(locale, 'compass.east'), size * 0.34, 0, '#0b6aa5'],
    [pergolaT(locale, 'compass.south'), 0, size * 0.34, '#0b6aa5'],
    [pergolaT(locale, 'compass.west'), -size * 0.34, 0, '#0b6aa5'],
  ];
  cardinal.forEach(([label, dx, dy, fill]) => {
    ctx.fillStyle = fill;
    ctx.font = `bold ${Math.round(size * 0.1)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx + dx, cy + dy);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class PergolaScene {
  constructor(container, store) {
    this.container = container;
    this.store = store;
    this.state = store.get();
    this.lastStructuralSignature = '';
    this.destroyed = false;
    this.assets = new AssetLibrary();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#dfe6e9');
    this.scene.fog = new THREE.Fog('#e7edef', 12, 28);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
    this.camera.position.set(7.8, 5.4, 8.2);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.container.append(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'dimension-layer';
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.inset = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    this.container.append(this.labelRenderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.target.set(0, 1.2, 0);
    this.controls.minDistance = 3.2;
    this.controls.maxDistance = 22;
    this.controls.maxPolarAngle = Math.PI * 0.48;

    this.ambient = new THREE.HemisphereLight('#f5fbff', '#75806f', 1.85);
    this.scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight('#fff3d2', 4.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -11;
    this.sun.shadow.camera.right = 11;
    this.sun.shadow.camera.top = 11;
    this.sun.shadow.camera.bottom = -11;
    this.sun.shadow.camera.near = 0.1;
    this.sun.shadow.camera.far = 35;
    this.sun.shadow.bias = -0.00035;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.surfaceSystem = createSurfaceSystem(THREE, {
      renderer: this.renderer, scene: this.scene, shadowLights: [this.sun], quality: this.state.quality,
    });
    this.visualsApi = Object.freeze({ getDiagnostics: () => this.surfaceSystem.getDiagnostics() });
    window.PERGOLA_VISUALS_API = this.visualsApi;
    this.applyQuality(this.state.quality);

    this.environmentGroup = new THREE.Group();
    this.scene.add(this.environmentGroup);
    this.buildEnvironment();

    this.pergolaGroup = new THREE.Group();
    this.scene.add(this.pergolaGroup);
    this.dimensionGroup = new THREE.Group();
    this.scene.add(this.dimensionGroup);

    this.assets.ready.then(() => {
      if (this.destroyed) return;
      this.buildEnvironment();
      this.rebuildPergola();
      this.lastStructuralSignature = this.structuralSignature(this.state);
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();

    this.unsubscribe = this.store.subscribe((state, meta) => this.update(state, meta));
    this.animate = this.animate.bind(this);
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  buildEnvironment() {
    disposeObject(this.environmentGroup);
    this.environmentGroup.clear();

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      makeMaterial('#cfd8d8', { roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = -0.03;
    ground.name = 'environment-ground';
    this.environmentGroup.add(ground);

    const deckMaterial = this.surfaceSystem.materials.create('wood.oak', { color: '#b8ada0' });
    this.deckPlatform = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 1), deckMaterial);
    this.deckPlatform.position.set(0, -0.01, 0);
    this.deckPlatform.receiveShadow = true;
    this.deckPlatform.castShadow = true;
    this.deckPlatform.name = 'environment-platform';
    this.environmentGroup.add(this.deckPlatform);

    this.deckPlankMaterial = this.surfaceSystem.materials.create('wood.oak');
    this.deckPlankGroup = new THREE.Group();
    this.deckPlankGroup.name = 'environment-platform-planks';
    this.environmentGroup.add(this.deckPlankGroup);
    this.platformSizeSignature = '';
    this.updatePlatformSize();

    this.houseGroup = fitAssetToBox(
      this.assets.clone('house') ?? this.makeHouseFallback(),
      new THREE.Vector3(9.8, 6.15, 4.9),
      { alignY: 'bottom' },
    );
    this.houseGroup.name = 'environment-house';
    this.houseLocalBox = new THREE.Box3().setFromObject(this.houseGroup);
    const houseBody = this.houseGroup.getObjectByName('house_body');
    this.houseBodyLocalBox = houseBody
      ? new THREE.Box3().setFromObject(houseBody)
      : this.houseLocalBox.clone();
    this.houseWindowObjects = [];
    this.houseGroup.traverse((child) => {
      const name = child.name || '';
      if (child.userData?.environmentHouseWindows || /^window(?:_|$)/i.test(name) || /door|handle/i.test(name)) {
        this.houseWindowObjects.push(child);
      }
      if (!child.isMesh) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((mat) => {
        if (!mat) return;
        mat.side = THREE.DoubleSide;
        mat.needsUpdate = true;
      });
    });
    this.houseSideDoorGroup = this.createHouseSideDoor();
    if (this.houseSideDoorGroup) this.houseGroup.add(this.houseSideDoorGroup);
    this.environmentGroup.add(this.houseGroup);

    this.treeGroups = [];
    [
      [-7.9, -1.35, 0.9, 36],
      [8.0, -1.55, 1.1, 82],
      [-8.9, -3.75, 0.74, -14],
    ].forEach(([houseX, houseZ, scale, rotationDeg]) => {
      const tree = fitAssetToBox(
        this.assets.clone('tree') ?? this.makeTreeFallback(),
        new THREE.Vector3(2.7 * scale, 4.7 * scale, 2.7 * scale),
        { alignY: 'bottom' },
      );
      tree.userData.environmentTree = true;
      tree.userData.houseOffset = new THREE.Vector3(houseX, 0, houseZ);
      tree.userData.houseRotationOffset = THREE.MathUtils.degToRad(rotationDeg);
      this.environmentGroup.add(tree);
      this.treeGroups.push(tree);
    });

    const compass = new THREE.Group();
    const compassPlane = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 80),
      new THREE.MeshBasicMaterial({
        map: createCompassTexture(this.state.locale),
        transparent: true,
        alphaTest: 0.02,
        side: THREE.DoubleSide,
      }),
    );
    compassPlane.material.userData.ownsCompassMap = true;
    compassPlane.rotation.x = -Math.PI / 2;
    compass.add(compassPlane);
    compass.name = 'north-compass';
    this.environmentGroup.add(compass);
    this.northCompass = compass;

    this.updateEnvironment();
  }

  makeHouseFallback() {
    const group = new THREE.Group();
    const wallMaterial = makeMaterial('#d7ddd8', { roughness: 0.95 });
    const trimMaterial = makeMaterial('#707981', { roughness: 0.65, metalness: 0.35 });
    const glassMaterial = makeMaterial('#b9d9e4', {
      roughness: 0.06,
      metalness: 0.02,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(9.2, 4.3, 2.4), wallMaterial);
    body.position.y = 2.15;
    group.add(body);

    const roofGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -5.0, 4.3, -1.45,   0.0, 5.9, -1.45,   5.0, 4.3, -1.45,
      -5.0, 4.3, 1.45,    0.0, 5.9, 1.45,    5.0, 4.3, 1.45,
    ]);
    roofGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    roofGeometry.setIndex([
      0, 3, 4,  0, 4, 1,
      1, 4, 5,  1, 5, 2,
      0, 1, 2,  0, 2, 5,  0, 5, 3,
    ]);
    roofGeometry.computeVertexNormals();
    const roof = new THREE.Mesh(roofGeometry, makeMaterial('#c8c7bc', { roughness: 0.92, side: THREE.DoubleSide }));
    group.add(roof);

    const eave = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.08, 2.7), trimMaterial);
    eave.position.set(0, 4.24, 0);
    group.add(eave);

    const windowSet = new THREE.Group();
    windowSet.name = 'environment-house-windows';
    windowSet.userData.environmentHouseWindows = true;
    const spacing = 1.85;
    [-2.75, -0.95, 1.0, 2.8].forEach((x) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.65, 0.08), trimMaterial);
      frame.position.set(x, 2.65, 1.17);
      windowSet.add(frame);
      const pane = new THREE.Mesh(new THREE.BoxGeometry(0.98, 1.48, 0.03), glassMaterial);
      pane.position.set(x, 2.65, 1.22);
      windowSet.add(pane);
    });
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.35, 0.09), trimMaterial);
    doorFrame.position.set(-4.05, 1.63, 1.16);
    windowSet.add(doorFrame);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.92, 2.16, 0.045), makeMaterial('#1b2024', { roughness: 0.55, metalness: 0.2 }));
    door.position.set(-4.05, 1.63, 1.22);
    windowSet.add(door);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.03), makeMaterial('#888e92', { roughness: 0.3, metalness: 0.7 }));
    handle.position.set(-3.78, 1.63, 1.26);
    windowSet.add(handle);
    group.add(windowSet);
    return group;
  }

  makeTreeFallback() {
    const tree = new THREE.Group();
    const trunkMaterial = makeMaterial('#7a6657', { roughness: 1 });
    const foliageMaterial = makeMaterial('#577446', { roughness: 1 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, 2.3, 9), trunkMaterial);
    trunk.position.y = 1.15;
    tree.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), foliageMaterial);
    crown.position.y = 3.0;
    crown.name = 'foliage-fallback';
    tree.add(crown);
    return tree;
  }


  createHouseSideDoor() {
    const bounds = this.houseBodyLocalBox ?? this.houseLocalBox;
    if (!bounds) return null;
    const group = new THREE.Group();
    group.name = 'environment-house-side-door';
    const trimMaterial = makeMaterial('#3a434b', { roughness: 0.58, metalness: 0.3 });
    const doorMaterial = makeMaterial('#1b2024', { roughness: 0.55, metalness: 0.18 });
    const handleMaterial = makeMaterial('#8d9498', { roughness: 0.32, metalness: 0.72 });

    // Use the actual wall face rather than the roof/eave bounding box. The roof
    // overhang is wider than the house body, which previously left this door
    // visibly floating away from the side wall.
    const wallX = bounds.min.x;
    const frameThickness = 0.08;
    const doorThickness = 0.045;
    const frameHeight = 2.35;
    const doorHeight = 2.16;
    const bottomClearance = 0.015;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, frameHeight, 1.08), trimMaterial);
    frame.position.set(wallX - frameThickness / 2 - 0.004, bottomClearance + frameHeight / 2, -0.2);
    group.add(frame);

    const door = new THREE.Mesh(new THREE.BoxGeometry(doorThickness, doorHeight, 0.9), doorMaterial);
    door.position.set(wallX - frameThickness - doorThickness / 2 - 0.006, bottomClearance + 0.045 + doorHeight / 2, -0.2);
    group.add(door);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.05), handleMaterial);
    handle.position.set(wallX - frameThickness - doorThickness - 0.025, 1.05, 0.05);
    group.add(handle);

    return group;
  }

  structuralSignature(state) {
    return JSON.stringify({
      model: state.model,
      installation: state.installation,
      mountedSide: state.mountedSide,
      dimensions: state.dimensions,
      roof: state.roof,
      automation: state.automation,
      poleMounts: state.poleMounts,
      sideSegments: state.sideSegments,
      accessories: state.accessories,
      units: state.units,
    });
  }

  update(state, meta = {}) {
    this.state = state;
    this.applyQuality(state.quality);
    const signature = this.structuralSignature(state);
    if (signature !== this.lastStructuralSignature) {
      this.rebuildPergola();
      this.lastStructuralSignature = signature;
    }

    this.updateEnvironment();
    this.dimensionGroup.visible = Boolean(state.view.dimensionsVisible);

    if (meta.path === 'view.cameraPreset') {
      this.setCameraPreset(state.view.cameraPreset);
    }
  }

  rebuildPergola() {
    if (this.pergola) {
      this.pergolaGroup.remove(this.pergola);
      disposeObject(this.pergola);
    }
    disposeObject(this.dimensionGroup);
    this.dimensionGroup.clear();

    this.pergola = buildPergola(this.state, this.assets, this.surfaceSystem.materials);
    this.pergolaGroup.add(this.pergola);
    this.buildDimensions(this.pergola.userData.dimensions);

    const maxDimension = Math.max(
      this.pergola.userData.dimensions.width,
      this.pergola.userData.dimensions.depth,
    );
    this.controls.maxDistance = Math.max(16, maxDimension * 3);
  }

  createDimensionLine(start, end, label, offset = new THREE.Vector3()) {
    const lineMaterial = new THREE.LineBasicMaterial({ color: '#1e2529' });
    const points = [start.clone(), end.clone()];
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial);
    line.position.copy(offset);
    this.dimensionGroup.add(line);

    const tickLength = 0.16;
    [start, end].forEach((point) => {
      const tick = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(point.x, point.y - tickLength / 2, point.z),
          new THREE.Vector3(point.x, point.y + tickLength / 2, point.z),
        ]),
        lineMaterial,
      );
      tick.position.copy(offset);
      this.dimensionGroup.add(tick);
    });

    const labelElement = document.createElement('span');
    labelElement.className = 'dimension-label';
    labelElement.textContent = label;
    const labelObject = new CSS2DObject(labelElement);
    labelObject.position.copy(start.clone().lerp(end, 0.5).add(offset));
    this.dimensionGroup.add(labelObject);
  }

  buildDimensions({ width, depth, height }) {
    const widthLabel = this.formatLength(width * 1000);
    const depthLabel = this.formatLength(depth * 1000);
    const heightLabel = this.formatLength(height * 1000);

    this.createDimensionLine(
      new THREE.Vector3(-width / 2, 0.13, depth / 2 + 0.42),
      new THREE.Vector3(width / 2, 0.13, depth / 2 + 0.42),
      widthLabel,
    );
    this.createDimensionLine(
      new THREE.Vector3(width / 2 + 0.42, 0.13, -depth / 2),
      new THREE.Vector3(width / 2 + 0.42, 0.13, depth / 2),
      depthLabel,
    );
    this.createDimensionLine(
      new THREE.Vector3(width / 2 + 0.42, 0, -depth / 2 - 0.18),
      new THREE.Vector3(width / 2 + 0.42, height, -depth / 2 - 0.18),
      heightLabel,
    );
  }

  formatLength(mm) {
    if (this.state.units === 'imperial') {
      const inches = mm / 25.4;
      const feet = Math.floor(inches / 12);
      const remaining = Math.round(inches - feet * 12);
      return `${feet}' ${remaining}\"`;
    }
    return `${Math.round(mm)} mm`;
  }

  updatePlatformSize() {
    if (!this.deckPlatform || !this.deckPlankGroup) return;
    const width = this.state.dimensions.width / 1000;
    const depth = this.state.dimensions.depth / 1000;
    const attached = this.state.installation === 'wall-mounted';
    const mountedSide = this.state.mountedSide;
    const margins = { left: 1, right: 1, front: 1, back: 1 };
    if (attached) margins[mountedSide] = 0.02;

    const platformWidth = width + margins.left + margins.right;
    const platformDepth = depth + margins.front + margins.back;
    const platformOffsetX = (margins.right - margins.left) / 2;
    const platformOffsetZ = (margins.front - margins.back) / 2;
    const signature = `${platformWidth.toFixed(3)}x${platformDepth.toFixed(3)}@${platformOffsetX.toFixed(3)},${platformOffsetZ.toFixed(3)}`;
    if (signature === this.platformSizeSignature) return;

    this.deckPlatform.geometry.dispose();
    this.deckPlatform.geometry = applySurfaceUVs(THREE,
      new THREE.BoxGeometry(platformWidth, 0.10, platformDepth), { grainAxis: 'x' });
    this.deckPlatform.scale.set(1, 1, 1);
    // The board tops stay at y=0; posts and feet keep their original placement.
    this.deckPlatform.position.set(platformOffsetX, -0.07, platformOffsetZ);
    this.deckPlankGroup.position.set(platformOffsetX, 0, platformOffsetZ);

    this.deckPlankGroup.children.forEach((child) => child.geometry?.dispose?.());
    this.deckPlankGroup.clear();
    const plankCount = Math.max(2, Math.ceil(platformDepth / 0.16));
    const pitch = platformDepth / plankCount;
    for (let index = 0; index < plankCount; index += 1) {
      const geometry = applySurfaceUVs(THREE,
        new THREE.BoxGeometry(platformWidth, 0.02, Math.max(0.01, pitch - 0.004)),
        { grainAxis: 'x', offset: [(index * 0.731) % 2.4, (index * 0.117) % 0.24] });
      const plank = new THREE.Mesh(geometry, this.deckPlankMaterial);
      plank.position.set(0, -0.01, -platformDepth / 2 + (index + 0.5) * pitch);
      plank.receiveShadow = true;
      this.deckPlankGroup.add(plank);
    }

    this.platformSizeSignature = signature;
  }

  updateEnvironment() {
    this.updatePlatformSize();
    const { sunPosition, northDirection, night, season } = this.state.environment;
    const progress = THREE.MathUtils.clamp(sunPosition, 0, 1);
    const azimuth = THREE.MathUtils.degToRad(-110 + progress * 220 + northDirection);
    const elevation = THREE.MathUtils.degToRad(12 + Math.sin(progress * Math.PI) * 55);
    const radius = 12;

    this.sun.position.set(
      Math.cos(azimuth) * Math.cos(elevation) * radius,
      Math.sin(elevation) * radius,
      Math.sin(azimuth) * Math.cos(elevation) * radius,
    );
    this.sun.target.position.set(0, 0.7, 0);
    this.sun.intensity = night ? 0.18 : 2.5 + Math.sin(progress * Math.PI) * 1.0;
    this.ambient.intensity = night ? 0.28 : 0.5;
    this.ambient.color.set(night ? '#7082a0' : '#f5fbff');
    this.ambient.groundColor.set(night ? '#10151a' : '#75806f');

    const palette = {
      winter: { background: '#dfe6e9', fog: '#e7edef', ground: '#cfd8d8' },
      summer: { background: '#c7dbe5', fog: '#d6e5e9', ground: '#8da878' },
      studio: { background: '#eeeeec', fog: '#f3f3f1', ground: '#deded9' },
    }[season];
    const background = night ? '#0e1620' : palette.background;
    const fogColor = night ? '#131e29' : palette.fog;
    this.scene.background.set(background);
    this.scene.fog.color.set(fogColor);
    const ground = this.environmentGroup.getObjectByName('environment-ground');
    ground?.material?.color.set(night ? '#273039' : palette.ground);
    this.renderer.toneMappingExposure = night ? 0.92 : 1;
    this.surfaceSystem.setEnvironmentIntensity(night ? 0.12 : 1);

    const pergolaHeight = this.state.dimensions.height / 1000;
    if (this.northCompass) {
      const compassVisible = Boolean(this.state.view.compassVisible);
      this.northCompass.visible = compassVisible;
      this.northCompass.rotation.y = THREE.MathUtils.degToRad(-northDirection);
      this.northCompass.position.set(0, pergolaHeight + 0.5, 0);
    }

    this.updateHousePlacement();
    this.updateTreePlacement();
    if (this.houseGroup) this.houseGroup.visible = season !== 'studio';
    const showHouseOpenings = this.state.installation !== 'wall-mounted';
    this.houseWindowObjects?.forEach((object) => { object.visible = showHouseOpenings; });
    if (this.houseSideDoorGroup) this.houseSideDoorGroup.visible = this.state.installation === 'wall-mounted';
    this.treeGroups.forEach((tree) => {
      tree.visible = season !== 'studio';
      tree.traverse((child) => {
        if (!child.isMesh || !/foliage|leaf|crown/i.test(child.name)) return;
        const color = season === 'winter' ? '#aeb5ae' : '#587b48';
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((item) => item?.color?.set(color));
      });
    });
  }

  updateHousePlacement() {
    if (!this.houseGroup) return;
    const width = this.state.dimensions.width / 1000;
    const depth = this.state.dimensions.depth / 1000;
    const attached = this.state.installation === 'wall-mounted';
    const side = attached ? this.state.mountedSide : 'back';
    const clearance = attached ? -0.012 : 2.0;
    // Mount against the actual wall plane, not the roof bounding box. The roof
    // overhang extends ~30 cm past the wall and was the source of the visible gap.
    const frontExtent = this.houseBodyLocalBox?.max?.z ?? this.houseLocalBox?.max?.z ?? 2.1;

    this.houseGroup.rotation.y = 0;
    if (side === 'back') {
      this.houseGroup.position.set(0, 0, -depth / 2 - frontExtent - clearance);
    } else if (side === 'front') {
      this.houseGroup.rotation.y = Math.PI;
      this.houseGroup.position.set(0, 0, depth / 2 + frontExtent + clearance);
    } else if (side === 'left') {
      this.houseGroup.rotation.y = Math.PI / 2;
      this.houseGroup.position.set(-width / 2 - frontExtent - clearance, 0, 0);
    } else {
      this.houseGroup.rotation.y = -Math.PI / 2;
      this.houseGroup.position.set(width / 2 + frontExtent + clearance, 0, 0);
    }
  }


  updateTreePlacement() {
    if (!this.houseGroup || !this.treeGroups?.length) return;

    const houseRotation = this.houseGroup.rotation.y;
    const cos = Math.cos(houseRotation);
    const sin = Math.sin(houseRotation);

    this.treeGroups.forEach((tree) => {
      const offset = tree.userData.houseOffset;
      if (!offset) return;

      const rotatedX = offset.x * cos + offset.z * sin;
      const rotatedZ = -offset.x * sin + offset.z * cos;
      tree.position.set(
        this.houseGroup.position.x + rotatedX,
        0,
        this.houseGroup.position.z + rotatedZ,
      );
      tree.rotation.y = houseRotation + (tree.userData.houseRotationOffset ?? 0);
    });
  }

  setCameraPreset(preset) {
    const { width, depth, height } = this.pergola?.userData.dimensions ?? { width: 5, depth: 3.5, height: 2.7 };
    const distance = Math.max(width, depth) * 1.65;
    const target = new THREE.Vector3(0, height * 0.42, 0);
    const positions = {
      perspective: new THREE.Vector3(distance, height * 1.85, distance),
      front: new THREE.Vector3(0, height * 0.75, distance * 1.25),
      left: new THREE.Vector3(-distance * 1.25, height * 0.75, 0),
      right: new THREE.Vector3(distance * 1.25, height * 0.75, 0),
      top: new THREE.Vector3(0.01, distance * 1.55, 0.01),
    };
    this.camera.position.copy(positions[preset] ?? positions.perspective);
    this.controls.target.copy(target);
    this.controls.update();
  }

  capturePNG() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  applyQuality(quality = 'balanced') {
    const compact = window.innerWidth <= 760 || (window.innerWidth <= 900 && window.innerHeight <= 520);
    this.surfaceSystem?.setQuality(quality, { compact });
  }

  resize() {
    this.applyQuality(this.state.quality);
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.labelRenderer.setSize(width, height);
  }

  animate() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.unsubscribe?.();
    this.controls.dispose();
    this.assets.dispose();
    disposeObject(this.environmentGroup);
    disposeObject(this.pergolaGroup);
    disposeObject(this.dimensionGroup);
    this.surfaceSystem.dispose();
    if (window.PERGOLA_VISUALS_API === this.visualsApi) delete window.PERGOLA_VISUALS_API;
    this.renderer.dispose();
    this.labelRenderer.domElement.remove();
    this.renderer.domElement.remove();
  }
}
