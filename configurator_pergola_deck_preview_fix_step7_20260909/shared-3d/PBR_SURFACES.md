# PBR surface-set release

Release: `20260909-pbr-deck-7`. Baseline: accepted Step 5 contact shading plus the
latest supplied `window-configurator.zip`. Scope remains Window and Pergola.

## Visible changes and protected behavior

Pergola's deck and its underlying platform use `wood.deck`: local photographic
color, tangent-space normal and roughness maps, with existing per-board UV
offsets. Geometry, board placement and dimensions are unchanged. The existing
procedural `wood.oak` remains available and supplies a startup/failure fallback.

Powder-coat and brushed-aluminium maps have been encoded losslessly from the
accepted procedural pixels. This is not a stronger/coarser coating. The selected
colors, normal strength, physical repeat size, roughness and reflection response
are unchanged. Clear glass, illumination, the HDR probe and contact shaders are
unchanged. No product options, saved-state schema, pricing or fabrication logic
are changed.

Window's uploaded client files are preserved except for coordinated module-URL
versions. Its static-build script now checks and copies `shared-3d/assets`.
Its manufacturing/joint/size-limit/startup logic is not replaced by older code.

## Runtime and extension points

- `textureSets.js`: explicit local asset URLs and Low/detail variants.
- `PBRTextureSets.js`: scene-owned asynchronous source and UV-variant management.
- `MaterialLibrary.js`: materials keep their fallback until the entire matching
  set is ready. This prevents a mismatched combination of old/new maps.
- `presets.js`: semantic surface definitions, separate from any product builder.

Images are requested only when a material needs its texture set. Two materials
with the same texture set/tier/scale share maps, not mutable color or roughness
state. Different scales use separate texture objects and share source images.
Materials, quality changes and scene teardown release their asset leases. Late
results from retired requests are disposed and cannot reattach to a scene.
Image requests may finish at the browser/network layer after being retired;
this implementation invalidates ownership rather than claiming HTTP cancellation.

A failed image, incorrect dimensions or a 15-second timeout selects the complete
procedural/plain fallback. Errors resolve through readiness and diagnostics; they
do not reject the configurator startup. A failed active set is not retried on
every frame. Releasing/reacquiring its tier (or a page reload) permits another
attempt. No account/configuration writes are involved.

### Add a future texture set

Use literal `new URL('../../assets/...', import.meta.url).href` entries in the
manifest module so the bundler can discover the files. Register a detail set;
optionally provide a smaller color-only Low tier. Then register a semantic
material referring to that set. Custom materials can use a procedural fallback
provider, or start with their plain material while assets load.

```js
library.assets.register('wood.example', {
  low: { size: 256, maps: { color: lowColorUrl } },
  detail: { size: 1024, maps: {
    color: colorUrl, normal: normalUrl, roughness: roughnessUrl,
  } },
});
library.register('wood.example', {
  type: 'standard', color: '#ffffff', metalness: 0, roughness: 0.8,
  textureSet: 'wood.example', assetTile: [1.5, 1.5],
  normalStrength: 0.12,
});
const material = library.create('wood.example');
await library.whenTexturesReady(); // success OR a fully selected fallback
```

Do not change the shared map's repeat/offset for one object. Use geometry UVs or
a registered material variant with an explicit physical tile size. This avoids
changing other objects that correctly share those maps. Color is sRGB; normal
and roughness are non-color data. Texture channels remain the existing UV channel.

## Quality budgets

| Tier | Wood | Aluminium surface maps |
| --- | --- | --- |
| Low | 256 color only | Not requested/disabled |
| Balanced | 512 color/normal/roughness | 256 normal/roughness |
| High | Same source maps; higher existing filtering budgets | Same maps; higher filtering |

Balanced-to-High reuses the same texture source sets. Switching to Low releases
detail asset maps and retains only the requested color assets. The accepted
procedural fallback cache is retained at its existing bounded size until scene
disposal. Geometry never changes with texture quality.

## Deploy

Apply the update at the repository root over Step 5 plus the latest Window upload.
Do not apply older Window archives after it. Keep the entire `shared-3d/assets`
directory from this release. Run the ordinary build/deployment pipeline.

```sh
npm run check:shared-3d
npm run check --prefix window-configurator
npm run prepare:static --prefix window-configurator
npm run check --prefix pergola-configurator
npm run build --prefix pergola-configurator
```

Window's build fails before modifying its existing output when the PBR asset
manifest is missing, an image is absent, or a byte/hash check fails. Vite uses
static module-relative asset URLs; it requires no remote asset host or new
plugin. This update changes no dependencies or lockfiles.

## Diagnostics and acceptance

On their respective pages:

```js
WINDOW_VISUALS_API.getDiagnostics()
PERGOLA_VISUALS_API.getDiagnostics()
```

Expect top-level `version: "20260909-pbr-deck-7"`. The `textureAssets` section reports
`enabled`, `status`, `pendingSets`, `failedSets`, source-image/texture counts, and
per-set size/roles/status/consumers. After loading, normal operation reports
`status: "ready"`, `pendingSets: 0`, `failedSets: 0`. During loading a procedural
fallback is expected; failed assets report `status: "fallback"` with the error.

On Low, Window may request no sets at all; Pergola requests its color-only deck
set. On Balanced/High, powder/brushed normal/roughness maps are requested only
for surfaces actually in use. Existing `contactShading` diagnostics remain and
the nested geometry version intentionally remains `20260908-corrective-4`.

Check the deck close-up and an overview, Window coated profiles and handle with
debug colors off, then Low/Balanced/High. Coating and glazing should retain the
accepted appearance. Inspect actual rendered results separately from functional
tests; correct version numbers are not visual approval.

See `VALIDATION.md` for recorded checks and the exact local build limitations.
