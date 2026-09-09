# Performance release validation

Release: `20260909-perf-15`, 9 September 2026.

## Baseline and protected work

The clean baseline is the user's `configurator-360-main(13).zip` plus delivered
UV Step 6, both subsequent deck-UV fixes, the handle update and restore, the glass
Step 8 package, and contact Step 9. No unrelated root files, customer CAD/model
assets, runtime dependency declarations or lockfiles are replaced.

The delivered Window builder change is confined to pose-loop bookkeeping,
allocation-free equivalent transforms, tiny final interpolation snapping and
avoiding unchanged DOM writes. Its 128-segment repaired handle neck, plate, lever,
CAD construction, joints and fabrication logic are retained. The dimension
wrapper remains active via the new import-map alias and versioned base import.

The shared preset definitions, material library, all PBR images and manifests,
profile geometry/UV algorithms, Pergola builder/accessories, deck mapping choices,
normal/roughness values, glass material and reflection probes are byte-identical
to that baseline. Render-performance budgets only differ temporarily during slow
motion; selected/settled quality profiles themselves are unchanged.

## Automated checks

**221 tests passed** in the combined targeted run, no failures or skips:

```sh
node --no-warnings --experimental-vm-modules --test \
  shared-3d/tests/material-library.mjs \
  shared-3d/tests/renderer-quality.mjs \
  shared-3d/tests/geometry-library.mjs \
  shared-3d/tests/contact-shading.mjs \
  shared-3d/tests/pbr-textures.mjs \
  shared-3d/tests/uv-mapping.mjs \
  shared-3d/tests/render-performance.mjs \
  shared-3d/tests/contact-preservation.mjs \
  shared-3d/tests/geometry-integration.mjs \
  shared-3d/tests/pergola-integration.mjs
```

The dedicated performance/contact command runs 60 of those tests, not an
additional 60. Coverage includes invalidation, static shadows, camera damping,
material/texture/geometry updates, slow/fast motion, resolution restoration,
quality transitions, context/visibility handling, AO target reuse and one-time
framebuffer checks. Existing preservation fixtures cover 13 Window assemblies
and 28 Pergola configurations; synthetic Window fixtures do not replace actual
CAD browser validation.

Window's full `npm run check --prefix window-configurator` passed, including the
actual client import/module graph. Window static preparation passed. Pergola's
syntax and EN/RO/DE translation checks passed.

## Actual rendered checks

The browser harness runs the actual Window entry and local CAD assets, without
account/network side effects, plus Pergola's actual scene and local assets. It
uses the host render loops for idle behavior. No product geometry is replaced
with demonstration primitives in this harness.

Both Balanced and High: all shader programs linked, no lost context in the
accepted runs, textures loaded, all three Window handle meshes remained present,
and the Window fabrication snapshot was unchanged. Material-color changes,
visibility changes and real configuration rebuilds produced new draws rather
than leaving a stale image.

Measured complete-frame draw submissions at unchanged full resolution:

| Scene | Tier | Previous idle | Updated idle | Previous orbit | Updated orbit |
| --- | --- | ---: | ---: | ---: | ---: |
| Window | Balanced | 304 | 0 | 304 | 235 |
| Window | High | 304 | 0 | 304 | 235 |
| Pergola | Balanced | 330 | 0 | 330 | 246 |
| Pergola | High | 330 | 0 | 330 | 246 |

These are approximately 23% and 25% fewer submitted draw calls during camera
motion for the tested configurations, before adaptive resolution is used. They
are not percentages of FPS improvement. Idle scene inspection/input handling and
browser compositing still execute; zero model draws is not zero CPU/GPU activity.

Matched 800x600, pixel-ratio-1 before/after images were inspected. Window Balanced
and High were pixel-identical. Pergola Balanced was pixel-identical; High differed
at 29 pixels by at most 1 channel level out of 255 due to AO arithmetic rounding.
This is a test-environment comparison, not a guarantee of identical pixels on
all drivers and device resolutions.

An additional actual-client exercise uses a 400x300 viewport with selected High
pixel ratio 2 and controlled slow-motion timestamps. Both clients stepped
1 -> 0.82 -> 0.66, then restored pixel ratio 2 after settling, with unchanged live
geometry counts. Same-size resize, color/visibility changes and geometry rebuilds
were checked. Controlled timestamps test behavior, not actual hardware FPS.

Machine-readable draw counts, image differences and adaptation evidence are in
`PERFORMANCE_RESULTS.json`. The corresponding repeatable harness is
`tests/performance-browser.mjs`:

```sh
npm run check:shared-3d:performance-browser
# Headful software-WebGL CI when headless WebGL is unavailable:
DISPLAY=:99 HEADFUL_WEBGL=1 node shared-3d/tests/performance-browser.mjs
# Additional high-DPI motion/restore and invalidation checks:
DISPLAY=:99 HEADFUL_WEBGL=1 PERFORMANCE_INTERACTIONS=1 node shared-3d/tests/performance-browser.mjs
```

PERFORMANCE_ROOT can select a baseline checkout. VISUAL_OUTPUT_DIR changes the
output directory. Playwright and a working Chromium installation are required;
CHROMIUM_EXECUTABLE can override `/usr/bin/chromium`. Only local HTTP resources
are permitted by the harness.

## Release integrity

`tools/check_performance_release.mjs` checks SHA-256 hashes of every delivered
file against `RELEASE_PERF15.json` (the manifest excludes its own hash). The final
ZIP is applied over a clean baseline before delivery and Window is built from
that applied tree. No generated dist/node_modules directory is packaged.

```sh
node shared-3d/tools/check_performance_release.mjs
npm run prepare:static --prefix window-configurator
```

## Limits

Pergola's exact pinned Three.js 0.185.1 / Vite 8.1.5 production dependency set was
not available locally; its browser and geometry checks used the available
0.160.1 instead. The declared versions and lockfiles are unchanged. Its normal
production build must run before deployment. Window's actual vendored r160 was
used for Window tests.

Rendering used Chromium/SwiftShader, not a hardware FPS benchmark and not Firefox,
mobile, XR-hardware or deployed-site certification. The environment could not
reliably sustain earlier large high-DPI software-rendering runs; those discarded
runs are not counted as passes. Accepted full-client rendering is at the dimensions
specified above, with separate high-DPI restoration checks. No claim of eliminating
all lag or of running every historical test file is made.

No commits, pushes, deployments or production-account mutations were performed.
