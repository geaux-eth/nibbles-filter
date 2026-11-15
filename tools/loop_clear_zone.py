# Clear the model's own face and lines off a loop body inside the area a set of faces (their hole masks) can cover,
# so a face set into the body never fades over a half-hidden line or eye.
# python3 tools/loop_clear_zone.py traits/ghostslime hole1.png hole2.png ...
import sys, glob, cv2, numpy as np
d, holes = sys.argv[1], sys.argv[2:]
KEEP_ABOVE = 325   # lines above the model's brows
zone = np.zeros((1000, 1000), bool)
for h in holes: zone |= cv2.imread(h, cv2.IMREAD_UNCHANGED)[..., 3] > 4
zone = cv2.dilate(zone.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
for f in sorted(glob.glob(f'{d}/f*.webp')):
    im = cv2.imread(f, cv2.IMREAD_UNCHANGED); a = im[..., 3]
    edge = cv2.dilate((a < 200).astype(np.uint8), np.ones((41, 41), np.uint8)) > 0     # keep the body's outline
    b, g, r = [im[..., k].astype(int) for k in range(3)]
    body = (g > 150) & (r < 140) & (g - r > 70) & (a > 200)                              # teal skin and its green drips
    m = (~body) & (a > 100) & zone & ~edge
    # the crease high on the head (every face of this kind has it too, in the same place) stays
    n, lab, st, cen = cv2.connectedComponentsWithStats(((~body) & (a > 100) & ~edge).astype(np.uint8), connectivity=8)
    for k in range(1, n):
        if cen[k][1] < KEEP_ABOVE and st[k][4] > 30: m[lab == k] = False
    m = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=3) > 0
    m &= ~edge
    # fill: the body's own colours around it, smoothly (normalised blur of the unmasked body)
    w = (body & ~m).astype(np.float32)
    src = im[..., :3].astype(np.float32)
    num = np.dstack([cv2.GaussianBlur(src[..., k] * w, (0, 0), 14) for k in range(3)]); den = cv2.GaussianBlur(w, (0, 0), 14)[..., None]
    for s in (30, 60):   # far from any body pixel: a wider look
        n2 = np.dstack([cv2.GaussianBlur(src[..., k] * w, (0, 0), s) for k in range(3)]); d2 = cv2.GaussianBlur(w, (0, 0), s)[..., None]
        low = den < 0.05; num = np.where(low, n2, num); den = np.where(low, d2, den)
    fill = num / np.maximum(den, 1e-4)
    out = src.copy(); out[m] = fill[m]
    soft = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.2)[..., None]
    im[..., :3] = np.clip(src * (1 - soft) + out * soft, 0, 255).astype(np.uint8)
    cv2.imwrite(f, im, [cv2.IMWRITE_WEBP_QUALITY, 92])
    print(f, int(m.sum()))
