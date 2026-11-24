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
# the right tooth in a picture, and the chip measured from it (the talking pictures' teeth sit a few pixels off the kit
# picture's: each picture's own tooth, or the old outline's side was left standing beside the chip, 23 Nov)
def teeth(a):
    w = ndimage.binary_opening(white(a) & (xx > 560) & (xx < 700) & (yy > 515) & (yy < 625), iterations=2)
    lab, n = ndimage.label(w); right = max(range(1, n + 1), key=lambda i: xx[lab == i].mean())
    tooth = lab == right
    left = (lab > 0) & (lab != right) & (xx > 560)   # the other tooth: it and its outline are never touched
    return tooth, left
tooth0, _ = teeth(b0); X0, Y0 = np.where(tooth0.any(0))[0].max(), np.where(tooth0.any(1))[0].min()
def chip(a):
    tooth, left = teeth(a); dx = np.where(tooth.any(0))[0].max() - X0; dy = np.where(tooth.any(1))[0].min() - Y0
    A, B = (A_[0] + dx, A_[1] + dy), (B_[0] + dx, B_[1] + dy)
    edge_y = A[1] + (xx - A[0]) * (B[1] - A[1]) / (B[0] - A[0])
    below = ndimage.binary_dilation(tooth, iterations=2) & (yy > edge_y)
    ink = (a[..., :3].sum(-1) < 200) & (a[..., 3] > 200)
    tooth_out = ink & ndimage.binary_dilation(below, iterations=10) & (yy > edge_y + 3) & (xx > A[0] + 5)   # the tooth's own outline below the chip
    return tooth, left, ndimage.binary_dilation(left, iterations=10), edge_y, below, tooth_out, A, B
for name in ['base'] + [f'm{i}' for i in range(0, 10)]:
    a = np.array(Image.open(f'{SRC}/{name}.webp').convert('RGBA'))
    # (a talking picture covers only the mouth: where it's clear, the kit picture's whole tooth showed through, old outline
    # and all (the nibble check, 23 Nov: a brown box with black edges under the chip). So the chip's whole neighbourhood is
    # made solid first, the kit picture under the mouth)
    a_alpha = a[..., 3].copy()
    if name != 'base':
        bb = Image.open(f'{SRC}/base.webp').convert('RGBA'); bb.alpha_composite(Image.fromarray(a)); a = np.array(bb)
    tooth, left, left_keep, edge_y, below, tooth_out, A_f, B_f = chip(a.astype(int))
    rgb = a[..., :3].astype(int); ink = (rgb.sum(-1) < 200) & (rgb.max(-1) - rgb.min(-1) < 45) & (a[..., 3] > 200)   # (outline black, not the open mouth's dark red)
    light = (rgb.sum(-1) > 450) & (rgb.max(-1) - rgb.min(-1) < 60)
    # the chipped-off part: the tooth below the line with its soft light edge, and its own outline there (only where the
    # picture has it: a mouth's edge running past it stays)
    # (the whole chipped-off part: the tooth below the line and everything of it out to its outline's outer edge, in one
    # piece, so no bit of the old outline is left behind)
    gone = ndimage.binary_fill_holes(ndimage.binary_dilation(below, iterations=15)) & (yy > edge_y + 4) & ~left_keep & (a[..., 3] > 0)
    # (the F/V: the upper teeth rest on the lower lip, whose line runs right along the teeth's bottoms: only the tooth's white
    # goes, the lip line under it stays)
    if name == 'm7': gone = gone & ~ink & ~((rgb.sum(-1) < 470) & (rgb.max(-1) - rgb.min(-1) < 60))
    # what shows there: each pixel the colour of the nearest solid colour below or beside it (the lip and fur, the open
    # mouth's dark red and tongue), never the tooth's white, an outline, or the other tooth; where two different colours meet
    # inside the gap (fur against the open mouth) an outline is drawn between them, as the art has
    # (23 Nov, the nibble check: filling each column from just under the tooth left a brown box over the open AH; filling by
    # inpainting dragged the outlines in as dark blobs)
    upper = ndimage.binary_dilation(tooth & ~below, iterations=4) & ~gone
    out = a.copy()
    flat = np.ones(gone.shape, bool)
    for dy in range(-3, 4):
        for dx in range(-3, 4): flat &= np.abs(rgb - np.roll(rgb, (dy, dx), (0, 1))).sum(-1) <= 24   # (solid colour 7x7 around: not an outline's soft edge)
    # (from under the tooth only, in its own columns: what the tooth hid is what's under it, the open mouth's inside or the
    #  lower lip, not the fur beside it)
    txs = np.where(tooth.any(0))[0]
    src = flat & ~gone & ~ink & ~light & ~upper & ~left_keep & (a[..., 3] > 200) & (yy > edge_y + 4) & (xx >= txs.min() - 2) & (xx <= txs.max() + 2)
    idx = ndimage.distance_transform_edt(~src, return_distances=False, return_indices=True)
    out[..., :3][gone] = a[..., :3][idx[0][gone], idx[1][gone]]; out[..., 3][gone] = 255
    o = out[..., :3].astype(int)
    step = np.zeros(gone.shape, bool)
    for dy, dx in ((0, 1), (1, 0)):
        d = np.abs(o - np.roll(o, (-dy, -dx), (0, 1))).sum(-1) > 90
        step |= d & gone & np.roll(gone, (-dy, -dx), (0, 1))
    seam = ndimage.binary_dilation(step, iterations=3) & gone
    INK0 = np.median(rgb[ink & (yy > 500) & (yy < 650) & (xx > 540) & (xx < 720)], 0)
    out[..., :3][seam] = INK0.astype(np.uint8)
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
    d.line([(A_f[0] * S, A_f[1] * S), (B_f[0] * S, B_f[1] * S)], fill=255, width=INKW * S)
    for (x, y) in (A_f, B_f): d.ellipse([(x - INKW / 2) * S, (y - INKW / 2) * S, (x + INKW / 2) * S, (y + INKW / 2) * S], fill=255)
    al = np.array(m.resize((N, N), Image.BOX)).astype(np.float32)[..., None] / 255
    INK = np.median(rgb[ink & (yy > 500) & (yy < 650) & (xx > 540) & (xx < 720)], 0)
    out[..., :3] = (out[..., :3] * (1 - al) + INK * al).astype(np.uint8)
    if name != 'base':
        solid = ndimage.binary_dilation(below, iterations=30) | (a_alpha > 0)
        out[..., 3] = np.where(solid, out[..., 3], 0)
    Image.fromarray(out).save(f'{OUT}/{name}.webp', 'WEBP', lossless=True)
for k in range(5): shutil.copy(f'{SRC}/e{k}.webp', f'{OUT}/e{k}.webp')
# the kit picture keeps the whole tooth: then the chip is a change in every talking mouth, so the kit engine draws it on
# every broken-tooth beaver (with the chipped picture, its plain-mouthed twin's whole tooth showed through below the chip)
shutil.copy(f'{SRC}/base.webp', f'{OUT}/base.webp')
print('ok')
