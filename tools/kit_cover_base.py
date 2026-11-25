# Kit clean-up (24 Nov, found by the nibble check on ghosts): a talking frame that doesn't quite cover the base picture's own
# mouth line leaves a bit of it showing (the ghost kit's smile curl stayed as a tick beside every talking mouth, and as a
# box edge the check caught on 20-odd ghosts). Here, on each frame, the base's mouth line where the frame lets it show
# through is painted over with the nearest plain face colour of that frame.
# The base's mouth line: dark pieces of the base that most talking frames paint over.
# Usage: python3 tools/kit_cover_base.py <kit> [frames]   (in place, lossless; back up first). DRY=1 only reports.
import sys, os, numpy as np
from PIL import Image
from scipy import ndimage
ref = sys.argv[1]; ks = [int(k) for k in sys.argv[2].split(',')] if len(sys.argv) > 2 else list(range(1, 10))
ks = [k for k in ks if os.path.exists(f'faces/{ref}/m{k}.webp')]
B = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(float); N = B.shape[0]
lumB = B[..., :3].sum(-1)
M = {k: np.array(Image.open(f'faces/{ref}/m{k}.webp').convert('RGBA')).astype(float) for k in ks}
dark = (lumB < 240) & (B[..., 3] > 200)
lab, n = ndimage.label(dark)
cov = np.zeros(n + 1); size = np.bincount(lab.ravel(), minlength=n + 1)
seen = lambda O: O[..., :3] * (O[..., 3:4] / 255) + B[..., :3] * (1 - O[..., 3:4] / 255)   # a frame as seen (over the base)
for k in ks:
    c = dark & (np.abs(seen(M[k]) - B[..., :3]).sum(-1) > 100)   # the base's dark changed on this frame
    frac = np.bincount(lab[c], minlength=n + 1) / np.maximum(size, 1)
    cov += frac > 0.1
line = np.isin(lab, [i for i in range(1, n + 1) if cov[i] >= max(3, len(ks) * 0.5) and size[i] < N * N * 0.01])
if not line.any(): print(ref, 'no mouth line found'); sys.exit()
lineG = ndimage.binary_dilation(line, iterations=3)
for k in ks:
    O = M[k]; C = seen(O); lumC = C.sum(-1)
    face = np.median(C[ndimage.binary_dilation(line, iterations=10) & ~lineG & (lumC > 500)], 0)
    # leftovers: dark pieces of this frame lying on the base's line that are small (the frame's own line, long, stays)
    dk = lumC < face.sum() - 150; fl, fn = ndimage.label(dk); fs = np.bincount(fl.ravel(), minlength=fn + 1)
    onl = np.bincount(fl[line & dk], minlength=fn + 1)
    left = np.isin(fl, [i for i in range(1, fn + 1) if fs[i] < 400 and onl[i] >= fs[i] * 0.5])
    # and where the frame paints the old line over with face, the base's own face colour beside the line, exactly (the image
    # tool's paint-over came out a shade lighter: a pale streak on every pink or green Nibble where the smile used to be)
    over = lineG & (lumC >= face.sum() - 40) & (np.abs(C - B[..., :3]).sum(-1) > 6) & (np.abs(C - face).sum(-1) < 40)   # (face-coloured: not teeth or a shine the frame draws)
    if over.any() and not os.environ.get('NOOVER'):
        bsrc = ~lineG & (B[..., 3] > 200) & (lumB >= face.sum() - 40)
        _, (by, bx) = ndimage.distance_transform_edt(~bsrc, return_indices=True)
        ys, xs = np.nonzero(over); near = np.hypot(by[ys, xs] - ys, bx[ys, xs] - xs) < 12
        ys, xs = ys[near], xs[near]; O = O.copy(); O[ys, xs, :3] = B[by[ys, xs], bx[ys, xs], :3]; O[ys, xs, 3] = 255; M[k] = O; C = seen(O); lumC = C.sum(-1)
        print(ref, k, 'evened', len(ys))
        if not os.environ.get('DRY'): Image.fromarray(np.clip(O, 0, 255).astype(np.uint8)).save(f'faces/{ref}/m{k}.webp', 'WEBP', lossless=True)
    if not left.any(): print(ref, k, 'clean'); continue
    bad = ndimage.binary_dilation(left, iterations=2) & lineG & (lumC < face.sum() - 40)
    src = ~ndimage.binary_dilation(bad, iterations=1) & (lumC >= face.sum() - 40)
    _, (iy, ix) = ndimage.distance_transform_edt(~src, return_indices=True)
    O2 = O.copy(); ys, xs = np.nonzero(bad)
    O2[ys, xs, :3] = C[iy[ys, xs], ix[ys, xs]]; O2[ys, xs, 3] = 255
    print(ref, k, 'painted', int(bad.sum()), 'pieces', int(fn and len(np.unique(fl[left]))))
    if not os.environ.get('DRY'): Image.fromarray(np.clip(O2, 0, 255).astype(np.uint8)).save(f'faces/{ref}/m{k}.webp', 'WEBP', lossless=True)
