# Draws a round "O" / "OO" mouth onto a kit's resting face, on its own mouth line (for kits whose sheet drew these badly).
# usage: python3 tools/draw_round_mouth.py <id> <out k> <cx,cy> <rx,ry> [tongue 0/1/p (pucker)] [line width]
import sys
from PIL import Image, ImageDraw
tid, k = sys.argv[1], int(sys.argv[2]); cx, cy = [float(v) for v in sys.argv[3].split(',')]; rx, ry = [float(v) for v in sys.argv[4].split(',')]
tongue = len(sys.argv) > 5 and sys.argv[5] == '1'; pucker = len(sys.argv) > 5 and sys.argv[5] == 'p'; lw = float(sys.argv[6]) if len(sys.argv) > 6 else 9
base = Image.open(f'faces/{tid}/base.webp').convert('RGBA'); SS = 4
lay = Image.new('RGBA', (1000 * SS, 1000 * SS), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
box = lambda x, y, a, b: [(x - a) * SS, (y - b) * SS, (x + a) * SS, (y + b) * SS]
if pucker:   # lips pushed out: a ring in the lip colour, outlined, around a small dark hole
    lip = base.getpixel((int(cx - rx * 1.4), int(cy + ry * 1.2)))[:3]
    d.ellipse(box(cx, cy, rx * 1.55 + lw / 2, ry * 1.45 + lw / 2), fill=(22, 14, 16, 255)); d.ellipse(box(cx, cy, rx * 1.55 - lw / 2, ry * 1.45 - lw / 2), fill=lip + (255,))
    rx, ry, lw = rx * 0.55, ry * 0.55, lw * 0.8
d.ellipse(box(cx, cy, rx + lw / 2, ry + lw / 2), fill=(22, 14, 16, 255))          # ink outline
d.ellipse(box(cx, cy, rx - lw / 2, ry - lw / 2), fill=(120, 24, 36, 255))         # inside
if tongue:   # the tongue low in the mouth, clipped to the inside
    t = Image.new('L', lay.size, 0); ImageDraw.Draw(t).ellipse(box(cx, cy + ry * 0.55, rx * 0.62, ry * 0.42), fill=255)
    m = Image.new('L', lay.size, 0); ImageDraw.Draw(m).ellipse(box(cx, cy, rx - lw / 2, ry - lw / 2), fill=255)
    from PIL import ImageChops; t = ImageChops.multiply(t, m)
    lay.paste((236, 110, 130, 255), (0, 0), t)
lay = lay.resize((1000, 1000), Image.LANCZOS)
out = base.copy(); out.alpha_composite(lay)
out.save(f'faces/{tid}/m{k}.webp', quality=95, method=6); print('drew', k)
