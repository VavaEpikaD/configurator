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
surface_texture_source = ROOT / 'src' / 'materials' / 'SurfaceTextures.js'
if surface_texture_source.exists():
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['node', str(ROOT / 'tools' / 'bake_microtextures.mjs'), tmp], check=True)
        for kind in ('powder', 'brushed'):
            for role in ('normal', 'roughness'):
                pixels = np.fromfile(Path(tmp) / f'{kind}-{role}.rgba', dtype=np.uint8).reshape(256, 256, 4)
                # Keep bytes and row order identical to the accepted DataTexture.
                Image.fromarray(pixels).save(OUTPUT / f'{kind}-{role}-256.png', optimize=True)
else:
    required = [OUTPUT / f'{kind}-{role}-256.png' for kind in ('powder', 'brushed') for role in ('normal', 'roughness')]
    missing = [str(path.name) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError('Missing existing shared metal assets and no SurfaceTextures.js source is available: ' + ', '.join(missing))

# Rotate every wood map together so grain follows U on an extrusion/board.
color = np.asarray(Image.open(SOURCE / 'fence-wood-color.jpg').convert('RGB').transpose(Image.Transpose.ROTATE_90), dtype=float) / 255
luminance = color @ np.array([.2126, .7152, .0722])
# Create a lighter presentation variant while preserving noticeably stronger
# grain contrast and some of the source photograph's chroma variation.
neutral = 0.72 * luminance[:, :, None] + 0.28 * color
ratio = neutral / np.maximum(neutral.mean(axis=2, keepdims=True), 1e-6)
# Warm deck tint, without flattening all local variation into a single scalar.
warm = np.array([0.95, 0.84, 0.68])
tone = np.clip(0.70 + (luminance - luminance.mean()) * 1.90, 0.36, 1.0)
color_out = np.rint(np.clip(tone[:, :, None] * warm * ratio, 0, 1) * 255).astype('uint8')
full = Image.fromarray(color_out)
full.save(OUTPUT / 'deck-color-512.jpg', quality=94, subsampling=0)
full.resize((256, 256), Image.Resampling.LANCZOS).save(OUTPUT / 'deck-color-256.jpg', quality=91, subsampling=0)

normal_source = SOURCE / 'fence-wood-normal.jpg'
if normal_source.exists():
    normal = np.asarray(Image.open(normal_source).convert('RGB').transpose(Image.Transpose.ROTATE_90), dtype=float) / 127.5 - 1
    # The source is OpenGL tangent-space (+Y). A +90-degree UV rotation maps
    # (nx, ny) -> (-ny, nx); rotating pixels without vectors would mislight grain.
    normal = np.stack([-normal[:, :, 1], normal[:, :, 0], normal[:, :, 2]], axis=-1)
    normal /= np.maximum(np.linalg.norm(normal, axis=-1, keepdims=True), 1e-6)
    Image.fromarray(np.rint((normal * .5 + .5) * 255).astype('uint8')).save(OUTPUT / 'deck-normal-512.png', optimize=True)
elif not (OUTPUT / 'deck-normal-512.png').exists():
    raise FileNotFoundError('Missing wood normal source and no existing deck-normal-512.png asset is available.')

rough_source = SOURCE / 'fence-wood-roughness.jpg'
if rough_source.exists():
    rough = np.asarray(Image.open(rough_source).convert('L').transpose(Image.Transpose.ROTATE_90), dtype=float) / 255
    # Matte deck derivative with visible but not glossy variation.
    rough = np.rint((.72 + .22 * rough) * 255).astype('uint8')
    Image.fromarray(rough).convert('RGB').save(OUTPUT / 'deck-roughness-512.png', optimize=True)
elif not (OUTPUT / 'deck-roughness-512.png').exists():
    raise FileNotFoundError('Missing wood roughness source and no existing deck-roughness-512.png asset is available.')

records = {}
for file in sorted(OUTPUT.iterdir()):
    if file.suffix not in ('.png', '.jpg'):
        continue
    image = Image.open(file)
    records[file.name] = {'width': image.width, 'height': image.height, 'bytes': file.stat().st_size,
                          'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}
(OUTPUT / 'manifest.json').write_text(json.dumps({'version': '20260909-pbr-deck-7', 'files': records}, indent=2) + '\n')
print('Prepared', len(records), 'local PBR maps;', sum(v['bytes'] for v in records.values()), 'bytes.')
