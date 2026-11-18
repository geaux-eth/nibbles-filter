# Robot Raccoon #3159: ten mouths made from his own picture. His lower jaw is a hinged robot jaw:
# it swings down from the back (by his helmet) to talk, showing a dark mouth behind his two buck teeth.
# Usage: python3 tools/robot_jaw.py [out_dir]   (default: faces/3159)
import sys, numpy as np
from PIL import Image
from scipy import ndimage

ID = 3159; X0, Y0, X1, Y1 = 464, 548, 851, 805          # the mouth box (layout "mb"), frames are this crop
out_dir = sys.argv[1] if len(sys.argv) > 1 else f'faces/{ID}'
base = np.array(Image.open(f'faces/{ID}/base.webp').convert('RGBA')).astype(np.float32)
H, W = base.shape[:2]
rgb, A = base[..., :3], base[..., 3]
ink = (rgb.sum(-1) < 200) & (A > 128)
lab, n = ndimage.label(~ink & (A > 128))
def comp_at(x, y):   # the part under a point (the nearest non-ink label in a small window)
    w = lab[y - 6:y + 7, x - 6:x + 7]; v = np.bincount(w[w > 0].ravel()); assert v.size > 1, (x, y)
    return lab == v.argmax()
jaw = comp_at(620, 712)                                   # the orange lower jaw
teeth = comp_at(654, 690) | comp_at(758, 676)             # the two buck teeth, hanging from the snout
upper = comp_at(600, 600) | comp_at(770, 600) | comp_at(715, 572)   # snout, its pale side, the nose
near = lambda m, r: ndimage.binary_dilation(m, iterations=r)
# the jaw's own ink: its outline, but not the snout's bottom line or the teeth's outlines
jaw_ink = ink & near(jaw, 10) & ~near(upper, 9) & ~near(teeth, 6)
J = jaw | jaw_ink
tooth_all = teeth | (ink & near(teeth, 7))
orange = np.array([227, 175, 78], np.float32)
INK = np.array([22, 22, 22], np.float32)
DARK = np.array([46, 24, 34], np.float32)
TONGUE = np.array([214, 92, 104], np.float32)


yy, xx = np.mgrid[0:H, 0:W]
from PIL import ImageDraw
jx = np.where(jaw.any(0))[0]; XA, XB = jx.min() + 3, jx.max() + 4
cols = np.arange(XA, XB + 1)
def smooth(v, k=9): return np.convolve(np.pad(v, k // 2, mode='edge'), np.ones(k) / k, mode='valid')
# the jaw's top edge (where it meets the snout), carried flat under the teeth and toward the back
t = np.array([np.where(jaw[:, x])[0].min() if jaw[:, x].any() else -1 for x in cols], float)
bad = (t < 0) | (cols < 553) | near(teeth, 4)[:, XA:XB + 1].any(0) | (np.abs(t - np.median(t)) > 8)
top = np.polyval(np.polyfit(cols[~bad], t[~bad], 2), cols) - 2
# the jaw's bottom edge: the middle of its outline
b = np.array([np.where(jaw_ink[:, x] | jaw[:, x])[0].max() if (jaw_ink[:, x] | jaw[:, x]).any() else -1 for x in cols], float)
bb = (b < 0); bot = np.polyval(np.polyfit(cols[~bb], b[~bb], 3), cols) - 5
INKW = 10; SS = 4
# everything the old jaw covered (it is drawn over again each frame)
old = ((jaw | jaw_ink) & (yy >= np.interp(xx, cols, top) - 3) | (near(tooth_all, 3) & (yy >= np.interp(xx, cols, top)) & (yy < np.interp(xx, cols, bot)))) & (xx >= XA - 6) & (xx <= XB + 6)

def poly(pts, k=SS): return [(x * k, y * k) for x, y in pts]
def frame(drop, tongue=0.0, grill=False, tongue_up=False):
    img = base.copy()
    if drop <= 0: return img
    u = np.clip((cols - XA) / (XB - XA), 0, 1); s = drop * (0.5 + 0.5 * u)
    # the layers, drawn 4x big then shrunk (smooth edges): the mouth's inside, then the jaw over it
    bx0, by0, bx1, by1 = XA - 20, int(top.min()) - 20, XB + 20, int(bot.max() + drop) + 20
    w, h = (bx1 - bx0) * SS, (by1 - by0) * SS
    o = lambda pts: [((x - bx0) * SS, (y - by0) * SS) for x, y in pts]
    def shape(pts):   # a filled outline as a mask, its corners rounded a little
        m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).polygon(o(pts), fill=255)
        m = np.array(m) > 127; return ndimage.binary_closing(ndimage.binary_opening(m, iterations=SS * 2), iterations=SS * 2)
    up = list(zip(cols, top)); jt = list(zip(cols, top + s)); jb = list(zip(cols, bot + s))
    Mm = shape(up + jt[::-1]); Mj = shape(jt + jb[::-1])
    yy4, xx4 = np.mgrid[0:h, 0:w]
    C = np.zeros((h, w, 4), np.float32)
    C[Mm] = list(DARK) + [255]
    if tongue > 0:
        i = int(len(cols) * (0.5 if not tongue_up else 0.62)); cx, cy = (cols[i] - bx0) * SS, (top[i] + s[i] - by0) * SS
        rx, ry = ((40 + 30 * tongue) * SS, (6 + 10 * tongue) * SS) if not tongue_up else (28 * SS, drop * 0.55 * SS)
        if tongue_up: cy -= drop * 0.2 * SS
        tg = Mm & (((xx4 - cx) / rx) ** 2 + ((yy4 - cy) / ry) ** 2 < 1); C[tg] = list(TONGUE) + [255]
    if grill:   # robot teeth: grill bars across the open mouth
        bars = ((xx4 // SS + bx0 - XA - 8) % 15 < 8) & Mm; C[bars] = [238, 238, 226, 255]
    r = INKW * SS / 2
    def stroke(M):
        din = ndimage.distance_transform_edt(M); dout = ndimage.distance_transform_edt(~M)
        return (M & (din <= r)) | (~M & (dout <= r))
    C[stroke(Mm)] = list(INK) + [255]
    C[Mj] = list(orange) + [255]
    C[stroke(Mj)] = list(INK) + [255]
    C[..., :3] *= C[..., 3:4] / 255
    L = np.array(Image.fromarray(C.astype(np.uint8), 'RGBa').resize((bx1 - bx0, by1 - by0), Image.BOX).convert('RGBA')).astype(np.float32)
    # clear the old jaw, lay the new layers on, then the buck teeth back on top (they stay up with the snout)
    reg = img[by0:by1, bx0:bx1]
    a = L[..., 3:4] / 255
    reg[..., :3] = reg[..., :3] * (1 - a) + L[..., :3] * a; reg[..., 3] = np.maximum(reg[..., 3], L[..., 3])
    left = old & ~np.pad(L[..., 3] > 0, ((by0, H - by1), (bx0, W - bx1)))
    img[left, :3] = DARK
    img[tooth_all] = base[tooth_all]
    return img

SPEC = {0:(0.01,), 1:(0.01,), 2:(16, 0.0), 3:(74, 1.0), 4:(30, 0.0, True), 5:(54, 0.6), 6:(26, 0.3), 7:(7, 0.0), 8:(36, 0.5, False, True), 9:(0.01,)}
for k, s in SPEC.items():
    img = frame(*s)
    crop = np.clip(img[Y0:Y1, X0:X1], 0, 255).astype(np.uint8)
    Image.fromarray(crop).save(f'{out_dir}/m{k}.webp', 'WEBP', lossless=True)
print('ok')
