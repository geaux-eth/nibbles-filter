# Cleans a built-in Nibble's mouth frames (faces/<id>/m1-m9.webp) so only the mouth itself changes.
# AI-drawn mouth sheets also redraw things around the mouth (a jacket fold, a fang's edge, a faint ghost of the
# green screen). Each frame keeps its own pixels only where it really differs from the original picture AND that
# difference belongs to the mouth (it touches the area the wide-open "AH" mouth changes); everywhere else in the
# box it takes the original picture's pixels.
# usage: python3 tools/clean_mouths.py <id> [<id> ...]   (repo root)
import sys, re, json
import numpy as np
from PIL import Image
from scipy import ndimage
src = open('index.html').read()
def over(t, bg): a = t[..., 3:4] / 255; return t[..., :3] * a + bg * (1 - a)
for tid in sys.argv[1:]:
    m = re.search(r'\n  %s: \{ bg:.(#\w+).[^\n]*layout:(\{.*?\})[ ,}]' % tid, src)
    bg = np.array([int(m.group(1)[i:i+2], 16) for i in (1, 3, 5)], float); x0, y0, x1, y1 = json.loads(m.group(2))['mb']
    base = np.array(Image.open(f'faces/{tid}/base.webp').convert('RGBA')).astype(float)
    fr = {k: np.array(Image.open(f'faces/{tid}/m{k}.webp').convert('RGBA')).astype(float) for k in range(1, 10)}
    h, w = fr[3].shape[:2]; bb = base[y0:y0 + h, x0:x0 + w]
    if bb.shape[:2] != (h, w): print(tid, 'skip'); continue
    bc = over(bb, bg)
    def diff(f):
        d = np.abs(over(f, bg) - bc).sum(-1) > 70
        return ndimage.binary_closing(ndimage.binary_opening(d, iterations=1), iterations=2)
    # green-screen ghosts: half-see-through pixels where the picture is background become background;
    # see-through holes inside the face (not reaching real background) get the picture filled in behind them
    for f in fr.values():
        ghost = (f[..., 3] < 235) & (bb[..., 3] < 10); f[ghost] = 0
        lab, _ = ndimage.label(f[..., 3] < 250)
        outside = np.unique(lab[(bb[..., 3] < 10) & (lab > 0)])
        hole = (f[..., 3] < 250) & (bb[..., 3] > 250) & (~np.isin(lab, outside) | (f[..., 3] > 10))   # half-see-through over the face: always filled
        a = f[..., 3:4] / 255; comp = f * a + bb * (1 - a); comp[..., 3] = 255; f[hole] = comp[hole]
    # the mouth: what changes in most frames (the part every sound moves), grown a little
    heat = sum(diff(f).astype(int) for f in fr.values())
    lab, n = ndimage.label(heat >= 4)
    if not n: print(tid, 'no mouth'); continue
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); core = lab == (np.argmax(sizes) + 1)
    near = ndimage.binary_dilation(core, iterations=16)
    kept = 0
    for k, f in fr.items():
        d = diff(f); lab, n = ndimage.label(d)
        keep = np.zeros_like(d)
        for c in range(1, n + 1):
            comp = lab == c
            if comp.sum() >= 40 and (comp & near).any(): keep |= comp
        keep = ndimage.binary_fill_holes(ndimage.binary_dilation(keep | ndimage.binary_dilation(core, iterations=6), iterations=3))   # the whole mouth area, no see-through gaps
        a = ndimage.gaussian_filter(keep.astype(float), 1.2)[..., None]
        out = f * a + bb * (1 - a)
        Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA').save(f'faces/{tid}/m{k}.webp', 'WEBP', lossless=True)
        kept += int(keep.sum())
    print(tid, 'kept', kept)
