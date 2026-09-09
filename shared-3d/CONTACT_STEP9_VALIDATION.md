# Step 9 release validation

Release: `20260909-contact-14`.

## Baseline

`configurator-360-main(13).zip` with the delivered UV Step 6, deck uniformity/rebalance,
Window handle repair and Step 8 glass updates applied in delivery order. This
patch is not an older replacement of Window or of the whole repository.

Only the shared contact renderer/shaders and coordinated entry/import URLs change
in production. Material/texture definitions, image assets, geometry factories,
Window builder/dimension wrapper and Pergola builder remain byte-identical.

## Automated checks

The combined targeted release run contains **158 passing tests**, no skipped or
failed cases: existing material/renderer/geometry/edge/PBR/UV core tests; **20**
contact-stage tests; and **42** preservation checks against the immediately
preceding accepted baseline (13 Window cases, 28 Pergola cases and material optics).
The Window preservation fixture runs the actual builder with synthetic CAD
sections; it is not an exhaustive test of every customer CAD asset.

Contact tests include filtering without texture feedback, mixed opaque/glass
slots, viewports, quality transitions, resource reuse/disposal, partial allocation
failure, injected filter failure, context restoration and incompatible shader
fallback. They preserve original material/mesh properties.

Window's full `npm run check` chain and static-site build pass. Pergola's syntax
and EN/RO/DE translation checks pass. These do not substitute for its exact
production dependency build.

## Rendered acceptance

`tests/contact-browser.mjs` uses the actual local Window client/CAD inputs and
PergolaScene/store/GLB assets. Its local test document bypasses account/UI entry;
the shader, geometry, materials, renderer and cameras are not replaced. The rig
pauses the render loop and performs matched effect-off/effect-on renders. It checks
flat sloping surfaces, genuine contacts, light/dark/brown coatings, both product
overviews/close-ups, all quality tiers, shader links and framebuffer stability.
Window's complete handle and fabrication snapshot, texture loading and glazing
reflection diagnostics are also checked. Source files are never instrumented on
disk for the browser test.

Rendered validation uses Chromium with software WebGL2 under Xvfb. Window uses
its vendored Three.js r160. Pergola's local test uses the available r160.1 package,
**not its pinned 0.185.1**. The pinned package and Vite 8.1.5 could not be downloaded
in this environment (registry DNS failed); no dependency or lockfile is changed.
The normal Pergola production build and deployed Firefox/mobile verification
remain necessary. These are not phone frame-rate measurements.

## Reproduction

From the repository root, with normal dependencies installed:

```sh
node --no-warnings --experimental-vm-modules --test shared-3d/tests/material-library.mjs shared-3d/tests/renderer-quality.mjs shared-3d/tests/geometry-library.mjs shared-3d/tests/edge-finishes.mjs shared-3d/tests/contact-shading.mjs shared-3d/tests/pbr-textures.mjs shared-3d/tests/uv-mapping.mjs shared-3d/tests/contact-preservation.mjs
npm run check --prefix window-configurator
npm run prepare:static --prefix window-configurator
npm run check --prefix pergola-configurator
node shared-3d/tools/check_contact_release.mjs
```

For browser acceptance, run `node shared-3d/tests/contact-browser.mjs` with a
Playwright Chromium installation. Optional environment variables:
`CONTACT_BROWSER_PRODUCT=window` or `pergola` runs one product; `VISUAL_OUTPUT_DIR`
saves off/on PNGs and the JSON report. `CHROMIUM_EXECUTABLE` selects a browser,
`SOFTWARE_WEBGL=1` enables software flags, and `HEADFUL_WEBGL=1` permits headed
execution under an available X server/Xvfb.

The manifest checks the delivered files, not every unrelated repository file.
Tests, documentation and the exact archive are included in the release audit;
no commits, pushes or deployments are performed by applying this ZIP locally.
