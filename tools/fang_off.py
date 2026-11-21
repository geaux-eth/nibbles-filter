# Fangs and teeth gone in the O and OO mouths (GEAUX, 21 Nov: they disappear with those shapes): inside a hand-set box
# just under the lip the fang hangs from, everything that isn't the lighter skin beside it becomes the skin behind it.
# Usage: python3 tools/fang_off.py <ref> <x0,y0,x1,y1> <behind r,g,b> <keep r,g,b> [frames, default 5 6]
import sys, numpy as np
from PIL import Image
ref = sys.argv[1]; x0, y0, x1, y1 = [int(v) for v in sys.argv[2].split(',')]
behind = np.array([int(v) for v in sys.argv[3].split(',')]); keep = np.array([int(v) for v in sys.argv[4].split(',')])
frames = [int(a) for a in sys.argv[5:]] or [5, 6]
for k in frames:
    f = f'faces/{ref}/m{k}.webp'; a = np.array(Image.open(f).convert('RGBA')).astype(int)
    r = a[y0:y1 + 1, x0:x1 + 1]; m = np.abs(r[..., :3] - keep).sum(-1) > 30
    r[m, :3] = behind; r[m, 3] = 255
    Image.fromarray(a.astype(np.uint8)).save(f, 'WEBP', lossless=True); print(ref, k, 'painted', int(m.sum()))
