# Shared edge finishes — Step 4

Release: `20260908-corrective-4`. Apply after the accepted materials and geometry updates.

## Visible changes

Powder coating now has broader, two-scale normal/roughness variation instead of relying almost entirely on a sub-pixel grain pattern. Its selected RAL/base color remains untouched. These are still procedural starter maps, not a measured manufacturer finish or dirt/color photograph. Inspect at Balanced or High from a close, oblique angle; Low intentionally removes the fine normal/roughness maps. Fine coatings should not resemble visible wood grain from across the scene.

Pergola explicitly opts its generated aluminium posts, beams, louvers, trim, privacy slats and glazing rails into small longitudinal edge radii. The wood deck boards have a small edge easing; the underlying platform remains exact. Window opts in only the generated handle backplate and lever. Its handle neck, supplied CAD profile sections, narrow channels, sockets, seals, glass, joints and fabrication logic remain exact. Imported GLB assets keep their authored geometry.

This is **not** automatic rounding of every mesh or every Window frame edge. A later CAD-specific finishing pass must identify eligible visible edges without rounding mating faces and manufacturing cut planes.

## Two shared geometry tools

### `profile.roundedRectangle`

A rectangular cross-section with filleted corners, extruded along an explicit axis. The original box's six bounding planes are retained and its longitudinal end cuts stay flat. Rounding the whole box, including its cut ends, would visually shorten a member and open unintended gaps at joints.

Dimensions and radii are metres. `axis` can be `x`, `y`, `z` or `auto` (longest dimension). The radius is capped at 20% of each transverse dimension, leaving flat faces on thin parts. Metadata records requested/effective radii. Side UVs unwrap by real perimeter distance: U follows length, V follows the section. Caps use separate flat normals and planar UVs. Do not overwrite this mapping with a normal-based box projection.

Long side strips are subdivided at approximately 0.75 m, with a maximum of 64 length segments. This fixed budget reduces long, thin rasterization triangles; local software-render tests exposed deck geometry showing through a post before this subdivision was added. It is not a guarantee for every GPU. The segment count is independent of Low/Balanced/High.

### `profile.beveledSolid`

A guarded end-bevel extrusion for **intentionally authored, convex solid shapes in metres**, such as a handle backplate. Its extrusion depth is shortened internally, the bevel is inset, and the result is translated back to the original end planes. The widest ring stays on the original contour rather than enlarging the product envelope.

Shapes with holes, concave outlines, path extrusions or custom UV generators keep their original un-bevelled extrusion. Narrow shapes get a conservative radius cap based on an interior-point clearance, depth and XY extent. Both new factories reject `units: 'source'`; neither is suitable for Window's mixed-coordinate CAD templates. The primitive `profile.extrusion` remains unchanged and exact by default.

Normals are smoothed only across the intended small bevel rings; cap normals and large creases stay hard. UVs are projected before that smoothing. Source shapes and settings are not mutated.

## Explicit semantic policy

| Preset | Nominal radius | Quarter-arc/bevel segments |
| --- | --- | --- |
| `aluminium.frame` | 1.2 mm | 2 |
| `aluminium.louver` | 0.6 mm | 2 |
| `aluminium.trim` | 0.4 mm | 2 |
| `aluminium.handle` | 0.6 mm | 3 |
| `wood.deck` | 1.0 mm | 2 |

These are visual defaults, **not manufacturing/tooling specifications**. Analytic normals smooth the low-segment fillets. Factory callers can supply other validated radii/segment budgets for future product families, or add a semantic preset centrally. Do not infer an edge policy merely from a mesh's color/material: glass and CAD can share rendering infrastructure without sharing a geometry policy.

```js
import { getEdgeFinish } from './shared-3d/src/index.js?v=4';

const buffer = surfaces.geometry.create('profile.roundedRectangle', {
  width: 4, height: 0.16, depth: 0.12, axis: 'x',
  ...getEdgeFinish('aluminium.frame'),
});
// Preserve the factory's metre-space perimeter UVs: do not pass a new uv projection.
const beam = surfaces.geometry.mesh(buffer, frameMaterial, {
  castShadow: true, receiveShadow: true,
});
scene.add(beam);
```

Window and Pergola adapters honor `buffer.userData.surfaceUV.preserve` for these new outputs. The shared library still returns independent geometry, respects Window mesh pooling and owns only explicitly registered resources. Geometry, pivots and texture scale do not change with the quality tier.

`new GeometryLibrary(THREE, { edgeDetails: false })` is an explicit acceptance-test/exact-geometry switch. It is not wired to quality, saved product state or a new UI toggle. To roll back visibly, restore the prior overlay or change the scene's construction policy deliberately; do not silently remove physical edges when switching quality.

## Diagnostics

```js
PERGOLA_VISUALS_API.getDiagnostics()
WINDOW_VISUALS_API.getDiagnostics()
```

Both should report version `20260908-corrective-4`. New information includes:

- `geometry.edgeDetails` and `geometry.edgeFinishes`, counts of active shared generated edge methods, not all imported scene meshes.
- `surfaceDetailEnabled` and `surfaceDetails['aluminium.powderCoated']`: managed material counts with normal/roughness/color maps and the preset's metre tile size. These count materials, not meshes; Low should show zero fine-map assignments.
- `environment`, `environmentError`, quality and engine revision remain available.

An assigned normal map is **not proof of pleasing visuals**. Check texture scale, highlights and junctions in a rendered scene as well as these counters.

## Checks after deployment

Use Balanced first, then High and Low. In Window, turn off CAD/debug colors. Inspect a coated profile and the handle from an oblique close view; frame CAD and opening/exploded behavior should remain unchanged. In Pergola, inspect a post, beam junction, louvers and privacy slats, then change sizes, attachment and side closures. The deck's top height and product footprint should not move.

Coating detail should be visible up close, restrained at the default distance and absent in Low. Bevels remain in every tier. Inspect for bright spikes, stretched grain, openings in caps or visible changes in member lengths. Test on a phone as well as desktop; this update does not claim a measured mobile frame rate.

## Automated checks

```sh
npm run check:shared-3d
npm run check --prefix window-configurator
npm run prepare:static --prefix window-configurator
npm run check --prefix pergola-configurator
npm run build --prefix pergola-configurator
```

The additional browser smoke test requires Playwright and a Chromium installation. It only serves local project files and blocks external requests. Window uses its real vendored engine/mesh wrapper with shared material and generated-edge components, **not the full Window interface**. Pergola uses the real `PergolaScene`, store and local assets, with the engine resolved from its installed dependency tree. The test prints that revision so a fallback/hoisted version cannot be mistaken for the production version.

```sh
npm run check:shared-3d:browser

# Optional Linux software-render CI, after starting Xvfb where required:
CHROMIUM_EXECUTABLE=/usr/bin/chromium SOFTWARE_WEBGL=1 DISPLAY=:99 \
  VISUAL_OUTPUT_DIR=/tmp/shared-3d-visuals npm run check:shared-3d:browser
```

The optional `--no-sandbox` software mode is for isolated CI, not application deployment. Keep it off for normal browser testing. The smoke test checks shader program linking, context health, environment success, local-asset errors, texture tier changes and stable geometry count through Low/Balanced/High. Optional PNGs are local output, not runtime assets or pixel-golden tests. See `VALIDATION.md` for what actually ran for this release.
