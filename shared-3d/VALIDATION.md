# Validation — shared edge finishes Step 4

Release: `20260908-corrective-4`. Baseline: original uploaded project plus the accepted Orders/font, materials Step 1 and geometry Step 2 overlays, in that order. No commits, pushes or deployments were performed.

## Automated results

**146/146 shared tests passed**, using `npm run check:shared-3d`.

The original 91-test suite remains, including geometry ownership, UVs, cut operations, material/quality handling, Window mesh pooling, 28 Pergola baseline configurations and 13 Window builder/layout baseline cases. Original golden fixture files have not been regenerated. Where intentional new edge triangles differ from a box, these original fixtures run with the explicit exact/no-edge switch.

The 55 additional tests cover:

- Rounded rectangular prisms along each axis: original bounds, flat ends, watertight triangle topology, outward winding, unit normals, material slots and metre-scale UV continuity.
- Guarded inset solid bevels: original depth/envelope, source immutability, protected holed/concave sections, safe radius limits and geometry ownership.
- Explicit powder-coat map diagnostics and Low/Balanced/High behavior, deterministic broader surface detail and unchanged selected base color.
- 28 actual Pergola assembly cases comparing edge-enabled to exact output: all mesh bounds/placement/shadow flags match; every untargeted buffer remains exact; targeted generated aluminium carries the expected maps and native UVs. Product state and resource disposal are checked.
- 13 actual Window builder/layout cases comparing enabled handle bevels to exact geometry, including unchanged CAD section geometry and fabrication snapshots, repeated builds and quality transitions. These fixtures use deterministic **synthetic CAD sections**, not the entire production CAD catalog.
- Deck top/footprint preservation and unrounded substructure; native bevel UV metadata surviving Window mesh reuse.

Cross-fixture Window comparisons normalize JSON snapshots across their separate VM realms; geometry and fabrication values are not rounded or relaxed by that normalization. Bounds/transform float comparisons use a small metre-space tolerance; untargeted attribute buffers are compared exactly.

**Window's full `npm run check` validation chain and `prepare:static` passed.** This includes its catalog, compatibility, layout, CAD/accessory, import-map, translation, source-module and syntax checks. Its production static files resolve through the new native module cache versions.

**Pergola's syntax and translation checks passed.**

## Executed WebGL checks

This release obtained a working **Chromium WebGL2 context through SwiftShader/Xvfb**. It is software rendering, not a representative desktop or phone GPU benchmark.

`npm run check:shared-3d:browser` passed both local harnesses through **Low, Balanced and High** (six rendered quality cases). All shader programs linked, no context was lost, environment generation succeeded, no scene/asset errors were reported, fine-map tier behavior was correct and tracked geometry counts stayed constant through quality changes.

- **Pergola:** the actual `PergolaScene`, store, procedural product and local GLB assets were loaded. Full-view, post close-up and beam-junction images were also captured from the accepted baseline and updated scene and inspected. A visible software-rasterization artifact with long, narrow deck bevel triangles was isolated and corrected with bounded longitudinal subdivision before final captures.
- **Window:** the browser smoke uses its actual vendored r160 engine/mesh wrapper with the shared bevel factories, powder coating, glass and environment. A backplate component and rounded member were inspected. It is **not** a complete Window UI/saved-configuration visual test. A separate full static Window startup reached the real CAD assembly and diagnostic API, but its capture harness did not complete reliably; no full-Window visual sign-off is claimed.

The browser smoke implementation is included under `tests/browser-smoke.mjs`. It serves only local files, blocks external requests and prints the resolved engine revision. It does not access user accounts, write cloud data or visit production sites. Screenshots are optional outputs, not pixel-perfect automated assertions.

## Dependency/build limitations

Window retains its vendored **Three.js r160** and existing Mesh reuse wrapper. Pergola retains declared **Three.js 0.185.1** and **Vite 8.1.5**; neither package version nor lockfile was changed.

The available dependency tree in this environment resolves Pergola's tests to a hoisted **Three.js r160**. Both its numeric tests and its WebGL harness therefore ran on r160, **not its production r185.1**. Production-version compatibility is not proven by these results.

`npm run build --prefix pergola-configurator` was attempted and failed with **`vite: not found`**. The pinned dependencies could not be fetched here. Run the normal installed-dependency build pipeline and inspect the deployed result before accepting the update. No production Vite build, r185.1 runtime, real-device frame-rate result or post-deployment browser review is claimed.

## Delivery and acceptance

Apply the source ZIP over accepted Step 2, then run the usual builds/deployment. It includes only changed/new source, tests, documentation and root `commit_message.md`; no node_modules, prebuilt output, secrets added by this update, git metadata, fonts or captured images are packaged.

Use `EDGE_FINISHES.md` for close-up material/edge acceptance, Window's debug-color caveat, quality expectations, diagnostic fields and browser test commands. Numerical tests are guardrails, not a substitute for visual review on the deployed engine and target devices.
