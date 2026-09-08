# Validation — shared contact shading, Step 5

Release: `20260908-contact-5`.

Baseline: the uploaded project with the Orders/font, materials Step 1, geometry Step 2, edge finishes Step 3 and **accepted corrective material/shading** overlays applied in that order. Apply this delivery after `configurator_material_shading_pass_20260908_update.zip`. No commits, pushes or deployments were performed.

## Scope and baseline protection

This release adds the shared contact-rendering stage and connects Window and Pergola to it. The accepted material preset values, procedural surface pixels, HDR generator, geometry factories and edge-finish implementation remain byte-for-byte unchanged. No product-dimension, manufacturing, pricing, save, account, language or menu feature was added. Most changed Window modules beyond `main.js`/`scene.js` contain only cache-version import updates.

The root surface-system diagnostic version is `20260908-contact-5`. The geometry-library version intentionally remains `20260908-corrective-4`: geometry did not change. Do not use equality of those two version strings as an acceptance criterion.

## CPU/unit and integration checks

`npm run check:shared-3d` — **159/159 tests passed**, zero skipped.

The existing 146 tests passed both before and after this change. The original geometric golden fixtures were not regenerated. Existing coverage includes material ownership/quality changes, geometry resource ownership, UVs, cuts, Window mesh pooling, 28 Pergola assembly cases and 13 Window baseline configurations, as well as edge-enabled comparisons and fabrication invariants. The numerical Window fixtures still use deterministic synthetic CAD sections; the new browser checks below additionally load the real production CAD assets.

The 13 new contact-stage tests cover:

- Quality budgets, compact-buffer limits, resolution changes, target reuse and Low-tier release.
- Renderer/scene restoration, original material arrays and visibility, viewport/scissor, clear/background state, targets and shadow-update flags.
- Transparent/glass/overlay/mixed-material exclusions and eligible cutout/displacement/clipping map borrowing without taking ownership of those maps.
- Shader-hook and cache-key chaining, original AO chunk preservation, indirect-light-only composition, material disposal and shared-material ownership guards.
- Rebuild cleanup, special-render bypasses, invalid configuration, failed prepasses/incomplete framebuffer fallback, incompatible shader templates and context loss/restoration.

These tests use the real available Three.js CPU classes and an instrumented mock renderer. Their failure-path coverage is not a claim that every real GPU failure was induced.

`npm run check --prefix window-configurator` — **passed the full existing chain**, including CAD/accessory, layout, fabrication-related, compatibility, import-map, translation and module checks. Its final module-graph check linked 42 modules from 13 entries.

`npm run prepare:static --prefix window-configurator` — **passed**. Generated output is not included in the source-only update.

`npm run check --prefix pergola-configurator` — **passed**, including syntax and translation checks.

## Actual local WebGL rendering

A working Chromium 144 WebGL2 context was obtained using Xvfb and ANGLE/SwiftShader. This is software rendering, **not a representative desktop/mobile performance benchmark**.

`npm run check:shared-3d:browser` — passed both local harnesses through Low, Balanced and High, with linked shaders, no context loss, successful local asset/environment loading and stable tracked geometry counts. The pre-existing Window smoke remains a component harness.

`npm run check:shared-3d:contact-browser` — **passed the new rendered acceptance checks**:

- **Window:** loaded the real client entry point, vendored Three.js/mesh-reuse adapter, actual builder and production CAD SVG/JSON assets. The harness removes non-rendering account/SEO/font/QR/upload-script integrations, supplies deterministic URL inputs and pauses the loop for matched frames. This is not authenticated whole-UI or saved-configuration end-to-end testing.
- **Pergola:** loaded its actual scene, state/store, procedural assembly and local GLB assets. Its available test engine was r160, not its pinned production engine; see below.
- Captured matched contact-off/contact-on overview and close-up images at Balanced quality for light, dark-gray and brown coating test colors: 16 images total. Camera, material, lighting, product and geometry were identical within each pair. Close-up color cycling is a test fixture, not a new handle-color option.
- Verified nonzero, restrained pixel differences, linked shader programs, `status: "active"`, null stage errors and no context loss. Inspected matched renders visually; this does not replace deployed-device approval.
- A sloping flat-plane calibration produced **zero changed pixels**, guarding against false occlusion on an isolated flat surface. Adding a contact box changed 721 pixels, with a maximum channel difference of 9/255 in that fixture. The shader snaps reconstructed sample positions to their actual depth-texel centers to avoid a false flat-surface shading pattern found during development.
- High → Low → Balanced → High → Balanced transitions completed in both hosts. Low released all contact targets/receiver hooks. Equivalent repeated frames reused allocations. Window's actual fabrication snapshot stayed unchanged.

The test sources are included in `shared-3d/tests/contact-browser.mjs` and `contact-shading.mjs`. They serve local files, block external requests and print resolved engine revisions. They do not access accounts, write cloud data or visit production sites. Render captures and logs are test outputs, not bundled application assets.

## Engine and build limitations

Window retains its actual vendored **Three.js r160**. Pergola retains its declared **Three.js 0.185.1** and **Vite 8.1.5**. Neither a dependency version nor a lockfile was changed.

The local Pergola dependency directory was incomplete. For validation only, its Three.js resolution was connected to the available root **0.160.1** installation. The temporary dependency symlink is not included in the ZIP. Therefore **all local Pergola CPU and WebGL checks ran on r160, not r185.1**.

`npm run build --prefix pergola-configurator` was attempted and failed with exit 127, **`vite: not found`**. Fetching the missing pinned dependencies was unavailable in this environment. A successful production Vite build or production-engine runtime is **not** claimed. Use the normal installed-dependency pipeline and inspect the deployed result. The contact stage has capability/template guards and a direct-render fallback, but those guards are not a substitute for testing the pinned engine.

Not established here: target-phone frame rate/thermal behavior, real-device context recovery, authenticated save/share/export workflows, every catalog/layout/view combination, or a post-deployment review of the live sites.

## Delivery and acceptance

The ZIP contains only changed/new source, tests, documentation and `commit_message.md` at its root, with project-relative paths and no enclosing directory. No node_modules, compiled distribution, git metadata, font files, rendered captures or test-only dependency substitutions are included.

After normal build/deployment, use Balanced or High with Window's CAD/debug colors disabled. Look at frame/handle recesses and Pergola post/base/deck or beam contacts. The change should be **subtle and local**, not a darker overall color, enlarged grain, dark glazing silhouette or gray background wash. Check quality transitions, resizing/orientation, opening/exploded views, accessories/side glazing and normal capture workflows. See `CONTACT_SHADING.md` for diagnostics, controls, extension points and known screen-space limitations.
