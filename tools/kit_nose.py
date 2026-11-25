# Kit clean-up (25 Nov, found by the all-Nibbles check): the image tool redrew the nose's bottom line in some talking
# pictures (thinner, smudged, stray marks), so on every Nibble of the kind the nose line got a ragged, boxy edge in those
# frames. kit_upper.py can't be used where the teeth hang from the nose (it cut the beaver's teeth), so this keeps only
# the nose itself and its bottom line as in the kit picture: the nose's colour patch around a seed point, plus the dark
# line straight under it in each column (and 2 px of anti-aliasing). Teeth, mouth and fur below are left alone.
# Usage: python3 tools/kit_nose.py <kit> <seed x> <seed y> [frames]   (in place, lossless; back up first). DRY=1 reports only.
import sys, os, numpy as np
from PIL import Image
from scipy import ndimage
ref, sx, sy = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
frames = [int(f) for f in sys.argv[4].split(',')] if len(sys.argv) > 4 else range(1, 10)
B = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(int)
C = B[..., :3]; col = C[sy, sx]
patch = np.abs(C - col).sum(-1) < 70
lab, _ = ndimage.label(patch); nose = lab == lab[sy, sx]
nose = ndimage.binary_fill_holes(nose)
dark = C.sum(-1) < 200
R = nose.copy(); AA = np.zeros_like(nose)
for x in np.where(nose.any(0))[0]:
    y = int(np.where(nose[:, x])[0].max()) + 1; g = 0
    while y < 1000 and not dark[y, x] and g < 3: R[y, x] = True; y += 1; g += 1
    while y < 1000 and dark[y, x]: R[y, x] = True; y += 1
    for _ in range(2):
        if y < 1000: AA[y, x] = True; y += 1
R = ndimage.binary_closing(R, iterations=2); AA &= ~R
print(ref, 'nose', int(nose.sum()), 'kept', int(R.sum()), 'rows', np.where(R.any(1))[0].min(), np.where(R.any(1))[0].max())
for k in frames:
    p = f'faces/{ref}/m{k}.webp'
    M = np.array(Image.open(p).convert('RGBA')).astype(int)
    a = M[..., 3:4] / 255; F = (M[..., :3] * a + C * (1 - a))
    ch = int((R & (np.abs(F - C).sum(-1) > 60)).sum())
    print(f'm{k}', 'changed px', ch)
    if os.environ.get('DRY'): continue
    r, g, b = F[..., 0], F[..., 1], F[..., 2]
    inside = ((r > g * 1.6) & (r - g > 60)) | ((F.min(-1) > 215) & (np.ptp(F, -1) < 30))
    K = R | (AA & ~inside)
    M[K] = B[K]
    Image.fromarray(M.astype(np.uint8)).save(p, 'WEBP', lossless=True)
