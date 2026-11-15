# Snaps a built-in Nibble's mouth frames (faces/<id>/m*.webp) to the colours of its own picture.
# AI-drawn mouth sheets come back a shade off (a whiter skull, a warmer snout) and slightly blotchy, which shows
# as a box around the mouth. Flat areas of each frame take the nearest colour the original uses around the mouth;
# outlines and anti-aliased edges (where the colour changes fast) are left alone, and colours the picture
# doesn't have nearby (a tongue, a dark open mouth) are kept.
# usage: python3 tools/snap_mouths.py <id> [<id> ...]   (run from the repo root; reads layout from index.html)
import sys, re, json
import numpy as np
from PIL import Image
src = open('index.html').read()
for tid in sys.argv[1:]:
    m = re.search(r'\n  %s: \{ bg:[^\n]*layout:(\{.*?\})[ ,}]' % tid, src)
    lt = json.loads(m.group(1)); x0, y0, x1, y1 = lt['mb']
    base = np.array(Image.open(f'faces/{tid}/base.webp').convert('RGBA')).astype(np.int32)
    p = 40; area = base[max(0, y0 - p):y1 + p, max(0, x0 - p):x1 + p]
    solid = area[area[..., 3] > 250][:, :3]
    # the picture's flat colours near the mouth: quantise, keep colours that cover a real area
    q = Image.fromarray(solid.reshape(-1, 1, 3).astype(np.uint8)).quantize(colors=24, method=Image.Quantize.MEDIANCUT)
    pal = np.array(q.getpalette()[:72]).reshape(-1, 3); cnt = np.bincount(np.array(q).ravel(), minlength=24)
    pal = pal[cnt > len(solid) * 0.004]
    for k in range(10):
        f = f'faces/{tid}/m{k}.webp'; im = np.array(Image.open(f).convert('RGBA')).astype(np.int32)
        rgb = im[..., :3]
        d = np.abs(rgb[:, :, None, :] - pal[None, None, :, :]).sum(-1); j = d.argmin(-1); dm = d.min(-1)
        # flat pixels only: every neighbour within a small step
        g = np.zeros(dm.shape, np.int32)
        for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0), (1, 1), (-1, -1)):
            sh = np.roll(np.roll(rgb, dy, 0), dx, 1); g = np.maximum(g, np.abs(rgb - sh).sum(-1))
        flat = (g < 60) & (im[..., 3] > 250)
        ok = (dm < 70) & flat
        rgb[ok] = pal[j[ok]]
        # where the frame is only a shade off the original picture at the same spot, it takes the original's pixel
        # (the mouth panels redraw the cheeks and snout too: their tone wanders, the shapes don't)
        h, w = rgb.shape[:2]; orig = base[y0:y0 + h, x0:x0 + w, :3]
        if orig.shape[:2] == (h, w):
            near = (np.abs(im[..., :3] - orig).sum(-1) < 115) & flat & (base[y0:y0 + h, x0:x0 + w, 3] > 250)
            rgb[near] = orig[near]
        im[..., :3] = rgb
        Image.fromarray(im.astype(np.uint8), 'RGBA').save(f, 'WEBP', lossless=True)
    print(tid, 'palette', len(pal))
