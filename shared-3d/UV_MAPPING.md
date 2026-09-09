# Geometry-owned UV mapping — Step 6

Release: `20260909-uv-8`. Window and Pergola only.

## Purpose

Materials own physical texture tile sizes; geometry owns orientation, metre scale,
and local offsets. This prevents a material from having to guess whether a mesh is
a horizontal window rail, vertical mullion, pergola post, heater rail, or pipe.

One generated UV unit represents one physical metre. Texture repeat remains in the
material library (`repeat = 1 / tileMetres`), so resizing a member changes how many
texture repetitions are visible instead of stretching one image across the new size.

## Mapping modes

- `extrusion`: Window CAD members after CAD-to-metre transforms/cuts. The adapter
  explicitly supplies `x`, `y`, or `z`; final bounding-box proportions are never used
  to infer the extrusion direction.
- `box`: generated rectangular Pergola parts that do not already have an authored
  perimeter unwrap. The Pergola adapter supplies the longitudinal axis.
- `cylindrical`: constant-radius generated pipes. U follows the pipe axis and V is
  physical circumference distance; end caps remain planar.
- `planar`: future flat panels/floors where both in-plane axes are explicitly known.
- `authored`: rounded/eased members and imported/authored surfaces whose existing
  UVs must remain untouched.

Mappings are stored as plain metadata in `geometry.userData.surfaceMapping`. Clones,
splits and clips copy that metadata independently. Projection happens only after the
geometry is in metres and final cuts have been applied. It never changes positions,
normals, indices, groups, product dimensions, materials, or manufacturing data.

## Window adapter

`window-geometry.js` exposes `profileMesh(source, material, grainAxis)`. Window's
builder now declares:

- horizontal frame/sash/divider members → `x`
- vertical frame/sash/divider members → `y`
- detached CAD section samples → `z`

This covers short fillers and cut members where a longest-bounding-box heuristic can
be wrong. Existing CAD source templates remain unprojected until their adapter has
converted them to metres.

The segmented resize optimizer also updates UVs while a topology-preserving drag
preview deforms positions. The update is baseline-relative, restores the exact old UVs
on cancellation, and retires automatically after an exact rebuild. Curved/authored
unwraps intentionally opt out.

## Pergola adapter

Rounded posts, beams, louvers, glazing rails and the accepted deck boards retain their
existing authored perimeter UVs byte-for-byte. Generated rectangular secondary rails
now declare their longitudinal axis explicitly. Round generated pipes use cylindrical
mapping. The accepted Step 7 deck PBR images, roughness and board offsets are retained.

## Extending another configurator

Do not put product direction rules in `MaterialLibrary`. The product adapter should
declare them when it creates/finalizes geometry, for example:

```js
geometry.mesh(buffer, material, {
  uv: true,
  mapping: { mode: 'extrusion', grainAxis: 'x' },
});
```

Use `authored` for imported assets or curved meshes with their own unwrap. Do not
reproject tangent-authored assets unless their tangents are regenerated consistently.

## Diagnostics

`WINDOW_VISUALS_API.getDiagnostics()` and `PERGOLA_VISUALS_API.getDiagnostics()`
should report top-level `version: "20260909-uv-8"`. The nested
`geometry.uvMapping` object reports declared/applied mappings, modes and grain-axis
counts. `textureAssets.version` remains `20260909-pbr-deck-7`.
