# Puts a kit's new talking frames (built from a fresh sheet by the builder, full 1000px PNGs) into faces/<id>/: above the
# jaw row the new frame, below it the picture itself (the sheet's neck is never used); the picture's own jaw outline goes
# back on wherever the new mouth doesn't cover it; anything the new frame left see-through over the face is the picture.
# usage: python3 tools/kit_from_sheet.py <id> <dir with m<k>.png> <k,k> <jaw row> [jaw-line row range y0,y1] [top row x0,x1]
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
tid, src, ks, jr = sys.argv[1], sys.argv[2], [int(k) for k in sys.argv[3].split(',')], int(sys.argv[4])
ly0, ly1 = [int(v) for v in sys.argv[5].split(',')] if len(sys.argv) > 5 else (jr - 40, jr + 6)
top, cx0, cx1 = [int(v) for v in sys.argv[6].split(',')] if len(sys.argv) > 6 else (0, 0, 1000)   # the new frame only inside rows top..jr, columns cx0..cx1
base = np.array(Image.open(f'faces/{tid}/base.webp').convert('RGBA')).astype(float)
lum = lambda a: a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11
bl = lum(base) < 90; bl[:ly0] = False; bl[ly1:] = False; bl = ndimage.binary_dilation(bl, iterations=1)
for k in ks:
    f = np.array(Image.open(f'{src}/m{k}.png').convert('RGBA')).astype(float)
    hole = (f[..., 3] < 200) & (base[..., 3] > 200); f[hole] = base[hole]
    # the face's own colours (from the picture around the mouth); a frame pixel that's none of these, nor a mouth colour,
    # nor ink, is the sheet's edge or background: the picture there
    zone = np.zeros(f.shape[:2], bool); zone[max(0, jr - 220):jr] = True
    fc = base[zone & (base[..., 3] > 200) & (lum(base) > 120)][:, :3]
    q = (fc // 24).astype(int); keys, cnt = np.unique(q[:, 0] * 10000 + q[:, 1] * 100 + q[:, 2], return_counts=True)
    pal = [np.array([k // 10000, (k // 100) % 100, k % 100]) * 24 + 12 for k, c in zip(keys, cnt) if c > 800]
    rr, gg, bb = f[..., 0], f[..., 1], f[..., 2]
    ok = (lum(f) < 110) | ((rr > 100) & (gg < rr * 0.5) & (bb > gg * 0.8)) | ((rr > 200) & (bb > 140) & (gg < 170)) | ((lum(f) > 225) & (np.ptp(f[..., :3], -1) < 30))
    for c in pal: ok |= np.abs(f[..., :3] - c).sum(-1) < 70
    stray = ~ok & (f[..., 3] > 0); stray[jr:] = False; f[stray] = base[stray]
    out_sil = ndimage.binary_erosion(base[..., 3] < 128, iterations=2); f[out_sil] = base[out_sil]   # nothing past the picture's own outline
    # the sheet's picture is soft and speckled (it was compressed): smoothed, keeping the lines sharp
    import cv2
    sm = cv2.bilateralFilter(np.clip(f[..., :3], 0, 255).astype(np.uint8), 7, 40, 5).astype(float)
    f[..., :3] = np.where((lum(f) < 90)[..., None], f[..., :3], sm)
    # and the face's flat colours snapped to the picture's own exact ones (every Nibble's kit maps these colour by colour:
    # an in-between shade from the sheet would map to the wrong skin and speckle)
    exact = []
    for c in pal:
        near = np.abs(fc - c).sum(-1) < 40
        if near.sum() > 200: exact.append(np.median(fc[near], 0))
    rr, gg, bb = f[..., 0], f[..., 1], f[..., 2]
    mouth = ((rr > 100) & (gg < rr * 0.5) & (bb > gg * 0.8)) | ((rr > 200) & (bb > 140) & (gg < 170)) | ((lum(f) > 225) & (np.ptp(f[..., :3], -1) < 30))
    flat = (lum(f) >= 110) & ~mouth & (f[..., 3] > 200); flat[jr:] = False
    if exact:
        E = np.array(exact); P = f[flat][:, :3]; d = np.abs(P[:, None, :] - E[None]).sum(-1); best = d.argmin(1)
        snap = d.min(1) < 90; P[snap] = E[best[snap]]; f[flat, :3] = P
    m = np.zeros(f.shape[:2]); m[top:jr, cx0:cx1] = 1
    a = ndimage.gaussian_filter(m, 4)[..., None]
    out = f * a + base * (1 - a)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    mc = ((r > 100) & (g < r * 0.5) & (b > g * 0.8)) | ((r > 200) & (b > 140) & (g < 170)) | ((lum(f) > 225) & (np.ptp(f[..., :3], -1) < 30))
    line = bl & ~ndimage.binary_dilation(mc, iterations=3)
    la = ndimage.gaussian_filter(line.astype(float), 0.7)[..., None]
    out = base * la + out * (1 - la)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA').save(f'faces/{tid}/m{k}.webp', quality=95, method=6)
    print('frame', k)
