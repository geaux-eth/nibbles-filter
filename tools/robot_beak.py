# Robot Cock #546: ten mouths made from his own picture. His lower beak (and the band it hangs from) is a hinged
# robot jaw: it swings down from the back, by the hose at his cheek, and the open mouth shows between the beaks.
# The old Canva frames left a see-through ghost of the beak tip and redrew the hose beside it differently each frame.
# Usage: python3 tools/robot_beak.py [out_dir]   (default: faces/546)
import sys, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ID = 546; X0, Y0 = 450, 508; W0, H0 = 381, 392           # the mouth box's corner (layout "mb") and the frames' size (taller than the box: the open jaw hangs lower)
out_dir = sys.argv[1] if len(sys.argv) > 1 else f'faces/{ID}'
base = np.array(Image.open(f'faces/{ID}/base.webp').convert('RGBA')).astype(np.float32)
H, W = base.shape[:2]; rgb, A = base[..., :3], base[..., 3]
ink = (rgb.sum(-1) < 200) & (A > 128)
lab, n = ndimage.label(~ink & (A > 128))
def comp_at(x, y):
    w = lab[y - 6:y + 7, x - 6:x + 7]; v = np.bincount(w[w > 0].ravel()); assert v.size > 1, (x, y)
    return lab == v.argmax()
near = lambda m, r: ndimage.binary_dilation(m, iterations=r)
band, low = comp_at(520, 740), comp_at(660, 740)              # the lower band (with its rivet) and the round lower beak
upper = comp_at(560, 600) | comp_at(680, 620)                 # the beak's top half
hose = comp_at(450, 710)                                      # the hose plugged into his cheek (stays put, in front)
jaw = band | low
rivets = ink & ~near(~jaw & ~ink, 1) & near(jaw, 1)           # ink spots inside the jaw (its rivet, the line between its parts)
jaw_ink = ink & near(jaw, 11) & ~near(upper, 8) & ~near(hose, 3)
J = jaw | jaw_ink | ndimage.binary_fill_holes(jaw | jaw_ink) & ink
hose_all = hose | (ink & near(hose, 9) & ~near(jaw, 3))
yy, xx = np.mgrid[0:H, 0:W]
jx = np.where(jaw.any(0))[0]; XA, XB = jx.min() + 2, jx.max() - 1
cols = np.arange(XA, XB + 1)
t = np.array([np.where(jaw[:, x])[0].min() if jaw[:, x].any() else -1 for x in cols], float)
ok = t > 0; top = np.polyval(np.polyfit(cols[ok], t[ok], 2), cols) - 3        # where the beak's halves meet
b = np.array([np.where(J[:, x])[0].max() if J[:, x].any() else -1 for x in cols], float)
DARK, TONGUE, INK = (40, 22, 34), (214, 92, 104), (22, 22, 22)
BODY = tuple(int(v) for v in np.median(base[(lab == lab[800, 560])][:, :3], 0))   # the blue chest behind the jaw
FILL = ndimage.distance_transform_edt(~(~J & ~ink & (A > 128)), return_distances=False, return_indices=True)
HX, HY = XA + 6, 712                                                            # hinge: the back of the jaw, by the hose
SS, INKW = 4, 9

def frame(drop, tongue=0.0, grill=False, tongue_up=False):
    img = base.copy()
    if drop <= 0: return img
    th = np.degrees(np.arctan2(drop, XB - HX))
    # the jaw as a picture of its own, turned about the hinge (the front drops the most)
    spr = np.zeros_like(base); spr[J] = base[J]
    sp = Image.fromarray(spr.astype(np.uint8), 'RGBA').convert('RGBa').rotate(-th, resample=Image.BICUBIC, center=(HX, HY)).convert('RGBA')
    sp = np.array(sp).astype(np.float32)
    def turned(x, y):   # where a point on the jaw goes
        a = np.radians(th); dx, dy = x - HX, y - HY
        return HX + dx * np.cos(a) - dy * np.sin(a), HY + dx * np.sin(a) + dy * np.cos(a)
    # 1. behind the old jaw: whatever is next to it (his chest below, the background in front)
    img[J] = base[tuple(FILL[:, J])]
    # 2. the open mouth: from where the halves met down to the jaw's new top edge, closed at the front
    up = list(zip(cols, top)); jt = [turned(x, y) for x, y in zip(cols, top)]
    bx0, by0, bx1, by1 = XA - 30, int(top.min()) - 30, XB + 40, int(max(y for _, y in jt)) + 40
    w, h = (bx1 - bx0) * SS, (by1 - by0) * SS
    o = lambda pts: [((x - bx0) * SS, (y - by0) * SS) for x, y in pts]
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).polygon(o(up + jt[::-1]), fill=255); M = np.array(m) > 127
    C = np.zeros((h, w, 4), np.float32); C[M] = DARK + (255,)
    yy4, xx4 = np.mgrid[0:h, 0:w]
    if tongue > 0:
        i = int(len(cols) * (0.55 if not tongue_up else 0.7)); cx, cy = (jt[i][0] - bx0) * SS, (jt[i][1] - by0) * SS
        rx, ry = ((45 + 30 * tongue) * SS, (7 + 10 * tongue) * SS) if not tongue_up else (26 * SS, drop * 0.5 * SS)
        if tongue_up: cy -= drop * 0.2 * SS
        C[M & (((xx4 - cx) / rx) ** 2 + ((yy4 - cy) / ry) ** 2 < 1)] = TONGUE + (255,)
    if grill:
        C[M & ((xx4 // SS + bx0 - XA) % 15 < 8) & (xx4 // SS + bx0 > XA + 30)] = (238, 238, 226, 255)
    r = INKW * SS / 2; din = ndimage.distance_transform_edt(M); dout = ndimage.distance_transform_edt(~M)
    C[(M & (din <= r)) | (~M & (dout <= r))] = INK + (255,)
    C[..., :3] *= C[..., 3:4] / 255
    L = np.array(Image.fromarray(C.astype(np.uint8), 'RGBa').resize((bx1 - bx0, by1 - by0), Image.BOX).convert('RGBA')).astype(np.float32)
    reg = img[by0:by1, bx0:bx1]; a = L[..., 3:4] / 255
    reg[..., :3] = reg[..., :3] * (1 - a) + L[..., :3] * a; reg[..., 3] = np.maximum(reg[..., 3], L[..., 3])
    # 3. the jaw on top, then the hose (it plugs in over the jaw's back end)
    a = sp[..., 3:4] / 255
    img[..., :3] = img[..., :3] * (1 - a) + sp[..., :3] * a; img[..., 3] = np.maximum(img[..., 3], sp[..., 3])
    img[hose_all] = base[hose_all]
    return img

SPEC = {0:(0,), 1:(0,), 2:(16, 0.0), 3:(64, 1.0), 4:(26, 0.0, True), 5:(48, 0.6), 6:(24, 0.3), 7:(6, 0.0), 8:(34, 0.5, False, True), 9:(0,)}
for k, s in SPEC.items():
    img = frame(*s)
    crop = np.clip(img[Y0:Y0 + H0, X0:X0 + W0], 0, 255).astype(np.uint8)
    Image.fromarray(crop).save(f'{out_dir}/m{k}.webp', 'WEBP', lossless=True)
print('ok', XA, XB, BODY)
