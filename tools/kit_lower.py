# Kit clean-up (25 Nov, found by the all-Nibbles check): the image tool redrew the neck and collar lines under the jaw in
# some talking pictures (doubled, thin, shifted a few pixels), and every Nibble of the kind got faint lines across its
# collar in those frames. Below a frame's mouth and jaw nothing should move, so there each talking picture becomes the kit
# picture. The cut: the lowest pixel of the frame's mouth inside (reds, pinks, teeth white) plus a margin for the lip and
# jaw line; a frame with no mouth inside takes the highest cut of the others.
# A floor keeps the cut below the lowest lip of any frame (a fixed cut through a frame's lower lip cut it flat).
# Usage: python3 tools/kit_lower.py <kit> [margin] [floor] [frames]   (in place, lossless; back up first). DRY=1 reports only.
import sys, os, numpy as np
from PIL import Image
from scipy import ndimage
ref = sys.argv[1]; mg = int(sys.argv[2]) if len(sys.argv) > 2 else 40
fl = int(sys.argv[3]) if len(sys.argv) > 3 else 0
frames = [int(f) for f in sys.argv[4].split(',')] if len(sys.argv) > 4 else list(range(1, 10))
B = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(int)
cuts, Ms = {}, {}
for k in frames:
    M = np.array(Image.open(f'faces/{ref}/m{k}.webp').convert('RGBA')).astype(int); Ms[k] = M
    a = M[..., 3:4] / 255; F = (M[..., :3] * a + B[..., :3] * (1 - a)).astype(int)
    r, g = F[..., 0], F[..., 1]
    inside = (((r > g * 1.6) & (r - g > 60)) | ((F.min(-1) > 215) & (np.ptp(F, -1) < 30))) & (np.abs(F - B[..., :3]).sum(-1) > 60)
    inside = ndimage.binary_opening(inside, iterations=2)
    lab, n = ndimage.label(inside)
    if n:
        sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        if sz.max() > 300: big = lab == 1 + int(np.argmax(sz)); cuts[k] = int(np.where(big.any(1))[0].max()) + mg
if not cuts: sys.exit('no mouth found')
hi = min(cuts.values())
for k in frames:
    c = max(fl, cuts.get(k, hi)); M = Ms[k]
    a = M[..., 3:4] / 255; F = (M[..., :3] * a + B[..., :3] * (1 - a))
    ch = int((np.abs(F[c:] - B[c:, :, :3]).sum(-1) > 60).sum())
    print(f'm{k}', 'cut', c, '' if k in cuts else '(no mouth inside)', 'changed px', ch)
    if os.environ.get('DRY'): continue
    M[c:] = B[c:]
    Image.fromarray(M.astype(np.uint8)).save(f'faces/{ref}/m{k}.webp', 'WEBP', lossless=True)
