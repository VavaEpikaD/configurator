# Balanced/High rendering performance

Release: `20260909-perf-15`, 9 September 2026. Window and Pergola only.
Baseline: main(13) plus the delivered UV, deck, restored-handle, glass and contact-14 updates.

## Install

Apply the update ZIP at the project root, over the current Step 9 release.
There is no outer wrapper directory. Run the normal Window/Pergola build before publishing.
No dependency/lockfile, account, saved configuration or pricing changes are required.
`commit_message.md` at the ZIP root describes this update. Deployment is not performed by the package.

## Changes

### Draw only when render inputs change

The host still runs its existing animation/input loop. `SceneRevision` compares
visible scene inputs, camera/projection, buffer versions, material/light values,
texture uploads/transforms, clipping and viewport size. An unchanged frame performs
no WebGL draw calls. This is not a claim of zero CPU work: checking the scene and
processing input continue. Unknown ShaderMaterials, video, skinning/morphing,
custom drawing callbacks and explicitly marked continuous content use continuous
rendering rather than risk freezing animation.

Window batches its add/merge overlay projections, computes outer bounds once per
refresh and avoids one layout read plus a complete CAD traversal per button.
The pose loop no longer allocates temporary vectors for unchanged exploded poses
or rewrites unchanged angle labels. Asymptotic handle/explode interpolation snaps
only within 1e-6 of its final target so that a settled scene actually settles.

### Reuse static shadows

Camera orbit changes the beauty/depth view but not the scene's directional-light
shadow map. Shadow maps are redrawn for changed geometry/transforms/visibility,
relevant material/light inputs, quality changes and explicit shadow invalidation,
not solely because the user orbits. Shadow size, filtering, biases, caster/receiver
choices and lighting intensity are preserved. Custom animated content is conservative.
The shared render restores the host's shadow auto-update flag afterward.

### Reduce post-processing overhead without changing its strength

The 12/20-tap AO patterns are precomputed once in JavaScript; the shader applies
the equivalent rotation instead of repeating sin/cos/sqrt for every tap/pixel.
The dual radii, maximum darkness and depth-guided filter are unchanged. Floating-
point rounding may cause isolated one-level pixel differences, not a retune.

Framebuffer completeness is checked after allocation/resize, not three times on
every frame. Explicit clears duplicating automatic clears are removed. Target
resize retains the three target objects and fullscreen materials/geometry; only
their required underlying buffers resize. An unchanged explicit beauty render may
reuse its already-valid AO result. Actual scene changes still regenerate it.
Once scene transforms are updated, ordinary multi-pass rendering reuses them;
custom animation/special render paths retain Three's usual update behavior.

### Temporary resolution reduction while moving slowly

The stored quality preference is not changed. Stable/explicit frames retain the
existing limits: Balanced DPR <= 1.5, High DPR <= 2, subject to existing compact
viewport/device limits. All geometry, material and texture detail remains as before.

During sustained camera/object motion the controller observes active frame
intervals. After at least eight suitable samples, a slow view can step through
**1 -> 0.82 -> 0.66** of the selected pixel ratio. These are linear scales: the
last step shades approximately 44% as many main-framebuffer pixels, before AO
caps and other passes. Changes are spaced at least 500 ms apart. A faster moving
view may recover one step; after 220 ms without visual motion the next render
restores full selected resolution. A screenshot using an explicit `render()`
also restores full quality immediately. First-load and isolated long stalls do
not by themselves choose a lower resolution.

The temporary softening is intentional while dragging/orbiting a slow scene.
It is not a guarantee of a particular FPS, and complex/high-DPI scenes still
cost more than simple ones. Shadow maps and environment probes are not rebuilt
just because this temporary resolution changes.

The public `transmissionResolutionScale` is used only on Three.js versions that
actually expose it (0.75 while reduced motion, 1 when settled). Window's r160 does
not expose it; no vendor engine patch pretends otherwise. Window also requests
`powerPreference: 'high-performance'`; this is a browser hint, not a guaranteed
GPU selection.

## Integrating another host

```js
const surfaces = createSurfaceSystem(THREE, { renderer, scene, shadowLights: [sun] });
function frame(time) {
  controls.update();
  updateAnimations();
  const drawn = surfaces.render(camera, { onDemand: true, now: time });
  if (drawn) labels.render(scene, camera);
}
// Explicit screenshots: draw synchronously before reading the canvas.
surfaces.render(camera);
const image = renderer.domElement.toDataURL('image/png');
// For a renderer clear/reset or custom change not represented in normal inputs:
surfaces.invalidate();
```

Mutating BufferAttributes/Texture pixels still requires Three's normal
`needsUpdate` contract. Unknown uniform-driven materials should be declared
`object.userData.continuousRendering = true`, or explicitly invalidated as needed.
Call `invalidate()` after a same-size `renderer.setSize()` since that can clear a
canvas without changing its numeric dimensions; both integrated hosts do this.
Use explicit rendering for exports/targets. XR, array cameras, special targets,
scissoring and partial viewports bypass the default frame cache. No renderer or
canvas prototype is monkey-patched. Hosts retain their own animation lifetime.

Both hosts pause expensive work while hidden. Visibility/context restoration
invalidates cached content. Quality changes, including Low, release/reconfigure
AO as before; disposal removes observers, snapshots and GPU resources.

## Diagnostics

```js
WINDOW_VISUALS_API.getDiagnostics().performance
PERGOLA_VISUALS_API.getDiagnostics().performance
```

After loading the matching release, top-level `version` is `20260909-perf-15`.
`drawnFrames` grows when scene content changes; `skippedIdleFrames` grows at rest.
`shadowReuses` should grow during camera orbit. `motionResolutionScale` normally
returns to 1 after movement, and `currentPixelRatio` returns to `settledPixelRatio`.
`lastFrameCpuMs` and `activeFrameIntervalMs` are diagnostic observations, NOT GPU
profiling or guaranteed FPS. `continuousContent` explains an intentional bypass.

Geometry stays `20260909-uv-8`, texture assets `20260909-pbr-deck-7`, glazing
`20260909-glass-13`. The AO version changes because its implementation changed,
not because its approved intensity/settings changed.

## Deliberately not done

No CAD simplification, replacement of customer profiles, geometry LOD, mesh merging,
price/manufacturing changes, lowered settled textures, disabled glass reflections,
deck/wood resampling, or additional post-processing effects. Imported assets and
picking/selection identities remain intact. Other configurators are not migrated.

## Technical references

- Three.js WebGLRenderer official documentation (shadowMap flags, renderer.info,
  powerPreference, supported transmissionResolutionScale):
  https://threejs.org/docs/pages/WebGLRenderer.html
- MDN WebGL best practices (avoid synchronization-heavy queries in the hot path):
  https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices

See PERFORMANCE_VALIDATION.md for actual checks and exact engine/hardware limits.
