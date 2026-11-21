# A kit's mouths straight from image-tool edits that line up with the kit picture pixel for pixel (Gemini, fit 0.999):
# the whole lower face is taken from the edit inside a box (the jaw, chin and its outline, which kit_from_edits.py's soft
# mouth area cut short on a wolf's wide-open jaw), the edit's white background stays see-through where the picture is,
# and nothing outside the box changes. Then tools/kit_keep_clothes.py puts the picture's own clothes back.
# Usage: python3 tools/kit_from_aligned.py <ref> <x0,y0,x1,y1> <frame>=<aligned picture> ...
import sys, numpy as np
from PIL import Image
from scipy import ndimage
ref = sys.argv[1]; x0, y0, x1, y1 = [int(v) for v in sys.argv[2].split(',')]
b = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(float); N = b.shape[0]
yy, xx = np.mgrid[0:N, 0:N]; box = (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)
a_soft = ndimage.gaussian_filter(box.astype(float), 2)[..., None]   # (a soft edge, in case the box crosses anything)
for arg in sys.argv[3:]:
    k, pic = arg.split('='); e = np.array(Image.open(pic).convert('RGB').resize((N, N))).astype(float)
    white = e.min(-1) > 238; lab, _ = ndimage.label(white); edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])); bgw = np.isin(lab, edge[edge > 0])
    out = b.copy(); ea = np.where(bgw, 0, 255).astype(float)   # (the edit says background: see-through, also where the picture had a fang)
    E = np.dstack([e, ea]); out = b * (1 - a_soft) + E * a_soft
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(f'faces/{ref}/m{k}.webp', 'WEBP', lossless=True); print(k, 'taken')
