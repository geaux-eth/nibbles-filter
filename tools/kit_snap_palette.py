# Kit clean-up for mouths fitted from a new sheet (24 Nov, found by the all-Nibbles check): the sheet's beak and face are
# drawn in its own shades (a slightly different yellow, soft blurred edges), which the kit engine doesn't know how to
# recolour for each Nibble: a white cock's lower beak came out olive and its outline went missing. Here every pixel a
# talking picture changes is snapped to the nearest of the kit picture's own colours round the mouth (the face, beak, ink),
# or kept when it's a mouth colour the kit picture doesn't have (the inside, tongue, teeth), so the engine maps it like the
# rest of the face.
# Usage: python3 tools/kit_snap_palette.py <kit> <frame,...>   (in place, lossless; back up first)
import sys, numpy as np
from PIL import Image
from scipy import ndimage
from scipy.cluster.vq import kmeans2
ref, ks = sys.argv[1], [int(k) for k in sys.argv[2].split(',')]
B = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(float); N = B.shape[0]
for k in ks:
    f = f'faces/{ref}/m{k}.webp'; M = np.array(Image.open(f).convert('RGBA')).astype(float)
    vis = (M[..., 3] > 128) | (B[..., 3] > 128)
    ch = vis & (np.abs(M[..., :3] - B[..., :3]).sum(-1) > 30)
    ring = ndimage.binary_dilation(ch, iterations=40) & (B[..., 3] > 200)
    px = B[ring][:, :3]; px = px[np.random.default_rng(0).choice(len(px), min(len(px), 30000), replace=False)]
    pal, lab = kmeans2(px, 12, minit='++', seed=2)
    pal = pal[np.bincount(lab, minlength=len(pal)) > 200]
    C = M[ch][:, :3]
    r, g, b = C[:, 0], C[:, 1], C[:, 2]
    mouth = ((r > g * 1.35) & (r > b * 1.05) & (r > 60) & (r - g > 40)) | ((C.min(1) > 200) & (np.ptp(C, 1) < 40))   # (reds, pinks, teeth)
    d = ((C[:, None, :] - pal[None]) ** 2).sum(-1); near = pal[d.argmin(1)]; dmin = np.sqrt(d.min(1))
    ink = C.sum(1) < 200
    out = C.copy()
    snap = ~mouth & ~ink & (dmin < 90)
    out[snap] = near[snap]
    out[ink] = np.median(B[(B[..., :3].sum(-1) < 150) & (B[..., 3] > 200)][:, :3], 0)
    M2 = M.copy(); M2[ch, :3] = out; M2[ch, 3] = 255
    Image.fromarray(np.clip(M2, 0, 255).astype(np.uint8)).save(f, 'WEBP', lossless=True)
    print(ref, k, 'changed', int(ch.sum()), 'snapped', int(snap.sum()), 'ink', int(ink.sum()))
