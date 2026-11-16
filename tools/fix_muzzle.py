# Repairs closed-mouth kit frames whose muzzle the AI sheet smeared (its lower outline gone, the muzzle colour bleeding
# into the fur): the mouth's own drawing (lines, teeth, fangs, inside) stays; inside the muzzle everything else is the
# muzzle's own colour from the picture; outside it (the outline, the fur) the picture's own pixels.
# usage: python3 tools/fix_muzzle.py <id> <seedx,seedy> <k,k,...>   (repo root)
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
tid, seed, ks = sys.argv[1], [int(v) for v in sys.argv[2].split(',')], [int(k) for k in sys.argv[3].split(',')]
base = np.array(Image.open(f'faces/{tid}/base.webp').convert('RGBA')).astype(float)
lum = lambda a: a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11
ink = (lum(base) < 110) | (base[..., 3] < 128)
lab, n = ndimage.label(~ink); s0 = lab[seed[1], seed[0]]; c0 = base[lab == s0][:, :3].mean(0)
# the muzzle: the seed's region and every other region of the same colour beside it (the mouth line splits it in parts)
M = lab == s0
for _ in range(3):
    ring = ndimage.binary_dilation(M, iterations=12) & ~M
    for l in np.unique(lab[ring]):
        if l == 0: continue
        R = lab == l
        if R.sum() < 200 or R.sum() > 60000: continue
        if np.abs(base[R][:, :3].mean(0) - c0).sum() < 40: M |= R
M = ndimage.binary_fill_holes(ndimage.binary_closing(M, iterations=6))
white = (lum(base) > 225) & (np.ptp(base[..., :3], -1) < 30)
inner = M & ~ink & ~white
tan = np.median(base[inner][:, :3], 0)
print('muzzle px', int(M.sum()), 'tan', tan)
for k in ks:
    f = np.array(Image.open(f'faces/{tid}/m{k}.webp').convert('RGBA')).astype(float)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    mouthy = (lum(f) < 100) | ((r > 120) & (g < r * 0.6)) | ((r > 200) & (b > 140) & (g < 170)) | ((lum(f) > 215) & (np.ptp(f[..., :3], -1) < 35))
    keep = mouthy & M & (f[..., 3] > 200)
    keep = ndimage.binary_opening(keep, iterations=1)
    lab2, n = ndimage.label(keep); sz = ndimage.sum(keep, lab2, range(1, n + 1)); keep = np.isin(lab2, [i + 1 for i, s in enumerate(sz) if s >= 25])
    keep = ndimage.binary_dilation(keep, iterations=2) & M
    out = base.copy()
    edge = ink & ~ndimage.binary_erosion(M, iterations=9)   # the muzzle's outline (the picture's own mouth lines inside it go)
    sel = M & ~keep; out[sel, :3] = np.where(edge[sel][:, None], base[sel][:, :3], tan)
    # the muzzle's own highlight from the picture where the picture has no mouth drawing there
    hl = M & ~keep & ~ink & ~white & ~ndimage.binary_dilation(ink & ~edge, iterations=3) & (lum(base) > lum(tan[None, None, :])[0, 0] + 8)
    out[hl, :3] = base[hl, :3]
    a = ndimage.gaussian_filter(keep.astype(float), 1.0)[..., None]
    out = f * a + out * (1 - a)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA').save(f'faces/{tid}/m{k}.webp', lossless=True)
    print('fixed', k, int(keep.sum()))
