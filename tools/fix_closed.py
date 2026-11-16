# Rebuilds a kit's closed-mouth frames (M/B/P, F/V, frown) from the clean picture: the AI sheet redrew the whole muzzle
# or beak (blurry patches, a lost outline, the eye's edge cut). Inside the muzzle/beak the picture's own mouth line is
# painted out (filled from around it) and the frame's mouth line is drawn on; everything else is the picture as it is.
# usage: python3 tools/fix_closed.py <id> <seedx,seedy> <k,k,...>   (repo root)
import sys
import numpy as np, cv2
from PIL import Image
from scipy import ndimage
tid, seed, ks = sys.argv[1], [int(v) for v in sys.argv[2].split(',')], [int(k) for k in sys.argv[3].split(',')]
base = np.array(Image.open(f'faces/{tid}/base.webp').convert('RGBA')).astype(float)
lum = lambda a: a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11
ink = (lum(base) < 100) | (base[..., 3] < 128)
lab, n = ndimage.label(~ink); s0 = lab[seed[1], seed[0]]; c0 = base[lab == s0][:, :3].mean(0)
M = lab == s0
for _ in range(5):
    ring = ndimage.binary_dilation(M, iterations=12) & ~M
    for l in np.unique(lab[ring]):
        if l == 0: continue
        R = lab == l
        if R.sum() < 200 or R.sum() > 80000: continue
        if np.abs(base[R][:, :3].mean(0) - c0).sum() < 130: M |= R
M = ndimage.binary_fill_holes(ndimage.binary_closing(M, iterations=6))
inner = ndimage.binary_erosion(M, iterations=9)
old = ink & inner                                     # the picture's own mouth line(s) inside
rgb = np.clip(base[..., :3], 0, 255).astype(np.uint8)
clean = cv2.inpaint(rgb, ndimage.binary_dilation(old, iterations=2).astype(np.uint8) * 255, 6, cv2.INPAINT_TELEA).astype(float)
print('region', int(M.sum()), 'old line px', int(old.sum()))
for k in ks:
    f = np.array(Image.open(f'faces/{tid}/m{k}.webp').convert('RGBA')).astype(float)
    line = (lum(f) < 110) & inner & (f[..., 3] > 200)
    lab2, n2 = ndimage.label(line); sz = ndimage.sum(line, lab2, range(1, n2 + 1)); line = np.isin(lab2, [i + 1 for i, s in enumerate(sz) if s >= 40])
    a = np.clip(ndimage.gaussian_filter(ndimage.binary_dilation(line, iterations=1).astype(float), 0.8) * 1.4, 0, 1)[..., None]
    out = base.copy(); out[..., :3] = clean
    out[..., :3] = f[..., :3] * a + out[..., :3] * (1 - a)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA').save(f'faces/{tid}/m{k}.webp', lossless=True)
    print('fixed', k, int(line.sum()))
