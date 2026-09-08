# Shared contact shading

Release: `20260908-contact-5`. Apply after the accepted corrective material/shading update. Window and Pergola only.

## Visual scope

This pass adds restrained screen-space ambient occlusion at nearby solid-surface contacts: window profile recesses, handle/backplate contact and Pergola structure/deck contact. It does not add a new coating, increase grain, alter bevels, recolor materials or retune the sky/HDR/exposure/sun. The geometry and material sub-versions remain at the accepted corrective release. `SURFACE_SYSTEM_VERSION` now identifies the whole rendering release separately from the geometry version.

Only indirect diffuse lighting and the standard material's indirect specular occlusion are affected. Direct sunlight, emissive/LED output, the visible background, labels and glass material properties are not multiplied by a screen overlay. The existing renderer still performs the actual beauty pass, including its original multisample antialiasing, physical transmission, shadows, fog and tone/color conversion. There is no additional tone-mapping or color-space conversion pass.

This remains a view-dependent screen-space approximation, not ray-traced visibility, global illumination, a baked lightmap, reflection capture or a substitute for the existing sun shadows. Hidden/off-screen occluders cannot contribute. Very small contacts fade out when their radius is below the auxiliary buffer's pixel resolution. This avoids noise rather than inventing sub-pixel contact detail.

## Integration

`createSurfaceSystem(THREE, { renderer, scene, contactShading })` owns one `ContactShading` instance. It uses the host engine without importing another Three.js copy or renderer. Window passes a 0.04 m radius; Pergola uses 0.14 m. The default maximum is 35% attenuation of **indirect** lighting, not 35% darkening of the finished image. Intensity/radius are identical between Balanced and High; sampling precision changes, not the intended finish.

```js
const surfaces = createSurfaceSystem(THREE, {
  renderer, scene, shadowLights: [sun], quality: 'balanced',
  contactShading: { radius: 0.14 }, // metres; choose for the host's product scale
});

// The host retains its animation loop, controls, resize and CSS label renderer.
function renderFrame() {
  controls.update();
  surfaces.render(camera);
  labelRenderer?.render(scene, camera);
}

// A non-persistent A/B frame for local visual testing; not a saved preference.
surfaces.render(camera, { contactShading: false });

// Disable for an entire specialized/capture host.
// createSurfaceSystem(THREE, {renderer, scene, contactShading: false});
```

Window's main render loop and Pergola's main loop/`capturePNG()` use this entry point. No global monkey-patch of `renderer.render` is installed. An unrelated direct/export render cannot accidentally inherit the last frame's contact shading; the active shader uniform is reset after the owned beauty pass. AR and Window's capture mode are disabled at creation. Active XR, array cameras, external render targets, override-material passes and scissored renders also bypass the effect.

## Passes and budgets

| Quality | Extra passes | Samples | Contact resolution | Maximum longest edge |
| --- | --- | --- | --- | --- |
| Low | None | 0 | No buffers | 0 |
| Balanced | Depth + occlusion | 12 | 0.5 × actual drawing-buffer size | 960 px |
| High | Depth + occlusion | 20 | 0.75 × actual drawing-buffer size | 1440 px |

Compact viewports cap the longest contact-buffer edge at 720 px in both enabled tiers. These caps are in addition to the existing pixel-ratio/shadow budgets. There are two unsigned-byte RGBA targets: packed depth with a depth buffer and an occlusion-only target. No float render-target extension, multiple-render-target support or external shader/noise/texture asset is required. Existing PBR shaders perform a five-tap depth-aware resolve of the contact mask. Low releases the two targets, depth-material variants and receiver hooks; it is not merely a zero-strength effect left rendering in the background.

A perspective/orthographic camera and a compatible WebGL2 renderer are required. A capability/shader-template check prevents attempting the effect on unsupported renderers. Detected target-allocation/render exceptions and incomplete framebuffers restore the scene/renderer state and fall back to the normal render path. Diagnostics retain the error; a different quality selection or context restoration permits a retry rather than repeating a failed allocation on every frame. This is not a guarantee that an arbitrary future Three.js shader change will be compatible; validate engine upgrades using the supplied browser tests.

There is no frame-rate promise or adaptive FPS downgrading in this step. Software-rendered test timings are not representative of customer devices. Use Low on devices where the added passes are too expensive.

## Depth and material safeguards

The depth pass uses geometry depth, not the coating normal maps; it must not turn the accepted fine coating into additional bumps or dirt. Samples are reconstructed at the fetched depth texel's centre. Without that snap, a flat sloping surface can acquire false depth relief. Depth derivatives select the nearer neighbour at silhouettes, the resolve rejects depth discontinuities, and sub-pixel/viewport-edge samples fade out.

Glass, blended/partially transparent surfaces, lines, sprites, unlit overlays, wireframe, non-depth-writing meshes, custom shader/depth paths and explicitly excluded materials do not become opaque depth occluders. Mixed opaque/transparent material-array meshes are conservatively excluded as a whole. The depth pass mirrors supported materials' side, alpha cutout, displacement and clipping properties. It borrows their textures but never disposes them. Occluder eligibility and receiving are separate: opaque non-PBR objects may occlude, but only eligible `MeshStandardMaterial`/`MeshPhysicalMaterial` surfaces receive this lighting hook.

`material.userData.contactShading = false` excludes that material from both roles. `object.userData.contactShading = false` excludes that object's depth contribution. When several objects share a receiving material, use the material flag to suppress receiving on all of them; do not expect an object flag to create an independent material variant automatically.

The material hook chains the previous `onBeforeCompile`, preserves the existing `<aomap_fragment>` and uses a distinct program-cache key. Original callbacks are restored on Low/teardown. Disposed/removed product materials and depth variants are pruned; two scenes cannot double-patch the same material instance. Product materials should still be scene-owned, as documented in the shared material library.

The pass restores visibility, original material arrays, clear color/alpha, target, viewport/scissor, background/override material and shadow-update flags in `finally`, including a failed depth pass. Context-loss listeners disable the pass; restoration drops stale targets and regenerates them on the next eligible frame. No product vertices, UVs, normals, pivots, BOM calculations, geometry groups, saved state or selection data are edited.

## Diagnostics and acceptance

On the corresponding page:

```js
WINDOW_VISUALS_API.getDiagnostics()
PERGOLA_VISUALS_API.getDiagnostics()
```

The top-level version is `20260908-contact-5`. On an eligible Balanced/High frame, `contactShading.status` should be `active`, `supported` should be true, `error` should be null, and `targetCount` should be 2. Low reports `quality-disabled`, zero targets and zero active receiver/depth materials. `allocationCount` and `renderedFrames` are cumulative; compare `bufferSize`, `targetCount`, `receiverMaterials` and `depthMaterials` after equivalent settled rebuilds for lifecycle checks. `geometry.version: "20260908-corrective-4"` is intentional, not stale code.

Compare a full-product view and a close-up at Balanced. In Window turn off CAD/debug colors and inspect the handle/backplate, sash recesses and glass boundaries from both sides. In Pergola inspect post feet and beam/post contacts, then side glazing, screens and day/night/LED modes. The expected difference is subtle local contact shading, not a new coarse texture, uniform gray wash or black halo around the glazing. Check Low → High → Balanced, portrait → landscape → portrait, opening/exploded views and several product rebuilds. Save/capture/export flows remain deployment acceptance items.

## Reproducible checks

```sh
npm run check:shared-3d
npm run check:shared-3d:contact-browser
npm run check --prefix window-configurator
npm run prepare:static --prefix window-configurator
npm run check --prefix pergola-configurator
npm run build --prefix pergola-configurator
```

The local contact browser test strips only non-rendering account/SEO/font/QR/upload-script integration from Window's harness page, supplies explicit test URL inputs, exposes scene references and pauses its animation loop. It loads the real Window client entry point, native renderer/mesh-reuse adapter and production CAD SVG/JSON files. Pergola uses its real scene/store/assets. All external requests are blocked. This is not an authenticated full-UI/end-to-end test. Test-only source instrumentation is served in-memory, not written to production source files.

For an isolated Linux software-render test after starting Xvfb:

```sh
DISPLAY=:99 CHROMIUM_EXECUTABLE=/usr/bin/chromium SOFTWARE_WEBGL=1 \
  VISUAL_OUTPUT_DIR=/tmp/contact-visuals npm run check:shared-3d:contact-browser
```

`--no-sandbox` is confined to the explicit software-test mode; it is not an application/deployment setting. See `VALIDATION.md` for the actual engine versions and checks executed in this delivery.

## Reference contracts

Three.js official documentation consulted for the implementation contract:

- Material shader hooks, program-cache keys and disposal: https://threejs.org/docs/pages/Material.html
- PBR ambient occlusion and data/color maps: https://threejs.org/docs/pages/MeshStandardMaterial.html
- Packed-depth material and alpha/displacement properties: https://threejs.org/docs/pages/MeshDepthMaterial.html
- Output conversion and tone mapping for separate postprocessing chains: https://threejs.org/docs/pages/OutputPass.html

This implementation deliberately keeps the existing beauty pass instead of introducing a second output-processing chain.
