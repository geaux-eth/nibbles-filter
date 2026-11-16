# Repairs a kit reference's talking frames that the AI sheet drew badly around the mouth (a muzzle outline left out, a
# blurry patch on the fur): outside the mouth's own drawing (its lines, inside, teeth, tongue, grown a little) the frame
# takes the original picture's pixels, softly blended at the edge. "copy0" frames have no mouth drawn at all and become
# the resting mouth.
# usage: python3 tools/fix_kit_frames.py <id> <k,k,...> [copy0:k,k]   (repo root)
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
tid, ks = sys.argv[1], [int(k) for k in sys.argv[2].split(',') if k]
copy0 = [int(k) for k in sys.argv[3].split(':')[1].split(',')] if len(sys.argv) > 3 else []
base = np.array(Image.open(f'faces/{tid}/base.webp').convert('RGBA')).astype(float)
m0 = Image.open(f'faces/{tid}/m0.webp')
for k in copy0: m0.save(f'faces/{tid}/m{k}.webp', lossless=True); print('copied m0 ->', k)
def lum(a): return a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11
for k in ks:
    f = np.array(Image.open(f'faces/{tid}/m{k}.webp').convert('RGBA')).astype(float)
    d = np.abs(f[..., :3] - base[..., :3]).sum(-1)
    # the mouth's drawing: what changed AND is a line, the dark inside, red, pink or white teeth (not a lighter/darker fur blur)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    mouthy = (lum(f) < 90) | ((r > 120) & (g < r * 0.6)) | ((r > 200) & (b > 140) & (g < 170)) | ((lum(f) > 225) & (np.ptp(f[..., :3], -1) < 30))
    m = (d > 80) & mouthy & (f[..., 3] > 200)
    m = ndimage.binary_opening(m, iterations=1)
    lab, n = ndimage.label(m); sizes = ndimage.sum(m, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 60])
    # and the base's own mouth it replaces must go too: the area of the base's mouth drawing near it
    bm = ((lum(base) < 90) | ((base[..., 0] > 200) & (base[..., 2] > 140) & (base[..., 1] < 170))) & (base[..., 3] > 200)
    region = ndimage.binary_dilation(keep, iterations=14)
    near_base_mouth = bm & ndimage.binary_dilation(keep, iterations=40) & (np.abs(f[..., :3] - base[..., :3]).sum(-1) > 80)
    region |= ndimage.binary_dilation(near_base_mouth, iterations=3)
    a = ndimage.gaussian_filter(region.astype(float), 3)
    a = np.clip(a * 1.6, 0, 1)[..., None]
    out = f * a + base * (1 - a)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA').save(f'faces/{tid}/m{k}.webp', lossless=True)
    print('fixed', tid, k, int(keep.sum()))
