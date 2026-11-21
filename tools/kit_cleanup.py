# A kit's talking frames cleaned the way the wolf's were (21 Nov): everything outside the face and mouth is the kit
# picture's own pixels (the image tool's redrawn clothes, collars and re-shades came through onto other Nibbles as scraps
# and smudges), and the face's own colours are snapped back to the picture's exact colours (a muzzle a shade off read
# as a smudge on every Nibble of the kind).
# Usage: python3 tools/kit_cleanup.py <ref> [--noflat] [--keep x0,y0,x1,y1]
#   --noflat: leave the face colours (a gradient body: fire, slime)   --keep: a box never touched (something removed on purpose)
import sys, numpy as np
from PIL import Image
from scipy import ndimage
ref = sys.argv[1]; flat = '--noflat' not in sys.argv
keep = None
if '--keep' in sys.argv: keep = [int(v) for v in sys.argv[sys.argv.index('--keep') + 1].split(',')]
b = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(int); N = b.shape[0]
F = {k: np.array(Image.open(f'faces/{ref}/m{k}.webp').convert('RGBA')).astype(int) for k in range(1, 10)}
F = {k: v for k, v in F.items() if v.shape == b.shape}
yy, xx = np.mgrid[0:N, 0:N]
# the mouth zone: where at least two frames change the picture
hits = sum((np.abs(v - b).sum(-1) > 60).astype(int) for v in F.values())
zone = ndimage.binary_opening(hits >= 2, iterations=2); lab, n = ndimage.label(zone)
if n: sz = ndimage.sum(zone, lab, range(1, n + 1)); zone = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v >= 300])
ys, xs = np.where(zone); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
near = ndimage.binary_dilation(zone, iterations=40)
# the face's own colours: the commonest solid, non-ink colours of the picture around the mouth
rgb = b[..., :3]; op = b[..., 3] > 200; s = rgb.sum(-1)
q = (rgb // 8); key = q[..., 0] * 1024 + q[..., 1] * 32 + q[..., 2]
cand = near & op & (s >= 200) & ~((rgb[..., 0] > rgb[..., 1] * 1.6) & (rgb[..., 0] > 90) & (rgb[..., 2] > rgb[..., 1] * 0.9))
vals, cnt = np.unique(key[cand], return_counts=True); tot = cnt.sum()
faces = []
for v in vals[np.argsort(-cnt)][:6]:
    m = cand & (key == v)
    if m.sum() < tot * 0.04: break
    faces.append(np.median(rgb[m], axis=0).astype(int))
def kinds(a):
    rgb = a[..., :3]; op = a[..., 3] > 128; s = rgb.sum(-1)
    skin = op & np.any([np.abs(rgb - c).sum(-1) < 60 for c in faces], axis=0)
    mouth = op & (((rgb[..., 0] > rgb[..., 1] * 1.4) & (rgb[..., 0] > rgb[..., 2] * 1.15) & (rgb[..., 0] > 40)) | (rgb.min(-1) > 185))   # reds down to the darkest maroon, pinks, teeth (white or cream)
    return skin, mouth, op, s
bs, bm, bo, bsum = kinds(b)
bfacey = ndimage.binary_dilation(bs | bm, iterations=5)
kb = np.zeros((N, N), bool)
if keep: kb = (xx >= keep[0]) & (xx <= keep[2]) & (yy >= keep[1]) & (yy <= keep[3])
for k, a in F.items():
    sk, mo, op, ss = kinds(a)
    facey = ndimage.binary_dilation(sk | mo, iterations=5) | (ndimage.binary_dilation(ndimage.binary_dilation(sk | mo, iterations=2) & (ss < 200), iterations=8) & (ss < 200))
    revert = op & ~facey & bo & ~bfacey & (np.abs(a - b).sum(-1) > 0)                       # clothes both: the picture's own
    revert |= op & bo & ~sk & ~mo & ~bs & ~bm & (np.abs(a[..., :3] - b[..., :3]).sum(-1) < 150) & ~ndimage.binary_dilation(mo | bm, iterations=6)   # a re-shade: the picture's own (never in or at a mouth)
    revert &= ~kb
    a[revert] = b[revert]
    fl = 0
    if flat:   # face colours a shade off: the picture's exact colour (only near the mouth)
        box = near & ~kb & (a[..., 3] > 200)
        for c in faces:
            m = box & (np.abs(a[..., :3] - c).sum(-1) < 34) & (np.abs(a[..., :3] - c).sum(-1) > 0); a[m, :3] = c; fl += int(m.sum())
    Image.fromarray(a.astype(np.uint8)).save(f'faces/{ref}/m{k}.webp', 'WEBP', lossless=True)
    print(ref, k, 'kept', int(revert.sum()), 'flattened', fl)
print(ref, 'face colours', [tuple(c) for c in faces])
