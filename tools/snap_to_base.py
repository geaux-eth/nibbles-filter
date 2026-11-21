# A kit's talking frames made from image-tool edits: a pixel only a little different from the kit picture (the tool
# redrew the whole beak or muzzle a few shades or a pixel off) is put back to the kit picture's own. The kit engine takes
# any real difference as part of the mouth, and these near-misses came out as smudges and doubled lines on other Nibbles.
# Small specks of real change left alone (under 30 pixels) go back too.
# Usage: python3 tools/snap_to_base.py <ref> [threshold]
import sys, numpy as np
from PIL import Image
from scipy import ndimage
ref = sys.argv[1]; th = float(sys.argv[2]) if len(sys.argv) > 2 else 70
b = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(np.float32)
for k in range(1, 10):
    p = f'faces/{ref}/m{k}.webp'; m = np.array(Image.open(p).convert('RGBA')).astype(np.float32)
    d = np.abs(m[..., :3] - b[..., :3]).sum(-1) + np.abs(m[..., 3] - b[..., 3]) * 3
    real = (d > th) & ((m[..., 3] > 10) | (b[..., 3] > 10))   # (both see-through: the same)
    lab, n = ndimage.label(real); sz = ndimage.sum(real, lab, range(1, n + 1))
    real = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v >= 30])
    real = ndimage.binary_dilation(real, iterations=2)          # (the soft edge around a real change stays with it)
    out = np.where(real[..., None], m, b)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(p, 'WEBP', lossless=True)
    print(k, 'changed px', int(real.sum()))
