# Kit repair (27 Nov, found checking all 115 bubble-gum Nibbles): the raccoon kit's round O mouth (frame 5) had its puffed
# lips cut off flat on the right, the light lip stopping in a straight up-and-down edge with no outline. Bubble-gum
# raccoons showed it (their whole mouth area is redrawn). The lip ring is closed with an arc of the same lip colour and
# outline, centred on the O, over the angles where it was cut.
# Usage: python3 tools/kit_ring_close.py <kit> <frame> cx cy r_lip r_out a0 a1   (27 Nov: 1992 5 645 689 59 67 -30 30)
import sys, numpy as np
from PIL import Image
ref, k = sys.argv[1], sys.argv[2]; cx, cy, R1, R2, A0, A1 = map(float, sys.argv[3:9])
M = np.asarray(Image.open(f'faces/{ref}/m{k}.webp').convert('RGBA')).astype(float)
yy, xx = np.mgrid[0:M.shape[0], 0:M.shape[1]]; r = np.hypot(xx - cx, yy - cy); ang = np.degrees(np.arctan2(yy - cy, xx - cx))
INK, LIP = np.array([12, 10, 10]), np.array([218, 198, 169])
sel = (ang >= A0) & (ang <= A1); out = M.copy()
lip = sel & (r >= 46) & (r < R1) & ~((M[..., 0] < 120) & (M[..., 3] > 200)); out[lip, :3] = LIP; out[lip, 3] = 255
ring = sel & (r >= R1) & (r <= R2); out[ring, :3] = INK; out[ring, 3] = 255
e = sel & (r > R2) & (r < R2 + 1.2); out[e, :3] = out[e, :3] * 0.5 + INK * 0.5
Image.fromarray(out.astype(np.uint8)).save(f'faces/{ref}/m{k}.webp', 'WEBP', lossless=True)
