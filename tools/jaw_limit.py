# Keeps a kit frame's new mouth only down to its jaw: in each column, below the jaw's bottom line (the lower of the
# picture's own jaw line and the new mouth's lowest red/pink/white plus the jaw's thickness) the picture shows through.
# usage: python3 tools/jaw_limit.py <id> <k,k> <x0,x1,y0,y1 mouth search box> [thickness] [jaw-line row limit]
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
tid, ks = sys.argv[1], [int(k) for k in sys.argv[2].split(',')]
x0, x1, y0, y1 = [int(v) for v in sys.argv[3].split(',')]; th = int(sys.argv[4]) if len(sys.argv) > 4 else 26; jy = int(sys.argv[5]) if len(sys.argv) > 5 else y1   # (the picture's jaw line is above row jy)
base = np.array(Image.open(f'faces/{tid}/base.webp').convert('RGBA')).astype(float)
lum = lambda a: a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11
bdark = lum(base) < 90
for k in ks:
    f = np.array(Image.open(f'faces/{tid}/m{k}.webp').convert('RGBA')).astype(float)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    mc = ((r > 100) & (g < r * 0.5) & (b > g * 0.8)) | ((r > 200) & (b > 140) & (g < 170)) | ((lum(f) > 225) & (np.ptp(f[..., :3], -1) < 30) & (np.abs(f[..., :3] - base[..., :3]).sum(-1) > 60))
    keep = np.zeros(f.shape[:2], bool)
    for x in range(x0, x1):
        ys = np.nonzero(mc[y0:y1, x])[0]
        bj = np.nonzero(bdark[y0:jy, x])[0]
        lim = (y0 + ys.max() + th) if len(ys) else -1
        if len(bj): lim = max(lim, y0 + bj.max() + 3)
        if lim > 0: keep[:lim, x] = True
    keep[:y0] = True
    a = ndimage.gaussian_filter(keep.astype(float), 1.5)[..., None]
    out = f * a + base * (1 - a)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA').save(f'faces/{tid}/m{k}.webp', quality=95, method=6)
    print('limited', k)
