# Kit repair from a redrawn picture (26 Nov): the cock kit's open beaks had a scratchy back corner (dark flecks, a brown
# wedge, broken bits of lower beak) where the upper and lower beak meet. A clean redraw of the whole frame (Canva, lined up
# to the kit picture first) gives that corner; only the corner is taken from it, inside a box, never the upper beak (with
# its tip) or the lower beak's own body and their outlines, which stay the kit's. The redraw's colours are snapped to the
# kit picture's own colours round the beak, and its soft highlight to the flat beak yellow.
# Usage: python3 tools/kit_splice_corner.py <kit> <frame> <aligned redraw.png> x0 x1 y0 y1 upper_beak_max_y near low_min_y
#   (26 Nov, cock frame 3: 310 3 al.png 645 778 600 778 668 12 745). Writes m<frame>_new.webp and cmp_m<frame>.png here.
import sys, numpy as np
from PIL import Image
from scipy import ndimage
from scipy.cluster.vq import kmeans2
ref, k, alp = sys.argv[1], sys.argv[2], sys.argv[3]
x0, x1, y0, y1, UPY, NEAR, LOWY = map(int, sys.argv[4:11])
al = np.asarray(Image.open(alp).convert('RGB')).astype(float)
K = np.asarray(Image.open(f'faces/{ref}/m{k}.webp').convert('RGBA')).astype(float)
reg = K[480:800, 380:820]; px = reg[..., :3][reg[..., 3] > 250]
C, _ = kmeans2(px[::7], 9, minit='++', seed=1)
F = K[..., :3]
yellow = lambda: (F[..., 0] > 200) & (F[..., 1] > 170) & (F[..., 2] < 200) & (K[..., 3] > 200)
dark = (F.sum(2) < 200) & (K[..., 3] > 200)
# the upper beak (and pieces of it within NEAR px, its tip), and everything above its bottom in each column
yel = yellow(); yel[UPY:] = False; lab, _ = ndimage.label(yel); up = lab == lab[600, 700]
near = ndimage.binary_dilation(up, iterations=NEAR); up = np.isin(lab, np.unique(lab[near & yel])) & (lab > 0)
keepO = ndimage.binary_dilation(up, iterations=2) | (dark & (ndimage.distance_transform_edt(~up) < 11))
for x in range(x0, x1):
    ys = np.where(up[:, x])[0]
    if len(ys): keepO[:ys.max() + 1, x] = True
# the lower beak's own body below the corner, with its outline
yl = yellow(); yl[:LOWY] = False; yl[:, x1:] = False
lb, _ = ndimage.label(yl); low = np.isin(lb, [i for i in range(1, lb.max() + 1) if (lb == i).sum() > 1500])
keepO |= ndimage.binary_dilation(low, iterations=2) | (dark & (ndimage.distance_transform_edt(~low) < 11))
win = np.zeros(K.shape[:2], bool); win[y0:y1, x0:x1] = True
m = win & ~keepO
out = K.copy(); P = al[m]; d = ((P[:, None, :] - C[None]) ** 2).sum(2); idx = d.argmin(1); snap = C[idx]
yc = np.argmin(((C - [239, 201, 97]) ** 2).sum(1)); lc = np.argmin(((C - [254, 244, 160]) ** 2).sum(1)); snap[idx == lc] = C[yc]
# where the kit picture already shows the same kind of colour (its own brown, its own yellow), it stays as it is: the
# redraw's one brown in place of the kit's two left a straight step at the box's edge (the nibble check, 26 Nov)
group = lambda c: 0 if c.sum() < 150 else 1 if (c[0] > 200 and c[1] > 170 and c[2] < 200) else 2 if (c[0] < 180 and c[0] > c[2] + 25) else 3
gC = np.array([group(c) for c in C]); O = K[..., :3][m]; gO = gC[((O[:, None, :] - C[None]) ** 2).sum(2).argmin(1)]
same = (gO == gC[idx]) & (K[..., 3][m] > 200)
o = out[m]; bird = ~((o[:, 3] < 10) & (P.sum(1) < 90)) & ~same; o[bird, :3] = snap[bird]; o[bird, 3] = 255; out[m] = o
Image.fromarray(out.astype(np.uint8)).save(f'm{k}_new.webp', 'WEBP', lossless=True)
b = Image.open(f'faces/{ref}/base.webp').convert('RGBA'); W = Image.new('RGB', (800, 400))
for c, src in enumerate([f'faces/{ref}/m{k}.webp', f'm{k}_new.webp']):
    im = b.copy(); im.alpha_composite(Image.open(src).convert('RGBA')); bg = Image.new('RGBA', im.size, (255, 255, 255, 255)); bg.alpha_composite(im)
    W.paste(bg.convert('RGB').crop((560, 520, 820, 780)).resize((400, 400)), (c * 400, 0))
W.save(f'cmp_m{k}.png'); print('replaced', int(m.sum()))
