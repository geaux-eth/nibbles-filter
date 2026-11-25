# Kit clean-up (24 Nov, found by the all-Nibbles check): the image tool redrew the nose and upper snout in some talking
# pictures a few pixels off (the ghost's frown had a doubled, cut nose), and every Nibble of the kind copied it. Above the
# mouth's opening nothing should move, so there every talking picture becomes the kit picture.
# The line: the highest new mouth-inside pixel (reds, pinks, teeth white) of any frame, less a margin.
# Usage: python3 tools/kit_upper.py <kit> [margin]    (in place, lossless; back up first)
import sys, numpy as np
from PIL import Image
from scipy import ndimage
ref = sys.argv[1]; mg = int(sys.argv[2]) if len(sys.argv) > 2 else 14
B = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(int)
top = 1000; Ms = {}
for k in range(1, 10):
    M = np.array(Image.open(f'faces/{ref}/m{k}.webp').convert('RGBA')).astype(int); Ms[k] = M
    F = B.copy(); a = M[..., 3:4] / 255; F[..., :3] = (M[..., :3] * a + B[..., :3] * (1 - a)).astype(int)
    r, g, b = F[..., 0], F[..., 1], F[..., 2]
    inside = (((r > g * 1.6) & (r - g > 60)) | ((F[..., :3].min(-1) > 215) & (np.ptp(F[..., :3], -1) < 30))) & (np.abs(F[..., :3] - B[..., :3]).sum(-1) > 60)
    inside = ndimage.binary_opening(inside, iterations=2)
    lab, n = ndimage.label(inside)
    if n:
        sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); big = lab == 1 + int(np.argmax(sz))
        if sz.max() > 300: top = min(top, int(np.where(big.any(1))[0].min()))
line = top - mg
print(ref, 'mouth top', top, 'kept above', line)
for k, M in Ms.items():
    M[:line] = B[:line]
    Image.fromarray(M.astype(np.uint8)).save(f'faces/{ref}/m{k}.webp', 'WEBP', lossless=True)
