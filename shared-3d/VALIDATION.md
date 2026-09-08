# Delivery validation — materials Step 1

Release: `20260908-materials-1` · 8 September 2026

## Executed successfully

- `npm run check:shared-3d`: **24 tests passed**. Covers independent material variants, texture ownership/color spaces, quality transitions, extensibility, disposal, UV units/grain/position invariants, Pergola product geometry equality, side glazing, repeated rebuilds, shadow-target replacement, environment orientation and allocation-failure fallback.
- `npm run check --prefix window-configurator`: full existing Window check chain passed, including its CAD/profile/layout/connection validations, import-map ordering, i18n and client module graph.
- `npm run prepare:static --prefix window-configurator`: static preparation passed, including the local copy of the new shared source. Copied shared files were also checked against their sources.
- `npm run check --prefix pergola-configurator`: existing JavaScript syntax/i18n check passed.
- New/changed JavaScript and test sources pass Node syntax checks.

The renderer-controller tests use a **GPU-independent PMREM test double**. They test settings and resource lifetime, not shaders or images. Window's real vendored Three.js r160 was used for material/UV tests. Pergola geometry tests in this delivery environment resolved the restored repository-root Three.js **0.160.1**, because the project's pinned Pergola installation could not be downloaded. The integration test resolves from Pergola's package location so it uses that application's installed engine when run after a normal dependency installation.

## Not verified in this environment

**Pergola's Vite production build and operation against its pinned Three.js 0.185.1 have not been executed here.** The dependency registry was unreachable. The patch does not change or downgrade those declared dependencies. Run the existing Pergola build in the normal development/CI environment before release.

**No successful WebGL render, GPU shader check, frame-rate benchmark or visual sign-off is claimed.** Browser navigation was restricted in the available environment, and an attempted in-memory scene execution also failed to create a WebGL context. Fetching public page HTML did not establish what either live product looked like.

Authenticated save/cart flows, device AR, transmission across overlapping glass, mobile GPU compatibility and final lighting/material aesthetics require the post-deployment acceptance checks in `README.md`. Their implementation/data schemas were not deliberately changed, but that is not a substitute for runtime regression testing.

## Existing validator corrected

The Window import-map validator formerly required a direct import of the vendored Three.js file, although the supplied application already used `three-mesh-reuse.js`. It now accepts that existing adapter, verifies its vendored-engine re-export, and retains the import-map-before-module ordering checks. The actual application import-map strategy was not replaced.
