# Shared 3D rendering and geometry

Current release: **`20260909-contact-14`**. Integrated into Window and Pergola only.
Other configurators and their rendering paths are not migrated by this release.

The shared layer receives each application's Three.js namespace. It does not
create an engine singleton, replace the renderer, or import product rules.
Window's vendored engine and Pergola's declared engine remain separate.

## Responsibilities

- `MaterialLibrary`: semantic materials, independent material instances, managed
  clones, procedural fallbacks and local PBR texture-set selection.
- `PBRTextureSets`: asynchronous, atomic asset loading, source-image reuse,
  metre-scale texture variants and lifecycle cleanup.
- `GeometryLibrary`: explicit geometry factories, shape/section helpers,
  dimension-preserving edge finishes, geometry-owned UV mapping and buffer ownership.
- `surfaceMapping`: explicit metre-space box/extrusion/planar/cylindrical mapping,
  with authored-UV preservation and no material mutation.
- `createSurfaceSystem`: common output/tone mapping, quality budgets, reflection
  environment, contact shading and read-only diagnostic data.
- Configurator adapters: product dimensions, CAD transforms, joins, assembly,
  cameras, UI, manufacturing, opening/animation and app-specific lifetime.

The current materials are `aluminium.powderCoated`, `aluminium.bare`,
`aluminium.anodized`, `glass.clear`, Window-specific `glass.architectural`, procedural `wood.oak`, and photographic
`wood.deck`. This is not yet the complete proposed material catalog.

## Release documentation

| Document | Purpose |
| --- | --- |
| [UV_MAPPING.md](UV_MAPPING.md) | Step 6 geometry-owned texture orientation/scale, adapters and live-resize behavior |
| [PBR_SURFACES.md](PBR_SURFACES.md) | Current assets, loader, quality tiers, extension examples, install and diagnostics |
| [assets/pbr/README.md](assets/pbr/README.md) | Texture sources, CC0 provenance, actual resolutions and reproducibility |
| [VALIDATION.md](VALIDATION.md) | Completed checks and exact local verification limits |
| [GEOMETRY.md](GEOMETRY.md) | Shared geometry API, ownership, CAD unit policy and adapters |
| [EDGE_FINISHES.md](EDGE_FINISHES.md) | Opt-in edge methods and protected manufacturing contours |
| [CONTACT_SHADING.md](CONTACT_SHADING.md) | Current Step 9 contact-stage filtering, exclusions and failure handling |
| [CONTACT_STEP9_VALIDATION.md](CONTACT_STEP9_VALIDATION.md) | Current release validation and pinned-engine verification limits |

Geometry/edge/contact documents retain their own feature-version references;
the current top-level system version is the one above. Geometry remains `20260909-uv-8`,
PBR assets remain `20260909-pbr-deck-7`, and the dedicated Window glazing
reflections remain `20260909-glass-13`. This release changes contact rendering,
not the accepted geometry, texture images or material calibration.

## Host integration

```js
import { createSurfaceSystem } from './shared-3d/src/index.js?v=contact-14';

const surfaces = createSurfaceSystem(THREE, {
  renderer, scene, shadowLights: [sun], quality: 'balanced',
});
const paint = surfaces.materials.create('aluminium.powderCoated', {
  color: '#383e42',
});
const postGeometry = surfaces.geometry.create('profile.roundedRectangle', {
  width: 0.15, height: 2.5, depth: 0.15, axis: 'y', radius: 0.001,
});
const post = surfaces.geometry.mesh(postGeometry, paint, {
  castShadow: true, receiveShadow: true,
  // Rounded members already carry authored metre-space perimeter UVs.
});
scene.add(post);
// Within the host's own animation loop:
surfaces.render(camera);
// At host teardown (after detaching its meshes/loop):
// surfaces.dispose();
```

Do not share mutable material instances to share a finish: create/clone managed
materials and let their texture sources be reused. UV scale and grain direction are geometry-owned and explicit. A material defines
its physical tile size; geometry defines which local axis is the extrusion/grain
direction. Geometry quality never changes manufacturing dimensions.

## Tests

From the project root:

```sh
npm run check:shared-3d
npm run check:shared-3d:uv
npm run check:shared-3d:pbr
npm run check:shared-3d:pbr-browser
npm run check:shared-3d:contact-browser
```

Browser checks require Playwright, Chromium with working WebGL, and the installed
Pergola Three.js package. `CHROMIUM_EXECUTABLE` can select a browser;
`SOFTWARE_WEBGL=1` selects SwiftShader. On Linux builds whose ANGLE uses XCB,
run under Xvfb (for example `xvfb-run -a`) even for headless Chromium. This is
only a test-environment requirement, not an application dependency.
