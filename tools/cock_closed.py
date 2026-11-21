# Cock kit (#310): the closed beaks drawn on the kit picture itself, so they are the kit picture exactly apart from the
# line where the halves meet: M/B/P (pressed shut: the line straight across, no smile curl at the back) and the frown
# (the same line, its back end curving down). The image tool's versions had a broken, blurred line.
# Usage: python3 tools/cock_closed.py
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
b = np.array(Image.open('faces/310/base.webp').convert('RGBA'))
rgb = b[..., :3].astype(int); N = b.shape[0]; yy, xx = np.mgrid[0:N, 0:N]
ink = (rgb.sum(-1) < 200) & (b[..., 3] > 128)
xs, ys = [], []
for x in range(470, 771, 5):
    r = [y for y in range(640, 700) if ink[y, x]]
    if r: xs.append(x); ys.append((r[0] + r[-1]) / 2 if r[-1] - r[0] < 14 else r[0] + 4)
P = np.polyfit(xs, ys, 2); L = lambda x: np.polyval(P, x)
# the line and its curl: ink near the fitted line from the back of the beak to just short of the tip
lab, n = ndimage.label(ink & (xx > 395) & (xx < 760) & (yy > 600) & (yy < 700))
seed = lab[int(L(600)), 600] or lab[int(L(600)) + 1, 600]
line = (lab == seed) & (np.abs(yy - L(np.clip(xx, 470, 770))) < 40)
line = ndimage.binary_dilation(line, iterations=2) & ~ndimage.binary_dilation(ink & ~line & (np.abs(yy - L(np.clip(xx, 470, 770))) > 12), iterations=1)
x1a = int(np.where(line.any(0))[0].max())
line &= xx < x1a - 22                                          # (the tip, where the line meets the outline, stays as drawn)
dim = (rgb.sum(-1) < 560) & ndimage.binary_dilation(line, iterations=4) & ~ink   # (the soft edge of the old line and curl)
line |= dim
keep = ~line & ~ink & (b[..., 3] > 250)
idx = ndimage.distance_transform_edt(~keep, return_distances=False, return_indices=True)
clean = b.copy(); clean[line] = b[tuple(idx[:, line])]
x0 = int(np.where(line.any(0))[0].min()); x1 = x1a - 18
INK = np.median(rgb[ink & (yy > 600) & (yy < 700) & (xx > 480) & (xx < 740)], 0)
def draw(pts, w=9):
    S = 4; m = Image.new('L', (N * S, N * S), 0); d = ImageDraw.Draw(m)
    d.line([(x * S, y * S) for x, y in pts], fill=255, width=w * S, joint='curve')
    for x, y in (pts[0], pts[-1]): d.ellipse([(x - w / 2) * S, (y - w / 2) * S, (x + w / 2) * S, (y + w / 2) * S], fill=255)
    a = np.array(m.resize((N, N), Image.BOX)).astype(np.float32)[..., None] / 255
    o = clean.astype(np.float32); o[..., :3] = o[..., :3] * (1 - a) + INK * a; return np.clip(o, 0, 255).astype(np.uint8)
xa = max(x0 + 30, 455)
mbp = [(x, L(x) - 2 * (1 - (x - xa) / (x1 - xa))) for x in np.linspace(xa, x1, 60)]
frown = [(xa - 16 + 16 * np.sin(t), L(xa) + 24 - 24 * np.sin(t) ** 0.6) for t in np.linspace(0, np.pi / 2, 14)] + [(x, L(x)) for x in np.linspace(xa, x1, 50)]
Image.fromarray(draw(mbp, 10)).save('faces/310/m1.webp', 'WEBP', lossless=True)
Image.fromarray(draw(frown)).save('faces/310/m9.webp', 'WEBP', lossless=True)
print('ok', x0, x1, round(L(600)))
