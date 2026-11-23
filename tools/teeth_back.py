# Teeth back to white (22 Nov). kit_cleanup.py snapped every pixel within a few shades of a face colour to that face
# colour, and kit_crisp.py snapped clusters to the picture's colours: the off-white fangs and teeth (a cream close to a
# light muzzle) became muzzle-tan in every talking frame. GEAUX: "the bear mouth has brown teeth now". Every tooth pixel of
# the frame before the clean-up (near-white, little colour) that's no longer near-white is the old pixel again.
# Frames where teeth were taken out on purpose (O and OO: fangs gone, GEAUX 21 Nov) are left, except the beaver's buck
# teeth, which are the beaver (GEAUX 22 Nov: "the beaver's teeth disappear for some poses"): back in its O and OO too.
# Usage: python3 tools/teeth_back.py <ref> <commit before the clean-up> [--buck x0,y0,x1,y1]
import sys, subprocess, io, numpy as np
from PIL import Image
from scipy import ndimage
ref, old = sys.argv[1], sys.argv[2]
buck = [int(v) for v in sys.argv[sys.argv.index('--buck') + 1].split(',')] if '--buck' in sys.argv else None
def at(commit, k):
    return np.array(Image.open(io.BytesIO(subprocess.check_output(['git', 'show', f'{commit}:faces/{ref}/m{k}.webp']))).convert('RGBA')).astype(int)
white = lambda a: (a[..., 3] > 200) & (a[..., :3].min(-1) >= 195) & (a[..., :3].max(-1) - a[..., :3].min(-1) <= 50)
for k in range(1, 10):
    f = f'faces/{ref}/m{k}.webp'; a = np.array(Image.open(f).convert('RGBA')).astype(int)
    try: o = at(old, k)
    except Exception: continue
    if o.shape != a.shape: continue
    n = 0
    if k not in (5, 6):
        tw = ndimage.binary_opening(white(o), iterations=1)
        back = ndimage.binary_dilation(tw, iterations=1) & white(o) & ~white(a) & (a[..., :3].sum(-1) > 250)
        a[back] = o[back]; n = int(back.sum())
    elif buck:
        x0, y0, x1, y1 = buck; yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]; box = (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)
        tw = ndimage.binary_dilation(white(o) & box, iterations=3) & box   # the teeth and their outline
        a[tw] = o[tw]; n = int(tw.sum())
    Image.fromarray(a.astype(np.uint8)).save(f, 'WEBP', lossless=True)
    print(ref, k, 'teeth pixels back', n)
