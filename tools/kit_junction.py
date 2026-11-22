# A kit's talking frames at one spot (a box): the picture's own pixels, except where the frame's jaw really reaches past the
# picture's (its fur and the outline right round it) or shows the mouth. For a messed-up junction the image tool drew
# beside the jaw: the beaver kit's chin against the shoulder (ticks, a doubled shoulder line, a gap), which the kit engine
# carried onto every beaver as scribbles over its own clothes (GEAUX, 21 Nov: the bow).
# Usage: python3 tools/kit_junction.py <ref> <face r,g,b> x0,y0,x1,y1 [frames]
import sys, numpy as np
from PIL import Image
from scipy import ndimage
ref = sys.argv[1]; face = np.array([int(v) for v in sys.argv[2].split(',')]); x0, y0, x1, y1 = [int(v) for v in sys.argv[3].split(',')]
frames = [int(a) for a in sys.argv[4:]] or list(range(1, 10))
b = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(int); N = b.shape[0]
yy, xx = np.mgrid[0:N, 0:N]; box = (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)
fur = lambda a: (a[..., 3] > 128) & (np.abs(a[..., :3] - face).sum(-1) < 70)
mouthc = lambda a: (a[..., 3] > 128) & (((a[..., 0] > a[..., 1] * 1.4) & (a[..., 0] > a[..., 2] * 1.15) & (a[..., 0] > 40)) | (a[..., :3].min(-1) > 225)) & ~fur(a)
sil = lambda a: ndimage.binary_erosion(ndimage.binary_fill_holes(ndimage.binary_dilation(fur(a) | mouthc(a), iterations=6)), iterations=6)   # the face, its ink inside it too
bs = sil(b)
for k in frames:
    f = f'faces/{ref}/m{k}.webp'; a = np.array(Image.open(f).convert('RGBA')).astype(int)
    fs = sil(a); ink = (a[..., 3] > 128) & (a[..., :3].sum(-1) < 200)
    near = ndimage.distance_transform_edt(~fs) <= 9; outside_b = ndimage.distance_transform_edt(~bs) > 2
    take = fs | (ink & near & outside_b)                  # the frame's face, and its outline where it reaches past the picture's
    if (mouthc(a) & box).sum() < 50 and (fs & ~bs & box).sum() < 300: take = np.zeros_like(fs)   # (the mouth isn't here at all: all the picture's own)
    out = b.copy(); out[take] = a[take]
    revert = box & ~take & (np.abs(a - b).sum(-1) > 0)
    a[box] = out[box]
    Image.fromarray(a.astype(np.uint8)).save(f, 'WEBP', lossless=True)
    print(ref, k, 'junction: the picture\'s own again at', int(revert.sum()), 'px')
