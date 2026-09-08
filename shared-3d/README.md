# Shared 3D — Materials and common geometry foundation

Release: `20260908-corrective-4` (Step 4, built on the accepted materials and geometry foundation)

This is the shared material, quality and geometry foundation for **Window and Pergola only**. Step 4 adds explicit, bounded edge finishes for generated parts and recalibrates powder-coat surface detail. Product adapters share construction, section processing, UV handling and resource lifetime. Window CAD templates and manufactured connections remain exact; its generated handle backplate and lever alone opt into the new bevel factory. See `EDGE_FINISHES.md` for scope, safeguards and visual checks. Fabrication rules, dimensions, finish selections, pricing, saved-configuration schemas and account/cart code are not redesigned.

The library uses the host configurator's Three.js namespace. It neither imports a second Three.js runtime nor upgrades the existing engines: Window retains its vendored r160 engine/mesh-reuse adapter; Pergola retains its package-pinned 0.185.1 dependency. See `VALIDATION.md` for the important distinction between intended engine support and what was actually executable in the delivery environment.

## Common geometry in this update

Each scene's `createSurfaceSystem` now provides `surfaces.geometry`, an engine-injected `GeometryLibrary` with an extensible registry. Boxes, rectangular panels, planes, cylinders and arbitrary profile extrusions share factories; source-section simplification, rounded sections, intermediate scalar cuts, UV/normal/bounds finalization and resource disposal share implementations.

`window-geometry.js` adapts CAD templates, final glass/handle/profile meshes and ownership to Window's existing millimetre-source transforms, capture behavior and mesh pool. `pergolaGeometry.js` adapts metre-authored posts, beams, louvers, side closures, accessories and deck planks. Neither adapter imports the other's product code.

Product layouts, selected profiles, connection/cut-plane decisions, pivots, fabrication calculations and accessory placement remain local. Imported assets, UI/helpers and scene-specific house/tree composition are not forcibly rewritten as manufactured primitives. This is a common construction foundation, not a single universal product model. See `GEOMETRY.md` for extension examples, unit policies, lifecycle and limits.

Quality controls change render/material budgets, **not product tessellation, manufacturing dimensions or clearances**. There is no blanket automatic beveling or quality-dependent geometry simplification. Only explicitly selected, metre-authored parts opt into the new edge tools. The existing Window simplification policy is retained in its adapter; both pilots continue using their original engine versions.

## Included surfaces and integration

| Family | Material ID | Current application |
| --- | --- | --- |
| Powder-coated aluminium | `aluminium.powderCoated` | Window coated finishes and handles; Pergola main frame, louvers, drainage and aluminium privacy slats |
| Bare / anodized aluminium | `aluminium.bare`, `aluminium.anodized` | Window's existing Mill finish and Anodized choices, including independent inside/outside finishes |
| Clear glass | `glass.clear` | Window glazing and Pergola side glazing |
| Wood | `wood.oak` | Pergola's surrounding deck; no wooden-window product option is introduced |

The maps are small, deterministic, original **procedural starter textures**, not scanned oak or manufacturer-measured finish data. Powder coating uses fine normal/roughness variation; exposed/anodized aluminium uses directional surface variation; wood uses color, normal and roughness maps. These providers can later be replaced by appropriately licensed, preloaded image/KTX2 assets without teaching each configurator a new material system.

A generated neutral HDR reflection environment gives surfaces something to reflect. It is shared in design, generated independently in each scene, and prefiltered by PMREM. It does **not** reflect the actual nearby house, tree or moving objects. Existing visible backgrounds and controls remain in place. Both pilots use sRGB output and ACES tone mapping; their existing lights have an initial exposure/intensity adjustment. Pergola's day/night control also dims the environment response.

Finish values and lighting are starting points for visual acceptance, not colorimetric guarantees. A RAL selection is still the same stored selection, but its rendered appearance necessarily responds to light and viewing angle.

## Quality controls now affect rendering

The existing middle-tier identifier and UI label, **Balanced**, are retained. `medium` is accepted as an API alias; old saved preferences do not need migration.

| Setting | Low | Balanced | High |
| --- | --- | --- | --- |
| Device-pixel-ratio ceiling | 1 | 1.5 | 2 |
| Directional shadow map | Disabled | 1024 px | 2048 px |
| Source reflection-probe width | 256 px | 512 px | 1024 px |
| Microscopic normal/roughness maps | Disabled | Enabled | Enabled |
| Glass | Cheaper alpha transparency | Physical transmission | Physical transmission |
| Wood color map | Enabled | Enabled | Enabled |
| Maximum anisotropy | 1 | 4 | 8 |

Actual pixel ratio cannot exceed the device's ratio. Compact viewports cap pixel ratio at 1.5 and shadows at 1024 without silently changing the selected material tier. Anisotropy is also limited by the GPU. Existing Window capture mode deliberately uses Low. These are initial performance budgets, not measured frame-rate guarantees.

Window's existing preference event is now connected to the scene. Pergola's quality handler delegates to the same controller. Changing quality updates existing managed materials, resizes/disposes shadow targets correctly, and changes reflection resolution without rebuilding the product. Repeating an unchanged selection does not allocate another environment.

There is no AO, screen-space reflection, bloom, path tracing, new antialiasing algorithm or additional lighting retune in Step 4. Generated edge finishes are documented separately in `EDGE_FINISHES.md`.

## Ownership and geometry contract

- One `createSurfaceSystem` (including `MaterialLibrary` and `GeometryLibrary`) per scene. Each host keeps ownership of its renderer, scene, camera, controls and product state.
- Each `materials.create()` returns an independent material. Its texture data can be shared with compatible materials in the same library. Tints and opacity are not implicitly shared between products.
- Dispose per-product materials when rebuilding the product. Do not dispose their maps: the library owns those textures and disposes them when the scene ends.
- Use `materials.clone(material)` instead of a raw material clone for managed variants. Otherwise a new clone would not participate in subsequent quality changes.
- `applySurfaceUVs` changes **only UV coordinates**. It does not bevel, move, simplify or alter CAD vertices, normals, indices, mating clearances or product dimensions.
- Projected UV coordinates represent metres; U follows the supplied/longest grain axis. Apply after deformation and before sharing a geometry. Imported millimetre geometry needs `unitScale: 0.001`. Avoid later stretching with `mesh.scale` for a textured part: bake its dimensions or remap it.
- The helper is a box/profile projection, not a general replacement for artist-authored UVs, end-grain mapping or curved-object unwrapping. The new rounded-prism factory supplies a preserved perimeter unwrap; adapters must not overwrite it. Pergola's wood deck is rebuilt as individual boards for this pilot. Its footprint and board-top height stay aligned with the previous platform; product/posts are not moved.

## Adding materials and another configurator

```js
// Import from the correct built/source path for the host configurator.
import { createSurfaceSystem } from './shared-3d/src/index.js?v=4';

const surfaces = createSurfaceSystem(THREE, {
  renderer, scene, shadowLights: [sun], quality: 'balanced',
});

const frameMaterial = surfaces.materials.create('aluminium.powderCoated', {
  color: selectedRalHex,
});
const geometry = surfaces.geometry.create('primitive.box', {
  width: 4, height: 0.16, depth: 0.12,
});
const beam = surfaces.geometry.mesh(geometry, frameMaterial, {
  uv: { grainAxis: 'x' }, castShadow: true, receiveShadow: true,
});
scene.add(beam);

// Subscribe this call to the host's existing quality setting.
surfaces.setQuality('high', { compact: false });

// Product rebuild: dispose that product's geometry/materials, not shared maps.
scene.remove(beam);
beam.geometry.dispose(); // use the actual mesh buffer when a host has a mesh pool
frameMaterial.dispose();

// Whole scene teardown, after its animation/subscriptions have been stopped.
surfaces.dispose();
```

To add a new semantic finish without changing the pilots:

```js
surfaces.materials.register('steel.painted', {
  type: 'standard', color: '#45494b', metalness: 0, roughness: 0.65,
});
const steel = surfaces.materials.create('steel.painted', { color: '#626b5f' });
```

For externally supplied textures, preload them using the host's loader, then register a unique synchronous provider. It can return `color`, `normal` and `roughness` as Three.js textures, or RGBA arrays with a square `size`. The library clones texture descriptors, sets the appropriate color space and repeat, and owns its variants. The original preloaded texture remains owned by its loader/caller. Color and data maps are treated differently; do not bake lighting into the color map.

```js
surfaces.materials.textures.register('walnut-set-1', () => ({
  color: loadedColorTexture,
  normal: loadedNormalTexture,
  roughness: loadedRoughnessTexture,
}));
surfaces.materials.register('wood.walnut', {
  type: 'standard', color: '#ffffff', metalness: 0, roughness: 0.72,
  texture: 'walnut-set-1', tile: [2.4, 0.24], normalStrength: 0.2,
});
```

A future material that needs a genuinely new shader model should extend the library intentionally; this first registry supports `standard` and `glass` types, not arbitrary shader plugins. New presets may be registered once per library, using unique IDs.

## Build and deployment

Apply this update at the **repository root**, over the accepted materials Step 1 update (`configurator_shared_materials_step1_20260908.zip`), which already includes the Orders/font fix. The ZIP contains only changed/new source, validation and documentation files, plus `commit_message.md` at its root. It contains no dependencies, prebuilt site, font files or existing customer content.

Run the existing build/deployment pipeline. Window's static-site preparation now copies `shared-3d/src` into its own built site, so relative imports work under `/window-configurator/` and localized routes. Its Node development server exposes the corresponding workspace folder. Pergola's existing Vite build bundles the shared source directly. The normal deployment workflows already copy these built application directories; no production nginx changes are required for this pipeline.

Window's entry/module URLs are versioned for this release. Subsequent edits to this library require another coordinated cache-version bump for native Window imports; do not rely on changing file contents behind long-lived identical URLs. Vite supplies hashed Pergola bundles during the build.

Useful checks from the repository root, with each application's existing dependencies installed:

```sh
npm run check:shared-3d
npm run check --prefix window-configurator
npm run prepare:static --prefix window-configurator
npm run check --prefix pergola-configurator
npm run build --prefix pergola-configurator
```

To rerun library unit tests specifically with Pergola's installed engine (POSIX shell syntax):

```sh
SURFACE_THREE_MODULE=pergola-configurator/node_modules/three/build/three.module.js \
  node --test shared-3d/tests/material-library.mjs
```

## Visual acceptance after deployment

First confirm the new application is loaded with the read-only console hooks:

```js
// Window page
WINDOW_VISUALS_API.getDiagnostics()
// Pergola page
PERGOLA_VISUALS_API.getDiagnostics()
```

Expect `version: "20260908-corrective-4"`, the selected `quality`, `environment: true`, and `environmentError: null`. `profile` describes the requested budgets; `environmentWidth` reports the actually allocated probe. The result also lists active material IDs and counts. Its `geometry` object reports the geometry-library version, registered types, active buffers by type, and cumulative registrations. `registeredCount` is cumulative; it is not a live-memory count, and neither count includes unadopted imported/context/helper geometry. For a lifecycle check compare `geometryCount` after equivalent settled rebuilds, not cumulative registrations. Neither hook writes configuration/account data.

**Window:** disable the existing square CAD/debug-color toggle beside the aluminium finish controls (or select a finish/color, which already turns it off). Its previous default is deliberately preserved. Compare Mill finish, Anodized and Color coated at the same view; also test separate inside/outside colors, an open sash, glass from both sides, exploded view and several dimension changes. Debug mode is meant to show CAD colors, not the final finish.

**Pergola:** compare frame and louver colors, zoom toward the deck to check long-axis grain, enable side glazing, change width/depth and wall-mounted side, then test the existing day/night and studio controls. Different colors must not leak into another component that uses the same material family.

**Both:** switch Low → Balanced → High → Low without reloading. Check the diagnostics each time, make sure the model remains interactive, and compare one close-up with one full-product view. Test a compact/mobile viewport and portrait/landscape rotation, not only desktop. Save/reopen a configuration and verify selections/pricing, then inspect any capture/AR workflow you use before production acceptance.

For Step 4, expect restrained coating grain at close range and small highlights along explicitly finished edges, without changes to overall dimensions. Pay particular attention to resizing, mixed fixed/opening Window layouts, trans-mullions, exploded view, Pergola side closures and switching between presets. Supplied Window CAD profiles remain exact. See `EDGE_FINISHES.md` for the targeted parts.

Rendered appearance and actual device performance remain acceptance items. Desktop/mobile screenshots, including one metal close-up and one glass/wood view, are the basis for the next tuning pass. Do not interpret the automated tests as visual approval.
