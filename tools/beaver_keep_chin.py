# Beaver kit (#929, and the chipped-tooth copy): the talking mouths keep the kit picture's own chin outline and everything
# below it (the image tool redrew the chin a few pixels off; on other beavers that edge lands on their collar and shirt and
# smeared them). Only the wide-open mouths (AH, and L), whose jaw really drops, keep their own chin.
# Usage: python3 tools/beaver_keep_chin.py
import numpy as np
from PIL import Image
from scipy import ndimage
for ref in ['929', 'k929b']:
    b = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(np.float32)
    ink = (b[..., :3].sum(-1) < 150) & (b[..., 3] > 128); N = b.shape[0]; yy, xx = np.mgrid[0:N, 0:N]
    top = np.full(N, N, float)
    for x in range(430, 790):
        r = [y for y in range(640, 740) if ink[y, x]]
        if r: top[x] = r[0]
    ok = top < N; xs = np.where(ok)[0]; top = np.interp(np.arange(N), xs, top[xs])
    keep = (yy > top[None, :] - 4) & (xx > 400) & (xx < 820)
    soft = ndimage.gaussian_filter(keep.astype(np.float32), 1.5)[..., None]
    for k in [1, 2, 4, 5, 6, 7, 9]:
        p = f'faces/{ref}/m{k}.webp'; m = np.array(Image.open(p).convert('RGBA')).astype(np.float32)
        Image.fromarray(np.clip(m * (1 - soft) + b * soft, 0, 255).astype(np.uint8)).save(p, 'WEBP', lossless=True)
    print(ref, 'chin line at x=600:', round(top[600]))
