# Buck teeth gone in the O and OO mouths (GEAUX, 21 Nov: teeth disappear with those shapes; a pucker hides them): the
# teeth (their white and outline) below the upper muzzle's line take the jaw colour; the mouth opening and the line stay.
# Usage: python3 tools/teeth_off.py <ref> <x0,y0,x1,y1> <jaw r,g,b> [frames, default 5 6]
import sys, numpy as np
from PIL import Image
from scipy import ndimage
ref = sys.argv[1]; x0, y0, x1, y1 = [int(v) for v in sys.argv[2].split(',')]; jaw = np.array([int(v) for v in sys.argv[3].split(',')])
frames = [int(a) for a in sys.argv[4:]] or [5, 6]
for k in frames:
    f = f'faces/{ref}/m{k}.webp'; a = np.array(Image.open(f).convert('RGBA')).astype(int); rgb = a[..., :3]; s = rgb.sum(-1)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]; box = (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)
    white = box & (rgb.min(-1) > 215); lab, n = ndimage.label(white); sz = ndimage.sum(white, lab, range(1, n + 1))
    teeth = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v > 300])
    # the upper muzzle (its light colour) and its line: never touched
    mz = box & (rgb[..., 0] > 220) & (rgb[..., 1] > 150) & (rgb[..., 1] < 215) & (rgb[..., 2] < 190); lz, nz = ndimage.label(mz)
    mz = np.isin(lz, [i + 1 for i, v in enumerate(ndimage.sum(mz, lz, range(1, nz + 1))) if v > 300]) if nz else mz   # (the muzzle itself: its big pieces, not orange edges along the teeth)
    muzzle = ndimage.binary_dilation(mz, iterations=1)
    line = ndimage.binary_dilation(muzzle, iterations=9) & (s < 250) & ~ndimage.binary_dilation(teeth, iterations=0)
    # the mouth opening (dark red) with its outline: never touched
    mc = box & (rgb[..., 0] > rgb[..., 1] * 2.2) & (rgb[..., 0] > 60) & (s < 300); lm, nm = ndimage.label(mc)   # the opening's dark red (not the reddish jaw)
    mc = np.isin(lm, [i + 1 for i, v in enumerate(ndimage.sum(mc, lm, range(1, nm + 1))) if v > 150]) if nm else mc
    mouth = ndimage.binary_dilation(mc, iterations=12)
    # the upper muzzle's line above the teeth: per column, the ink just under the light muzzle stays (about a line's width)
    keepline = np.zeros_like(teeth)
    for x in range(x0, x1 + 1):
        col = np.where(muzzle[:, x])[0]
        if len(col): yb = col.max(); keepline[yb:yb + 10, x] = True
    m = ndimage.binary_dilation(teeth, iterations=14) & box & ~muzzle & ~mouth & ~keepline & (np.abs(rgb - jaw).sum(-1) > 20)
    m |= teeth
    a[m, :3] = jaw; a[m, 3] = 255
    rgb = a[..., :3]; s = rgb.sum(-1)
    # the muzzle's line where it now meets the jaw directly (the teeth hung from it): drawn back, as thick as it is beside them
    edge = ndimage.binary_dilation(mz, iterations=9) & ~mz & box & (np.abs(rgb - jaw).sum(-1) < 30) & ndimage.binary_dilation(m, iterations=2)
    a[edge, :3] = [10, 6, 6]
    # specks left of the teeth's outline: the jaw
    rgb = a[..., :3]; dk = box & (rgb.sum(-1) < 200); ld, nd = ndimage.label(dk)
    if nd: sm = np.isin(ld, [i + 1 for i, v in enumerate(ndimage.sum(dk, ld, range(1, nd + 1))) if v < 120]); a[sm, :3] = jaw
    Image.fromarray(a.astype(np.uint8)).save(f, 'WEBP', lossless=True); print(ref, k, 'painted', int(m.sum()))
