// Build-only helper. Writes raw RGBA pixels using the accepted calibration;
// tools/prepare_pbr_assets.py encodes them losslessly as PNG. No runtime bake.
import { writeFile, mkdir } from 'node:fs/promises';
import { createSurfacePixels } from '../src/materials/SurfaceTextures.js';
const directory = process.argv[2];
if (!directory) throw new Error('Supply a temporary output directory.');
await mkdir(directory, { recursive: true });
for (const kind of ['powder', 'brushed']) {
  const pixels = createSurfacePixels(kind, 256);
  for (const role of ['normal', 'roughness']) await writeFile(`${directory}/${kind}-${role}.rgba`, pixels[role]);
}
