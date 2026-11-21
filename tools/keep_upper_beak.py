# Cock kit (#310): every talking beak keeps the kit picture's own upper beak, pixel for pixel, down to just above where
# the halves meet. The image tool redrew it a little (its outline and highlight a few pixels off), and the kit engine takes
# any change as part of the mouth: on a cock wearing sunglasses that sit on the beak, the lenses lost their bottom edge.
# Usage: python3 tools/keep_upper_beak.py
import numpy as np
from PIL import Image
from scipy import ndimage
b = np.array(Image.open('faces/310/base.webp').convert('RGBA'))
ink = (b[..., :3].astype(int).sum(-1) < 200) & (b[..., 3] > 128)
xs, ys = [], []
for x in range(470, 771, 5):
    r = [y for y in range(640, 700) if ink[y, x]]
    if r: xs.append(x); ys.append((r[0] + r[-1]) / 2 if r[-1] - r[0] < 14 else r[0] + 4)
P = np.polyfit(xs, ys, 2); yy, xx = np.mgrid[0:1000, 0:1000]
keep = (yy < np.polyval(P, np.clip(xx, 470, 770)) - 10) & (xx > 380) & (xx < 830) & (yy > 440)
soft = ndimage.gaussian_filter(keep.astype(np.float32), 1.5)[..., None]
for k in range(1, 10):
    m = np.array(Image.open(f'faces/310/m{k}.webp').convert('RGBA')).astype(np.float32)
    out = m * (1 - soft) + b.astype(np.float32) * soft
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(f'faces/310/m{k}.webp', 'WEBP', lossless=True)
print('ok')
