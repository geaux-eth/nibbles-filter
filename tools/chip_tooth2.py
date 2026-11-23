# The broken-tooth beaver kit (faces/k929b), made again from the beaver kit (#929), 23 Nov. The first chip tool left bits
# of the old tooth's outline under the chip and a broken edge (GEAUX: 'the beaver tooth'). Here, in every picture: the
# right tooth's part below a slanted chip line goes, with its outline; what was behind it is filled from around it (lip and
# fur, or the open mouth); the chip line is drawn in the kit's ink, joined to the tooth's sides.
import numpy as np, cv2, shutil
from PIL import Image, ImageDraw
from scipy import ndimage
SRC, OUT = 'faces/929', 'faces/k929b'
A_, B_ = (640, 567), (684, 561)   # the chip line (its middle), left to right
INKW = 8
b0 = np.array(Image.open(f'{SRC}/base.webp').convert('RGBA')).astype(int); N = b0.shape[0]; yy, xx = np.mgrid[0:N, 0:N]
white = lambda a: (a[..., 3] > 200) & (a[..., :3].min(-1) >= 195) & (a[..., :3].max(-1) - a[..., :3].min(-1) <= 50)
# the right tooth in the picture: the white piece right of the line between the teeth
w = ndimage.binary_opening(white(b0) & (xx > 560) & (xx < 700) & (yy > 515) & (yy < 625), iterations=2)
lab, n = ndimage.label(w); right = max(range(1, n + 1), key=lambda i: xx[lab == i].mean())
tooth = lab == right
left = (lab > 0) & (lab != right) & (xx > 560)   # the other tooth: it and its outline are never touched
left_keep = ndimage.binary_dilation(left, iterations=10)
edge_y = A_[1] + (xx - A_[0]) * (B_[1] - A_[1]) / (B_[0] - A_[0])
below = ndimage.binary_dilation(tooth, iterations=2) & (yy > edge_y)
base_ink = (b0[..., :3].sum(-1) < 200) & (b0[..., 3] > 200)
tooth_out = base_ink & ndimage.binary_dilation(below, iterations=10) & (yy > edge_y + 3) & (xx > A_[0] + 5)   # the tooth's own outline below the chip, in the picture
for name in ['base'] + [f'm{i}' for i in range(0, 10)]:
    a = np.array(Image.open(f'{SRC}/{name}.webp').convert('RGBA'))
    rgb = a[..., :3].astype(int); ink = (rgb.sum(-1) < 200) & (a[..., 3] > 200)
    light = (rgb.sum(-1) > 450) & (rgb.max(-1) - rgb.min(-1) < 60)
    # the chipped-off part: the tooth below the line with its soft light edge, and its own outline there (only where the
    # picture has it: a mouth's edge running past it stays)
    # (the whole chipped-off part: the tooth below the line and everything of it out to its outline's outer edge, in one
    # piece, so no bit of the old outline is left behind)
    gone = ndimage.binary_fill_holes(ndimage.binary_dilation(below, iterations=12)) & (yy > edge_y + 4) & ~left_keep & (a[..., 3] > 0)
    # (the F/V: the upper teeth rest on the lower lip, whose line runs right along the teeth's bottoms: only the tooth's white
    # goes, the lip line under it stays)
    if name == 'm7': gone = gone & ~ink & ~((rgb.sum(-1) < 470) & (rgb.max(-1) - rgb.min(-1) < 60))
    # what shows there: in each column, what's just under the tooth's old bottom edge (the lip and fur, or the open mouth)
    out = a.copy()
    for x in range(N):
        ys = np.where(gone[:, x])[0]
        if not len(ys): continue
        y = ys.max() + 1
        while y < N - 1 and (ink[y, x] or light[y, x] or gone[y, x]) and y < ys.max() + 14: y += 1
        out[ys, x, :3] = a[y, x, :3]; out[ys, x, 3] = 255
    # (flat colours, like the art: each filled pixel to the nearest of the solid colours around it, not ink or tooth)
    ok = ~ink & ~light & ~ndimage.binary_dilation(gone, iterations=2) & (a[..., 3] > 200)
    near = ndimage.binary_dilation(gone, iterations=16) & ok
    cols = rgb[near]; q = (cols // 12) * 12; u, c = np.unique(q, axis=0, return_counts=True)
    pal = np.array([np.median(cols[(np.abs(q - v).sum(1) == 0)], 0) for v in u[c >= max(40, c.max() * 0.3)]])
    if len(pal):
        f = out[..., :3][gone].astype(int); d = ((f[:, None, :] - pal[None]) ** 2).sum(-1); f2 = pal[d.argmin(1)]
        tmp = np.zeros(gone.shape, int); tmp[gone] = d.argmin(1)
        tmp = ndimage.median_filter(tmp, size=5); out[..., :3][gone] = pal[tmp[gone]].astype(np.uint8)
    # (a line of this mouth's own that isn't the tooth's outline (the F/V's lower lip running under the tooth) stays)
    own_line = ink & gone & ~ndimage.binary_dilation(tooth_out | below, iterations=3)
    lbl, nl = ndimage.label(ndimage.binary_dilation(own_line, iterations=1) & ink)
    if nl:
        szl = ndimage.sum(np.ones_like(lbl), lbl, range(1, nl + 1)); own_line = np.isin(lbl, [i + 1 for i, v in enumerate(szl) if v >= 60]) & gone
        sm = ndimage.binary_dilation(own_line, iterations=1) & gone & ((rgb.sum(-1) < 470))   # with its soft edge
        out[sm] = a[sm]
    # (bits of the old outline left just outside it: small dark pieces near it, not part of a long line, go too)
    o3 = out[..., :3].astype(int); dk = (o3.sum(-1) < 470) & (o3.max(-1) - o3.min(-1) < 60) & (out[..., 3] > 100)
    lb, nb = ndimage.label(dk & ~ndimage.binary_dilation(left, iterations=4))
    if nb:
        szs = ndimage.sum(np.ones_like(lb), lb, range(1, nb + 1))
        bits = np.isin(lb, [i + 1 for i, v in enumerate(szs) if v < 260]) & ndimage.binary_dilation(gone, iterations=5)
        if bits.any():
            idx = ndimage.distance_transform_edt(bits, return_distances=False, return_indices=True)
            out[..., :3][bits] = out[..., :3][idx[0][bits], idx[1][bits]]
    # the chip line in the kit's ink, from the tooth's left side to its right side
    S = 4; m = Image.new('L', (N * S, N * S), 0); d = ImageDraw.Draw(m)
    d.line([(A_[0] * S, A_[1] * S), (B_[0] * S, B_[1] * S)], fill=255, width=INKW * S)
    for (x, y) in (A_, B_): d.ellipse([(x - INKW / 2) * S, (y - INKW / 2) * S, (x + INKW / 2) * S, (y + INKW / 2) * S], fill=255)
    al = np.array(m.resize((N, N), Image.BOX)).astype(np.float32)[..., None] / 255
    INK = np.median(rgb[ink & (yy > 500) & (yy < 650) & (xx > 540) & (xx < 720)], 0)
    out[..., :3] = (out[..., :3] * (1 - al) + INK * al).astype(np.uint8)
    Image.fromarray(out).save(f'{OUT}/{name}.webp', 'WEBP', lossless=True)
for k in range(5): shutil.copy(f'{SRC}/e{k}.webp', f'{OUT}/e{k}.webp')
# the kit picture keeps the whole tooth: then the chip is a change in every talking mouth, so the kit engine draws it on
# every broken-tooth beaver (with the chipped picture, its plain-mouthed twin's whole tooth showed through below the chip)
shutil.copy(f'{SRC}/base.webp', f'{OUT}/base.webp')
print('ok, tooth px', int(tooth.sum()), 'chipped', int(below.sum()))
