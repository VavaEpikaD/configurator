"""Build-only, deterministic local PBR preparation (Python, Pillow, NumPy).
The runtime ships the output images, not these build dependencies.
Uses the project's existing CC0 photographic source; no network access.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import tempfile
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'website' / 'public' / 'textures' / 'pbr'
OUTPUT = ROOT / 'assets' / 'pbr' / 'v1'
OUTPUT.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['node', str(ROOT / 'tools' / 'bake_microtextures.mjs'), tmp], check=True)
    for kind in ('powder', 'brushed'):
        for role in ('normal', 'roughness'):
            pixels = np.fromfile(Path(tmp) / f'{kind}-{role}.rgba', dtype=np.uint8).reshape(256, 256, 4)
            # Keep bytes and row order identical to the accepted DataTexture.
            Image.fromarray(pixels).save(OUTPUT / f'{kind}-{role}-256.png', optimize=True)

# Rotate every wood map together so grain follows U on an extrusion/board.
color = np.asarray(Image.open(SOURCE / 'fence-wood-color.jpg').convert('RGB').transpose(Image.Transpose.ROTATE_90), dtype=float) / 255
luminance = color @ np.array([.2126, .7152, .0722])
# Remove the original red varnish tint and keep photographic detail in a warm,
# lighter deck finish. This is a presentation variant, not a species assertion.
tone = np.clip(.77 + (luminance - luminance.mean()) * 1.25, .42, 1.0)
color_out = np.rint(np.clip(tone[:, :, None] * [225, 185, 132], 0, 255)).astype('uint8')
full = Image.fromarray(color_out)
full.save(OUTPUT / 'deck-color-512.jpg', quality=94, subsampling=0)
full.resize((256, 256), Image.Resampling.LANCZOS).save(OUTPUT / 'deck-color-256.jpg', quality=91, subsampling=0)

normal = np.asarray(Image.open(SOURCE / 'fence-wood-normal.jpg').convert('RGB').transpose(Image.Transpose.ROTATE_90), dtype=float) / 127.5 - 1
# The source is OpenGL tangent-space (+Y). A +90-degree UV rotation maps
# (nx, ny) -> (-ny, nx); rotating pixels without vectors would mislight grain.
normal = np.stack([-normal[:, :, 1], normal[:, :, 0], normal[:, :, 2]], axis=-1)
normal /= np.maximum(np.linalg.norm(normal, axis=-1, keepdims=True), 1e-6)
Image.fromarray(np.rint((normal * .5 + .5) * 255).astype('uint8')).save(OUTPUT / 'deck-normal-512.png', optimize=True)
rough = np.asarray(Image.open(SOURCE / 'fence-wood-roughness.jpg').convert('L').transpose(Image.Transpose.ROTATE_90), dtype=float) / 255
# A matte deck derivative instead of the source table's varnish/gloss response.
rough = np.rint((.80 + .20 * rough) * 255).astype('uint8')
Image.fromarray(rough).convert('RGB').save(OUTPUT / 'deck-roughness-512.png', optimize=True)

records = {}
for file in sorted(OUTPUT.iterdir()):
    if file.suffix not in ('.png', '.jpg'):
        continue
    image = Image.open(file)
    records[file.name] = {'width': image.width, 'height': image.height, 'bytes': file.stat().st_size,
                          'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}
(OUTPUT / 'manifest.json').write_text(json.dumps({'version': '20260909-pbr-6', 'files': records}, indent=2) + '\n')
print('Prepared', len(records), 'local PBR maps;', sum(v['bytes'] for v in records.values()), 'bytes.')
