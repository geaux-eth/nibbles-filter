# Cock kit (#310): the open beaks made from his own clean picture. The lower beak swings down from the back of the
# beak (by his cheek) like a hinged jaw, and the open mouth shows between the halves. The old drawn frames had soft,
# wobbly outlines, a squared-off upper beak with a doubled edge and a sliver of the old beak tip poking out on the right
# (worst on the wide-open "AH", the one a shout holds for seconds).
# Usage: python3 tools/cock_beak.py [out_dir] [frames]   (default: faces/310, frames 2,3,5,8)
import sys, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

out_dir = sys.argv[1] if len(sys.argv) > 1 else 'faces/310'
only = [int(k) for k in sys.argv[2].split(',')] if len(sys.argv) > 2 else [2, 3, 5, 8]
base = np.array(Image.open('faces/310/base.webp').convert('RGBA')).astype(np.float32)
H, W = base.shape[:2]; rgb, A = base[..., :3], base[..., 3]
ink = (rgb.sum(-1) < 200) & (A > 128)
yel = (rgb[..., 0] > 200) & (rgb[..., 1] > 165) & (rgb[..., 2] < 190) & (A > 128)
near = lambda m, r: ndimage.binary_dilation(m, iterations=r)
yy, xx = np.mgrid[0:H, 0:W]

# the line where the beak's halves meet: the middle of the ink stroke across the beak, x 470..770, then carried on
# (a gentle curve) back to the beak's outline at the cheek and forward to the tip
xs, ys = [], []
for x in range(470, 771, 5):
    r = [y for y in range(640, 700) if ink[y, x]]
    if r: xs.append(x); ys.append((r[0] + r[-1]) / 2 if r[-1] - r[0] < 14 else r[0] + 4)
P = np.polyfit(xs, ys, 2); top_at = lambda x: np.polyval(P, x)
# the beak's yellow, split in two by that line
beak_y = yel & near(yel, 0)
lab, n = ndimage.label(near(beak_y, 2) | (ink & near(beak_y, 3)))
beak = lab == lab[600, 600]
beak = ndimage.binary_fill_holes(beak)
cols = np.where(beak[560:780].any(0))[0]; XA, XB = 400, 790
below = yy > top_at(xx) + 5
low_y = beak_y & below & (xx >= XA) & (xx <= XB)
lab2, _ = ndimage.label(low_y); low_y = lab2 == lab2[700, 600]
# the jaw: its yellow and its own outline (the ink along its bottom, not the line above it)
J = low_y | (ink & near(low_y, 12) & below & (xx >= XA - 6))
J = ndimage.binary_fill_holes(J | (ink & near(J, 2) & below))
U = beak & ~J                                           # the upper beak (with the line under it) stays put, on top
jx = np.where(J.any(0))[0]; JA, JB = jx.min(), jx.max()
cx = np.arange(JA, JB + 1); top = top_at(cx)
# behind the jaw: whatever is next to it (his face and chest), filled from the nearest pixel that isn't beak or ink
keep = ~J & ~ink & ~beak & (A > 128)
FILL = ndimage.distance_transform_edt(~keep, return_distances=False, return_indices=True)
HX, HY = JA + 10, top_at(JA + 10)                     # the hinge: the back of the beak, by his cheek
DARK, DEEP, TONGUE, TSH, INK = (120, 30, 42), (86, 18, 30), (238, 120, 140), (205, 84, 108), (22, 22, 26)
SS, INKW = 4, 9

def frame(drop, tongue=0.0, narrow=0.0, tongue_up=False):
    img = base.copy()
    if drop <= 0: return img
    th = np.degrees(np.arctan2(drop, JB - HX))
    spr = np.zeros_like(base); spr[J] = base[J]
    sp = np.array(Image.fromarray(spr.astype(np.uint8), 'RGBA').convert('RGBa').rotate(-th, resample=Image.BICUBIC, center=(HX, HY)).convert('RGBA')).astype(np.float32)
    def turned(x, y):
        a = np.radians(th); dx, dy = x - HX, y - HY
        return HX + dx * np.cos(a) - dy * np.sin(a), HY + dx * np.sin(a) + dy * np.cos(a)
    img[J] = base[tuple(FILL[:, J])]
    # the open mouth between the line and the jaw's turned top edge; "narrow" pulls its front in (an O: rounder)
    # (it starts just past the smile's curl at the back, so no ink pokes out behind the beak)
    sel = cx >= 476
    up = [(x, y) for x, y in zip(cx[sel], top[sel])]
    jt = [turned(x, y + 6) for x, y in zip(cx[sel], top[sel])]
    # the front closes in a round curve from the upper beak down to the jaw's front, not a straight cut
    (ax, ay), (zx, zy) = up[-1], jt[-1]; bulge = 0.35 * (zy - ay)
    front = [(ax + (zx - ax) * u + bulge * 4 * u * (1 - u), ay + (zy - ay) * u) for u in np.linspace(0, 1, 12)]
    poly = up + front + jt[::-1]
    bx0, by0 = int(JA - 30), int(top.min() - 30); bx1, by1 = int(JB + 40), int(max(y for _, y in jt) + 60)
    w, h = (bx1 - bx0) * SS, (by1 - by0) * SS
    o = lambda pts: [((x - bx0) * SS, (y - by0) * SS) for x, y in pts]
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).polygon(o(poly), fill=255); M = np.array(m) > 127
    C = np.zeros((h, w, 4), np.float32); C[M] = DARK + (255,)
    y4, x4 = np.mgrid[0:h, 0:w]
    # the back of the throat a shade darker
    C[M & (x4 < (HX - bx0 + (JB - HX) * 0.35) * SS)] = DEEP + (255,)
    if tongue > 0:
        i = int(len(jt) * (0.5 if not tongue_up else 0.62)); tx, ty = (jt[i][0] - bx0) * SS, (jt[i][1] - by0) * SS
        rx, ry = (60 + 35 * tongue) * SS, (10 + 12 * tongue) * SS
        if tongue_up: ty -= drop * 0.35 * SS; rx, ry = 34 * SS, drop * 0.45 * SS
        T = M & (((x4 - tx) / rx) ** 2 + ((y4 - ty) / ry) ** 2 < 1)
        C[T] = TONGUE + (255,)
        C[T & (np.abs(x4 - tx) < 2.2 * SS) & (y4 < ty + ry * 0.2)] = TSH + (255,)   # the line down its middle
    r = INKW * SS / 2; din = ndimage.distance_transform_edt(M); dout = ndimage.distance_transform_edt(~M)
    C[(M & (din <= r)) | (~M & (dout <= r))] = INK + (255,)
    C[..., :3] *= C[..., 3:4] / 255
    L = np.array(Image.fromarray(C.astype(np.uint8), 'RGBa').resize((bx1 - bx0, by1 - by0), Image.BOX).convert('RGBA')).astype(np.float32)
    reg = img[by0:by1, bx0:bx1]; a = L[..., 3:4] / 255
    reg[..., :3] = reg[..., :3] * (1 - a) + L[..., :3] * a; reg[..., 3] = np.maximum(reg[..., 3], L[..., 3])
    a = sp[..., 3:4] / 255
    img[..., :3] = img[..., :3] * (1 - a) + sp[..., :3] * a; img[..., 3] = np.maximum(img[..., 3], sp[..., 3])
    img[U] = base[U]                                     # the upper beak stays whole, over the hinge
    return img

# frame -> (drop at the tip in px, tongue, narrow front, tongue up)
SPEC = {2:(48, 0.5), 3:(130, 1.0), 5:(92, 0.7), 8:(76, 0.5, 0.0, True)}
for k in only:
    img = frame(*SPEC[k])
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(f'{out_dir}/m{k}.webp', 'WEBP', lossless=True)
print('ok', JA, JB, (HX, round(HY)), [round(v) for v in top[::40]])
