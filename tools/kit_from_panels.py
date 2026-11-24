# A kit's talking mouths from a Gemini sheet of panels on green (23 Nov: the nine mouths the all-Nibbles check found
# drawn with a flaw). Each panel is cut off the green, lined up with the kit picture (scale and shift, by the outline), and
# only its mouth goes into the kit: inside the area the kit's mouths change (grown a little), the panel; everywhere else
# the kit picture. Then the panel's colours within a shade of the kit picture's become the kit picture's own (no
# re-shaded patches), and anything outside the mouth goes back (tools/kit_trim.py does that part).
# Usage: python3 tools/kit_from_panels.py <kit> <sheet> <frame>[,<frame>...]   (frames left to right; back up first)
import sys, os, numpy as np, cv2
from PIL import Image
from scipy import ndimage
ref, sheet, ks = sys.argv[1], sys.argv[2], [int(k) for k in sys.argv[3].split(',')]
B = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(np.float32); N = B.shape[0]
S = np.array(Image.open(sheet).convert('RGB')).astype(np.float32)
r, g, b = S[..., 0], S[..., 1], S[..., 2]
green = (g > 150) & (g > r * 1.4) & (g > b * 1.4)
# panels: runs of columns with picture in them
col = (~green).sum(0) > 3; runs = []; x = 0
while x < len(col):
    if col[x]:
        x0 = x
        while x < len(col) and col[x]: x += 1
        if x - x0 > 100: runs.append((x0, x))
    x += 1
assert len(runs) == len(ks), f'{len(runs)} panels found, {len(ks)} frames given'
bm = (B[..., 3] > 128).astype(np.float32)
def place(P, a, s, dx, dy):
    M = np.float32([[s, 0, dx], [0, s, dy]])
    return cv2.warpAffine(P, M, (N, N), flags=cv2.INTER_LINEAR, borderValue=0), cv2.warpAffine(a, M, (N, N), flags=cv2.INTER_LINEAR, borderValue=0)
# the mouth area: where the kit's current talking mouths change anything, grown
zone0 = np.zeros((N, N), bool)
for j in range(1, 10):
    m = np.array(Image.open(f'faces/{ref}/m{j}.webp').convert('RGBA')).astype(np.float32)
    vis = (m[..., 3] > 128) | (B[..., 3] > 128)
    zone0 |= vis & (np.abs(m[..., :3] - B[..., :3]).sum(-1) > 60)
zone0 = ndimage.binary_dilation(ndimage.binary_opening(zone0, iterations=2), iterations=24)
# (the fine fit weighs the ink round the mouth: the face there has to line up, not the whole picture (a cock's beak, drawn a
#  little smaller, came out with two upper edges))
near0 = ndimage.binary_dilation(zone0, iterations=60) & ~zone0 | zone0
for (x0, x1), k in zip(runs, ks):
    P = S[:, x0:x1].copy(); pa = (~green[:, x0:x1]).astype(np.float32)
    pa = ndimage.binary_opening(pa > 0, iterations=2).astype(np.float32)
    # despill: green fringe pixels toward their neighbours' colour
    edge = ndimage.binary_dilation(pa == 0, iterations=2) & (pa > 0)
    P[edge, 1] = np.minimum(P[edge, 1], (P[edge, 0] + P[edge, 2]) / 2 + 20)
    # line up: the panel's outline against the kit picture's, over scale and shift (coarse at 1/4 size, then fine)
    best = (-1, 0, 0, 0)
    ys, xs = np.where(pa > 0); hp = ys.max() - ys.min(); yb, xb = np.where(bm > 0); hb = yb.max() - yb.min()
    s0 = hb / max(1, hp)
    small = lambda a: cv2.resize(a, (N // 4, N // 4), interpolation=cv2.INTER_AREA)
    bs = small(bm)
    for s in np.arange(s0 * 0.9, s0 * 1.1, 0.005):
        pw = cv2.resize(pa, None, fx=s / 4, fy=s / 4, interpolation=cv2.INTER_AREA)
        if pw.shape[0] > bs.shape[0] * 2 or pw.shape[1] > bs.shape[1] * 2: continue
        pad = np.zeros((bs.shape[0] * 3, bs.shape[1] * 3), np.float32); oy, ox = bs.shape[0], bs.shape[1]
        pad[oy:oy + bs.shape[0], ox:ox + bs.shape[1]] = bs
        res = cv2.matchTemplate(pad, pw.astype(np.float32), cv2.TM_CCORR_NORMED)
        _, v, _, loc = cv2.minMaxLoc(res)
        if v > best[0]: best = (v, s, (loc[0] - ox) * 4, (loc[1] - oy) * 4)
    v, s, dx, dy = best
    # fine: the dark lines (ink) against the kit picture's, ±6 px and ±1% scale
    bl = (B[..., :3].sum(-1) < 200) & (B[..., 3] > 200)
    bl = ndimage.gaussian_filter((bl & near0).astype(np.float32), 2)
    fine = (-1, s, dx, dy)
    for ss in (np.arange(s * 0.96, s * 1.041, 0.005) if not os.environ.get("QUICK") else [s]):
        for ddx in (range(-16, 17, 2) if not os.environ.get("QUICK") else [0]):
            for ddy in (range(-16, 17, 2) if not os.environ.get("QUICK") else [0]):
                Pw, aw = place(P, pa, ss, dx + ddx, dy + ddy)
                il = ndimage.gaussian_filter(((Pw.sum(-1) < 200) & (aw > 0.5) & near0).astype(np.float32), 2)
                sc = (il * bl).sum() / np.sqrt((il * il).sum() * (bl * bl).sum() + 1e-6)
                if sc > fine[0]: fine = (sc, ss, dx + ddx, dy + ddy)
    sc, s, dx, dy = fine
    Pw, aw = place(P, pa, s, dx, dy)
    print(ref, k, 'outline fit %.3f, ink fit %.3f, scale %.3f, shift %d,%d' % (v, sc, s, dx, dy))
    zone = zone0 & (aw > 0.5) & (B[..., 3] > 128)
    # (UP=<px>: the area reaches that much further up, for a mouth whose upper part (a cock's whole beak) the panel draws
    #  its own way: cut through, the two beaks showed as two upper edges)
    import os
    if os.environ.get('UP'): u = int(os.environ['UP']); zs = np.zeros_like(zone); zs[:-u] = zone[u:]; zone = (zone | (ndimage.binary_dilation(zone, iterations=8) & np.maximum.accumulate(zs[::-1], 0)[::-1] & False) | np.any([np.roll(zone, -d, 0) for d in range(0, u, 4)], 0)) & (aw > 0.5) & (B[..., 3] > 128)
    # (never the eyes: they're the blink layers' and this Nibble's own)
    for e in range(1, 5):
        fe = f'faces/{ref}/e{e}.webp'
        if os.path.exists(fe): zone &= ~ndimage.binary_dilation(np.array(Image.open(fe).convert('RGBA'))[..., 3] > 20, iterations=8)
    soft = ndimage.gaussian_filter(zone.astype(np.float32), 1.5)[..., None]
    out = B.copy(); new = np.dstack([Pw, np.full((N, N), 255, np.float32)])
    out = B * (1 - soft) + new * soft
    # within a shade of the kit picture: the kit picture's own (no re-shaded patches)
    near = (np.abs(out[..., :3] - B[..., :3]).sum(-1) < 40) & (B[..., 3] > 250)
    out[near] = B[near]
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(f'faces/{ref}/m{k}.webp', 'WEBP', lossless=True)
