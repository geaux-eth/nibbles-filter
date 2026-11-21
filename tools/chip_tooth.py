# The beaver kit for beavers with a broken tooth (faces/k929b): the beaver kit (#929) with its right tooth chipped in
# every picture (rest, the nine mouths), the way the collection draws it: the right tooth ends higher, with a straight,
# slightly slanted bottom edge. What the chipped-off part covered is filled from around it (the mouth, or the lip).
# Usage: python3 tools/chip_tooth.py
import numpy as np, cv2, shutil
from PIL import Image, ImageDraw
from scipy import ndimage

SRC, OUT = 'faces/929', 'faces/k929b'
X0, X1 = 637, 679                 # the right tooth (its white)
A_, B_ = (641, 571), (683, 565)   # the new bottom edge (its middle line), left to right
INKW = 8
for name in ['base'] + [f'm{i}' for i in range(0, 10)]:
    a = np.array(Image.open(f'{SRC}/{name}.webp').convert('RGBA'))
    rgb = a[..., :3].astype(int); N = a.shape[0]; yy, xx = np.mgrid[0:N, 0:N]
    white = (rgb.sum(-1) > 690) & (rgb.max(-1) - rgb.min(-1) < 40) & (a[..., 3] > 200)
    ink = (rgb.sum(-1) < 150) & (a[..., 3] > 200)
    edge_y = A_[1] + (xx - A_[0]) * (B_[1] - A_[1]) / (B_[0] - A_[0])
    band = (xx >= X0) & (xx <= X1 + 6) & (yy > edge_y) & (yy < 625)   # (not the line it shares with the left tooth)
    light = (rgb.sum(-1) > 480) & (rgb.max(-1) - rgb.min(-1) < 45)    # the tooth's white and its soft edge
    tooth = light & band & (xx >= X0 - 2) & (xx <= X1 + 2)
    if not tooth.any(): shutil.copy(f'{SRC}/{name}.webp', f'{OUT}/{name}.webp'); continue
    # the chipped-off part: its white (with its soft edge) and its right side's outline below the new edge; the line under
    # the teeth (the lip) and the line it shares with the left tooth stay
    bottom = np.array([np.where(tooth[:, x])[0].max() if tooth[:, x].any() else 0 for x in range(N)])
    side = ink & (xx >= X1 - 3) & (xx <= X1 + 8) & (yy > edge_y) & (yy < bottom[X1 - 4] - 2)
    gone = ((ndimage.binary_dilation(tooth, iterations=2) & ~ink & (xx >= X0 - 1)) | side) & (yy > edge_y + 1)
    # what shows there: the colour just under the teeth's bottom line (the lip and fur, or the open mouth)
    yb = int(bottom[X0 + 8:X1 - 6].max()); box = (~ink & ~light & (a[..., 3] > 200))[yb + 6:yb + 22, X0 + 6:X1 - 4]
    pix = rgb[yb + 6:yb + 22, X0 + 6:X1 - 4][box]
    if len(pix):   # (the most common colour there, not a blend of two)
        q = (pix // 12) * 12; u, c = np.unique(q, axis=0, return_counts=True); best = u[c.argmax()]; col = np.median(pix[(np.abs(q - best).sum(1) == 0)], 0)
    else: col = np.median(rgb[(yy > 600) & (yy < 640) & (xx > 700) & (xx < 720)], 0)
    out = a.copy(); out[..., :3][gone] = col.astype(np.uint8)
    # the new bottom edge, in the kit's own ink, joined to the tooth's sides
    S = 4; m = Image.new('L', (N * S, N * S), 0); d = ImageDraw.Draw(m)
    d.line([(A_[0] * S, A_[1] * S), (B_[0] * S, B_[1] * S)], fill=255, width=INKW * S)
    for (x, y) in (A_, B_): d.ellipse([(x - INKW / 2) * S, (y - INKW / 2) * S, (x + INKW / 2) * S, (y + INKW / 2) * S], fill=255)
    al = np.array(m.resize((N, N), Image.BOX)).astype(np.float32)[..., None] / 255
    INK = np.median(rgb[ink & (yy > 500) & (yy < 650) & (xx > 540) & (xx < 720)], 0)
    out[..., :3] = (out[..., :3] * (1 - al) + INK * al).astype(np.uint8)
    Image.fromarray(out).save(f'{OUT}/{name}.webp', 'WEBP', lossless=True)
for k in range(5): shutil.copy(f'{SRC}/e{k}.webp', f'{OUT}/e{k}.webp')
print('ok')
