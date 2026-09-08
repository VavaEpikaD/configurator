# Common geometry foundation — Step 2

Release: `20260908-geometry-2`

## Boundary between shared code and products

The reusable layer lives in `shared-3d/src/geometry`. It does not import a product catalog, a browser global, a renderer, or its own copy of Three.js. The host injects its namespace, including Window's existing `Mesh` reuse wrapper. Window and Pergola do not have to upgrade or share a runtime to use the same geometry algorithms.

| Shared responsibility | Product-specific responsibility |
| --- | --- |
| Box, panel, plane, cylinder and profile-extrusion factories | Which part/profile to build and its dimensions |
| Rounded-section construction and contour simplification algorithm | Per-profile simplification tolerances and CAD interpretation |
| Position-only scalar subdivision and half-space clipping | Where cuts/joints are located and how points are deformed |
| Explicit UV, normal and bounding-volume finalization | Source coordinate transforms and grain direction |
| Independent buffer creation/cloning and lifecycle tracking | Assembly hierarchy, pivots, opening/explosion poses and mesh pooling |
| Selective, deduplicated object-resource disposal | Which assets/materials/textures must survive a product rebuild |

Window's adapter is `window-configurator/src/client/js/window-geometry.js`; Pergola's is `pergola-configurator/src/scene/pergolaGeometry.js`. The scene supplies a single library to the adapter. Pergola passes that adapter explicitly through assembly helpers; there is no module-global active library that can cross-contaminate multiple scenes.

The library provides common **construction**, not common business logic or one universal model. Product layouts, the Window fabrication snapshot, accessory placement, imported assets and scene-specific architectural/organic meshes remain with their owners. No bevel, boolean-solid engine, new CAD parser or automatic quality-dependent decimation is claimed in this release.

## Units and finalization

Manufactured primitives and final product geometry use **metres**. Window's CAD extrusion templates intentionally remain `source` geometry: XY can be millimetres while Z is a unit-depth coordinate. A global scale of 0.001 would corrupt their lengths. Window retains its existing coordinate-by-coordinate transforms and finalizes only after those transforms and cuts have run.

```js
const geometry = surfaces.geometry;
const template = geometry.create('profile.extrusion', {
  shape: selectedSection,
  settings: { depth: 1, bevelEnabled: false, curveSegments: 3, steps: 1 },
}, { units: 'source' });

const part = geometry.clone(template);
// The product adapter now transforms the section and extrusion axis into metres.
transformCadCoordinatesToFinalMetres(part);
geometry.prepare(part, {
  units: 'metres', normals: 'recompute', normalizeNormals: true,
  uv: { grainAxis: 'y' },
});
```

`prepare` preserves authored normals unless recomputation is explicitly requested. It updates bounds and can project UVs, without moving vertices. `mesh` expects a final metre-space buffer. `prepare` rejects a `source` + UV request, but it cannot infer whether a caller actually converted coordinates: that transform remains the adapter's responsibility. `applySurfaceUVs` remains an opt-in box/profile projection, not a replacement for artist UVs or curved-surface unwrapping.

Extrusions retain the caller's sections/holes/settings and do not silently bevel, simplify, center, normalize or rescale them. Creation and cloning return independent buffers so resizing cannot mutate another part. Cap/wall and box face material-slot names are stored in serializable metadata, without overwriting the generated groups.

## Lifetime and pooling

`createSurfaceSystem(...).geometry` owns the scene's registered buffer lifetime. Dispose discarded product geometry on rebuild; the listener removes it from the library's live registry immediately. The scene controller disposes remaining registered resources on teardown. Imported assets not explicitly adopted keep their original owner.

`mesh` uses the injected engine's `Mesh` constructor. Window may replace a just-created candidate with an existing pooled mesh and dispose the candidate. The library tracks the returned mesh's **surviving** geometry. Consumers disposing a final mesh should use `mesh.geometry`, not assume their original candidate is still live. Window's template/mesh pools remain local and authoritative; the shared layer adds no competing geometry cache.

`disposeObjectResources` accepts multiple roots and deduplicates geometry, materials and explicitly owned textures. It deliberately does not call `clear()` or detach objects, since Window uses those hooks for mesh pooling. Materials/textures are opt-in: blindly disposing every map would destroy the shared material library's textures or cached asset maps. Window's generated-sprite and Pergola's compass-map policies remain in their adapters.

## Registered geometry types

| ID | Required dimensions / input | Optional controls |
| --- | --- | --- |
| `primitive.box` | `width`, `height`, `depth` | Axis segment counts |
| `panel.rectangular` | `width`, `height`, `thickness` | None; semantic glazing/panel primitive |
| `primitive.plane` | `width`, `height` | Width/height segments |
| `primitive.cylinder` | `radius` (or top/bottom radii), `height` | Radial/height segments, `openEnded` |
| `profile.extrusion` | `shape` or shape array; `settings.depth` | Existing Three.js extrusion settings |

Dimensions must be finite and positive; cylinder tips may use a zero radius if the other radius is positive. Segment counts are validated. IDs are unique per library; a registration cannot overwrite an existing type.

A future independent primitive can be registered without adding product branches to the library:

```js
surfaces.geometry.register('profile.customSection', (parameters, THREE) => {
  const { section, length } = parameters;
  if (!Number.isFinite(length) || length <= 0) {
    throw new RangeError('length must be positive metres');
  }
  // Custom builders must return a new host-engine BufferGeometry, not a cached
  // shared buffer. They own validation of their custom parameters.
  return new THREE.ExtrudeGeometry(section, {
    depth: length, bevelEnabled: false, steps: 1, curveSegments: 8,
  });
}, { caps: 0, walls: 1 });

const buffer = surfaces.geometry.create('profile.customSection', {
  section: metreAuthoredShape, length: 3.6,
});
const mesh = surfaces.geometry.mesh(buffer, frameMaterial, {
  uv: { grainAxis: 'z' }, castShadow: true, receiveShadow: true,
});
scene.add(mesh);
```

A later bevel pass should be an explicit visual policy with dimensional, socket, joint and fabrication guards. It must not silently replace precise CAD geometry or vary manufacturing output with the quality selector.

## Intermediate cuts are not solid booleans

`splitAtScalarZero` subdivides triangles at a scalar zero without removing either side; `clipToScalarHalfspace` keeps the positive side. They preserve source geometry, triangle ordering and winding, and dispose temporary non-indexed buffers even on failure. Window's prior epsilon behavior is retained.

These routines are intentionally **position-only, uncapped intermediate operations**. They discard normals, UVs and material groups and must be followed by the adapter's deformation/finalization. Do not apply them as a generic CSG replacement or to skinned/morph geometry. Section-based extrusion, not these intermediate cuts, owns caps/walls material grouping.

## Diagnostics and regression fixtures

```js
WINDOW_VISUALS_API.getDiagnostics().geometry
PERGOLA_VISUALS_API.getDiagnostics().geometry
```

The reports include `version`, `geometryCount`, `registeredCount`, `activeTypes` and `registeredTypes`. Live counts cover adopted/shared-generated buffers, not every imported asset or helper in the scene. Cumulative registrations naturally increase during rebuilds; use the live count, after equivalent settled rebuilds, for leak comparisons. Counts can differ when Window retains additional profile templates or when active product options differ.

The committed fixtures were generated from the **accepted materials Step 1 source**, before the geometry extraction. Pergola's 28 cases cover presets, sizes, wall attachment, closures and accessories. Window's 13 cases exercise the actual builder/layout controller with deterministic synthetic CAD sections, including pane thickness, poses, mixed/split layouts, repeated rebuilds and fabrication data. They are not a replacement for testing every production CAD file or GPU rendering. See `VALIDATION.md` for exact execution coverage and environmental limits.
