"""
Monta os WebP das molduras a partir dos PNGs de render.mjs.
Uso: python3 scripts/nitro-render/assemble.py <pasta-dos-pngs> <pasta-destino>

Por efeito:
  <nome>-still.webp  quadro parado 384 px (perfil sem WebGL, modo estático, listas)
  <nome>-128.webp    animado leve para listas: 30 quadros a 12 fps (mesmo loop de 2,5 s)
No perfil, o efeito roda ao vivo em WebGL (NitroFxCanvas) com o mesmo shader.
"""
import sys, os, glob
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)

for d in sorted(glob.glob(os.path.join(src, '*'))):
    if not os.path.isdir(d):
        continue
    name = os.path.basename(d)
    files = sorted(glob.glob(os.path.join(d, '*.png')))
    if len(files) < 2:
        continue
    raw = [Image.open(f).convert('RGBA') for f in files]
    step = max(1, len(raw) // 30)
    frames = [im.resize((128, 128), Image.LANCZOS) for im in raw[::step]][:30]
    out = os.path.join(dst, f'{name}-128.webp')
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=round(2500 / len(frames)),
                   loop=0, quality=55, method=6, alpha_quality=70)
    print(f'{out}: {os.path.getsize(out) // 1024} KB')
    still = raw[len(raw) // 3].resize((384, 384), Image.LANCZOS)
    out = os.path.join(dst, f'{name}-still.webp')
    still.save(out, quality=80, method=6, alpha_quality=85)
    print(f'{out}: {os.path.getsize(out) // 1024} KB')
