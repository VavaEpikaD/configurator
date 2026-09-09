# Local PBR asset provenance

Release: `20260909-pbr-6`.

These images are checked into the project and served from the same application
as the configurator. There are no runtime texture-CDN requests or API keys.

## Photographic deck derivative

The three source files already supplied in this project are:

- `website/public/textures/pbr/fence-wood-color.jpg`
- `website/public/textures/pbr/fence-wood-normal.jpg`
- `website/public/textures/pbr/fence-wood-roughness.jpg`

The existing source README attributes them to **Wood Table 001**, by Poly Haven
(photography: Dimitrios Savva; processing: Rico Cilliers), released under CC0.
Source: https://polyhaven.com/a/wood_table_001
License: https://polyhaven.com/license

The actual supplied images are 512 x 512, despite the older website README's
"1K" description. This release does not upscale them or claim higher detail.

For `wood.deck`, all three maps were rotated together to run grain along U.
The tangent-space normal vectors were rotated as well as their pixel positions.
The color was adjusted to a warm, lighter neutral wood; roughness was remapped
for a matte surface rather than the original table varnish. This is a visual
wood-deck derivative, not a measured oak species, coating, or manufacturer finish.
A 256-pixel color-only image is supplied for Low. Balanced and High use the
512-pixel set; High improves existing filtering/rendering budgets, not resolution.

## Aluminium microtexture maps

`powder-*.png` and `brushed-*.png` are lossless encodings of the accepted
`createSurfacePixels()` output in `src/materials/SurfaceTextures.js`. They are
project-generated, not downloaded scans or manufacturer samples. Their bytes,
orientation, strength, tile size, roughness factors and reflection multipliers
preserve the accepted corrective-material calibration. `flipY: false` is
intentional, matching the existing DataTexture row order.

## Reproducibility and delivery

`v1/manifest.json` records dimensions, byte sizes and SHA-256 hashes of all eight
runtime maps. Runtime code refers to literal `new URL()` paths, so Vite can emit
local assets and Window can copy the same directory tree.

The output images are already included. No Python or image tooling is needed
for ordinary builds/deployment. To regenerate them deliberately, run:

```sh
# Build-only dependencies: Python 3, Pillow, NumPy; Node.js.
python shared-3d/tools/prepare_pbr_assets.py
```

This reads the existing local sources; it does not download anything. Retain the
provenance file and regenerate the manifest whenever changing the image bytes.
