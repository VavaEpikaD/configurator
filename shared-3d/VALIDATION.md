# PBR release validation

Release: `20260909-pbr-6` (9 September 2026).

## Authoritative baseline

Original uploaded project + accepted Orders/font, materials, geometry, edge,
corrective-material and Step 5 contact-shading overlays. The entire older Window
directory was then replaced by the user's latest `window-configurator.zip`
before preparing this release.

Latest Window archive SHA-256:
`594c9d71c7340e42c76d4a8a6985f65424d94940da6ecfc1a797f04246407e56`.

The final audit compares the release against that merged baseline, not an older
Window copy. Edited Window client JS differs only by coordinated import/cache
URLs. The existing product geometry, joints, size limits, startup behavior, CAD
assets and manufacturing code are preserved. The only functional Window build
change verifies and copies PBR assets. Existing dependency declarations and
lockfiles are unchanged.

## Automated checks completed

- **178/178 shared tests passed**: 159 existing material/geometry/contact tests
  plus 19 new PBR loading/ownership tests in the same combined run.
- Window's **complete `npm run check` chain passed**, including the latest
  startup, joint-geometry, layout/size-related and browser module-graph checks.
- Window's **`prepare:static` passed**. All eight images exist in the output at
  their module-relative paths and match the checked-in hashes byte for byte.
- A deliberately missing image **fails the build before modifying existing
  output**, verified with an output sentinel and restoration of the source file.
- Pergola's **syntax and English/Romanian/German translation checks passed**.

The new PBR suite covers lazy loading, complete-set installation, individual
map failure, missing assets, timeout, source-image reuse, independent repeats,
Low/detail transitions, clones, disposal during loading, late-result rejection,
retry-loop prevention, actual dimensions, color/data encodings, extension points,
and bounded resource counts after repeated lifecycles.

## Rendered acceptance completed

Actual browser execution used **Chromium 144 + WebGL2/SwiftShader**, under Xvfb
required by this Linux ANGLE/XCB build. This is software rendering, not a device
performance benchmark.

The PBR acceptance test served Window from its **prepared static site**, using
its actual client entry, production CAD data and mesh-reuse wrapper. Account/SEO
entry scripts were omitted in the local test document, and the animation loop
was paused through test-only response instrumentation to obtain fixed cameras.
Product builder code, material code, shader code and CAD assets were not replaced.
Pergola used its actual scene/store and local GLB assets.

Verified:

- Both actual scenes loaded their requested local texture sets successfully.
- Low, Balanced, High and a return to Balanced produced linked shader programs,
  no context loss, no asset failures and stable geometry counts.
- Window Low requested no texture assets; Balanced/High used its two powder
  maps. Pergola Low used one deck color image; Balanced/High used five maps
  (deck plus coating) in the tested configuration.
- Matched Window **overview and handle close-up were pixel-identical** before
  and after asset installation in this test environment (maximum channel delta
  zero). The real fabrication snapshot was also unchanged.
- Pergola matched overview and deck close-ups were rendered and inspected.
  The change is the photographic deck, not a material/lighting retune elsewhere.
- Separate HTTP-404 runs for both actual scenes selected their procedural
  fallback, settled all pending sets and still rendered with linked shaders.
- The existing two-scene browser smoke test passed after awaiting texture sets.
- The existing contact-shading browser suite also passed: flat-surface rejection,
  actual contact changes, light/dark/brown finish checks and quality/lifecycle
  checks on both scenes. Contact shader sources themselves are unchanged.

The current diagnostics report top-level `20260909-pbr-6`, `textureAssets.status`
`ready` and zero failed/pending sets after successful loading. The intentional
failure runs report `fallback`; this is not an unhandled startup failure.

## Verification limits

**Pergola's exact production build was not executed successfully here.**
Its manifest pins Three.js `0.185.1` and Vite `8.1.5`; Vite is not installed in
this environment and registry downloads are unavailable. `npm run build
--prefix pergola-configurator` therefore exits before bundling with
`vite: not found`. Local Pergola tests/renders used the available root Three.js
`0.160.1` (revision 160). Neither the declarations nor lockfiles were changed.
The final Vite/pinned-engine build remains a check in the existing deployment
pipeline; this record does not claim it passed.

Window used its actual vendored revision-160 engine. No live site was deployed
or inspected after deployment. No account, cart, authentication, backend, AR
upload or cross-domain user session was exercised by these local rendering tests.
No commits or pushes were performed.

## Package checks

The ZIP contains only changed/new files at project-root-relative paths, plus
`commit_message.md` at the root. It excludes node_modules, generated build
outputs, source font files and unrelated configurators. `RELEASE_PBR6.json`
records each packaged file's SHA-256 and previous-file SHA-256 where applicable.
The release manifest excludes itself from recursive hashing. After applying:

```sh
node shared-3d/tools/check_pbr_release.mjs
```

This checks completeness of this exact release. Later intentional local edits
will correctly produce differences; it is not a permanent production health test.
