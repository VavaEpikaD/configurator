# Contact shading / ambient occlusion — original plan Step 9

Release: `20260909-contact-14`. Window and Pergola only.

This completes/refines the shared contact stage introduced in the earlier Step 5
release. It does **not** install a second AO system on top of that stage.

## Appearance and scope

Contacts are sampled at two world-space radii within the existing sample budget:
Window uses 16/40 mm, Pergola 56/140 mm. The close samples serve narrow profile
recesses and accessory contacts; the wider samples serve base/floor and member
junctions. Maximum indirect-light reduction remains 0.35 and intensity remains
0.65. This is not a change to exposure, texture contrast or sun brightness.

The solid-depth buffer guides a spatial 3x3 bilateral filter. It uses distance
from the local surface plane to smooth the sampling pattern on oblique surfaces
while rejecting unrelated depth layers. A depth-aware upsample combines the
result into the existing material shader. Geometry normals and texture maps are
not edited to create this effect.

Only indirect diffuse/specular lighting is modulated. Direct lights, emissive
output, tone mapping, backgrounds and UI remain owned by the original beauty
render. Existing baked AO inputs are preserved. This is screen-space indirect
occlusion, **not** ray tracing, a complete GTAO implementation, global illumination,
or a glass shadow/caustics solution. Off-screen/hidden geometry cannot contribute.

## Pipeline and quality

| Quality | Auxiliary stages | Resolution budget | AO samples |
| --- | --- | --- | --- |
| Low | None; hooks/buffers released | None | 0 |
| Balanced | Solid depth → AO → depth-guided filter | 0.5 of drawing-buffer dimensions, max long side 960 | 12 |
| High | Same three stages | 0.75, max long side 1440 | 20 |

Compact layouts cap the long side at 720. These remain the existing quality
budgets. The filter adds one RGBA8 target; active target count changes from two
to **three**. Three fullscreen/scene auxiliary passes precede the host beauty
render. No temporal history is retained; moving/dragging cannot leave stale AO
history. This release is not a mobile performance benchmark.

The host remains responsible for calling `surfaceSystem.render(camera)` exactly
once in its ordinary rendering loop. Window's AR/capture mode, WebXR, unsupported
contexts, custom render targets, scissored/partial viewports and override-material
passes bypass the effect. Per-frame A/B bypass retains buffers for reuse; Low or
scene teardown releases them.

## Glass, mixed materials and ownership

Standalone transparent/transmissive glazing, sprites, lines, unlit overlays and
hidden objects are not drawn as solid occluders. For a mixed material-array mesh,
only eligible opaque slots are rendered into depth; excluded glass slots use an
invisible, stage-owned placeholder. The exact original array and geometry draw
groups are restored for the beauty render. A mesh with a custom depth shader or
`userData.contactShading === false` keeps the conservative exclusion policy.

Custom material compilation hooks are chained, owned once, and restored when
released. The filter only reads the raw AO target and writes a different target;
there is no texture read/write feedback. Scene/renderer state is restored in a
`finally` block. Failed auxiliary passes, invalid framebuffers and incompatible
lighting hooks release stage-owned resources and fall back to the normal render.
Errors in the host beauty render are not silently swallowed.

## Preserved work

Customer Window CAD files, profiles, joints, opening logic, fabrication output,
geometry-owned UVs, the three-piece repaired handle, and the dimension wrapper
are unchanged. `glass.architectural` and its dedicated reflection environment are
unchanged. Pergola product/accessory geometry, deck board distribution, PBR images,
material calibration, sun/environment and tone mapping are unchanged.

## Diagnostics

Run on the respective page, after a frame has rendered:

```js
WINDOW_VISUALS_API.getDiagnostics()
PERGOLA_VISUALS_API.getDiagnostics()
```

The top-level version and `contactShading.version` are `20260909-contact-14`.
Balanced/High should normally report:

```js
contactShading: {
  active: true,
  status: 'active',
  error: null,
  sampling: 'dual-radius',
  filter: 'depth-guided-bilateral-3x3',
  targetCount: 3,
  auxiliaryPasses: 3
}
```

Low reports `status: 'quality-disabled'`, `targetCount: 0`. Other bypass/fallback
statuses are intentional and are not a reason to force activation. The geometry
version stays `20260909-uv-8`; texture assets stay `20260909-pbr-deck-7`; Window's
glazing reflection version stays `20260909-glass-13`.

See `CONTACT_STEP9_VALIDATION.md` for the release's checks and limitations.
