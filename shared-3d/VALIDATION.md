# Shared 3D UV Step 6 validation

Release: `20260909-uv-8` (9 September 2026).

## Authoritative baseline

This release was rebuilt from the user-provided `configurator-360-main(13).zip`; that
archive is authoritative for colleague changes. The uploaded main contained the
accepted Step 7 Pergola-deck update as an inert nested update directory, while the live
root files still referenced PBR release 6. This release restores the accepted Step 7
deck files into their live root locations and then adds Step 6 UV mapping.

The latest Window import-map additions from main are preserved. The new `uv-8` builder
specifier is added to the existing v2 dimension-wrapper route so the colleague's
wrapper remains active instead of being bypassed by the cache-version change.

## Automated validation completed

- `npm run check:shared-3d:uv`: **67/67 passed**. This covers explicit X/Y/Z
  extrusion directions, physical metre scale, cylindrical seams/caps, planar mapping,
  invalid/welded/tangent inputs, clones/cuts, accepted authored UV preservation,
  Window/Pergola product regressions, mesh pooling and live segmented resize.
- Shared core material/renderer/geometry/contact/PBR group: **86/86 passed**.
- Window exact/no-edge full-builder regression: **14/14 passed**.
- Pergola integration: **3/3 passed**.
- Shared geometry integration: **32/32 passed**.
- Targeted default edge-integration case passed; the monolithic edge-integration file
  exceeds this environment's per-command runtime when executed as one process, so it
  is not claimed as a complete current-run result.
- Window's complete `npm run check` chain passed, including catalog, compatibility,
  layout, joint geometry, composition, import-map, i18n and client-module graph.
- Window `prepare:static` passed after the final source merge.
- Pergola syntax and EN/RO/DE i18n checks passed.

## WebGL validation

The shared Window/Pergola browser smoke suite passed under Chromium + WebGL2/SwiftShader
inside Xvfb. Both scenes reported `20260909-uv-8`, linked shader programs, no context
loss, no texture-asset errors, and stable Low/Balanced/High quality transitions. The
Pergola report showed authored/box/cylindrical UV mappings and the accepted PBR deck
asset set `20260909-pbr-deck-7`.

The heavier actual-client PBR browser suite was started after the final merge but did
not complete within this environment's command-time budget, so no new claim is made
for that suite. Earlier Step 6 development renders had already compared the Window
close-up before/after UV mapping and protected non-UV geometry; the current release's
automated product regressions independently protect those buffers/fabrication fields.

## Product invariants

The UV tests hash geometry excluding only the `uv` attribute and verify Window
fabrication output separately. Mapping does not alter positions, normals, indices,
groups, dimensions, placements, joints, quality-selected geometry or saved product
state. The accepted Pergola deck material assets and board geometry are retained.

## Deployment check

After applying the ZIP, run on each page:

```js
WINDOW_VISUALS_API.getDiagnostics()
PERGOLA_VISUALS_API.getDiagnostics()
```

Expect top-level and nested geometry versions `20260909-uv-8`, with a populated
`geometry.uvMapping` report. PBR texture diagnostics should still report
`20260909-pbr-deck-7`. No commits, pushes or deployments were performed here.
