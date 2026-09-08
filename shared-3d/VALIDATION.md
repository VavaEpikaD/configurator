# Delivery validation — shared geometry Step 2

Release: `20260908-geometry-2` · 8 September 2026

Baseline: the supplied project, followed by the Orders/font fix and the accepted `configurator_shared_materials_step1_20260908.zip`. The patch is an incremental overlay on that baseline, not a full repository export. No production data, saves or deployments were changed.

## Executed successfully

| Check | Result |
| --- | --- |
| `npm run check:shared-3d` | **91 tests passed, 0 failed, 0 skipped** |
| `npm run check --prefix window-configurator` | Full existing CAD/profile/layout/connection, i18n, import-map and module-graph chain passed; 13 graph entry modules / 39 linked modules |
| `npm run prepare:static --prefix window-configurator` | Passed; copied shared source checked against workspace source |
| `npm run check --prefix pergola-configurator` | Syntax and i18n checks passed, including the new adapter |
| Changed JavaScript / test syntax | All changed/new JS and MJS files passed `node --check` |
| Window cache-chain audit | Changed native modules and their local import parents use new URLs; HTML points to `main.js?v=14-geometry-2` |

### What the 91 tests cover

The 24 accepted material/quality/Pergola checks remain, joined by 67 geometry and lifecycle checks: 19 core-geometry tests, 32 integration tests, 14 Window regression tests, and two additional scene-controller lifetime tests.

The core checks compare generated buffers against original Three.js primitives/extrusions, including indices, groups, winding, holes and multi-island sections. They cover independent clones, validation, custom registration, CAD units, optional normal/UV finalization, rounded/simplified sections, scalar cuts, temporary-buffer cleanup on errors, deduplicated disposal and the injected Mesh-constructor contract.

**28 Pergola fixtures** were captured from the accepted Step 1 before geometry changes. They cover preset combinations, sizes, louver orientation and tilt, wall attachment, privacy/screens/glass, drainage and accessories. On the available r160 engine, complete geometry hashes also match; every engine run checks per-mesh topology, bounds, transforms and shadow policies. Every generated product primitive in these cases is owned by the shared library. Additional tests check quality invariance and 25 consecutive resize/rebuild/disposal cycles.

**13 Window fixtures** run the actual Window builder and layout controller with deterministic synthetic CAD sections. Their geometry data and fabrication snapshots match the accepted version, including repeat builds, glass thicknesses, opening/tilt/handle/explosion states, and split/mixed layouts. The fixtures cover logic and numerical output, not all manufacturer CAD input files. A separate adapter test runs Window's actual mesh-reuse wrapper and verifies that resizing retains the intended pooled mesh and tracks the surviving buffer.

The scene-controller tests verify that changing Low/Balanced/High does not modify or dispose geometry, that already-disposed product buffers leave the live registry, and that teardown releases remaining registered buffers once.

### Additional pre-existing defect corrected

During the Window mixed-layout regression, the fixed-pane fallback numbering read `fixedCellIndex` without declaring that `forEach` callback argument. The callback now receives its index. A separate T-grid case verifies two opening panes and one fixed pane build with three valid glazing meshes. This repair is tested independently; the formerly broken case is **not** advertised as unchanged baseline output.

## Engines and testing limits

Window used its actual vendored Three.js **r160**, and the mesh-pooling test used its real wrapper. Pergola integration tests resolved the available repository-root Three.js **0.160.1**. The Pergola test imports resolve relative to its package, so a normal local installation will exercise that application's installed version instead. Exact baseline hashes are gated to the captured engine revision; cross-engine runs still check topology, bounds, transforms and shadow policies.

**Pergola's production build did not run successfully here.** `npm run build --prefix pergola-configurator` stopped with `vite: not found`; the package's Vite 8.1.5 and Three.js 0.185.1 installation was unavailable, and the package registry was unreachable. Their declared versions were not changed or downgraded. Run the normal dependency installation and Vite production build in development/CI before deployment. Compatibility with that pinned Three.js version has not been execution-verified in this environment.

**No successful WebGL render, GPU shader validation, visual comparison or frame-rate benchmark is claimed.** The installed Chromium could not obtain a WebGL2 context. Renderer/environment tests use a GPU-independent PMREM double: they validate settings and resource ownership, not rendered appearance. Step 2 intentionally leaves accepted material/lighting values and product shapes unchanged, but automated equivalence is not a substitute for device testing.

Authenticated save/cart flows, capture/AR, actual imported asset loading, complete production CAD catalogs, mobile GPU performance and real browser memory behavior remain post-deployment acceptance items. Follow the checks in `README.md`; inspect resizing, mixed Window layouts, opening/exploded states, Pergola side closures and quality changes before moving on to the next visible geometry improvement.

## Delivery scope

Only Window, Pergola and the shared 3D/test/documentation layer are changed. The ZIP includes a root `commit_message.md`, but no Git operation, push or deployment was performed. Test fixtures are regression data, not runtime assets. No dependencies, prebuilt output or font files are included.
