# Kit clean-up (23 Nov, found by the all-Nibbles check): in the talking pictures that barely move the jaw (shut, small
# open, EE, OO, F/V, L, frown), the image tool also redrew things around the mouth: a smeared chin line on the bear's F/V,
# a soft band under the gecko's L, lilac lip lines on the gnome's F/V. Most of the check's straight-edge failures sit on
# ten such spots. Here, in those pictures, everything the picture changes outside the mouth itself goes back to the kit
# picture: the mouth is the changed area that holds the mouth's own colours or ink (pieces of 30+ px, grown 10 px); any
# other change is put back.
# Only pieces within 40 px of the biggest change (the mouth) are kept.
# Usage: python3 tools/kit_trim.py <kit> ...       (frames 1 2 4 6 7 8 9; lossless, in place; back up first)
import sys, numpy as np
from PIL import Image
from scipy import ndimage
import os
FR = [int(k) for k in os.environ["FR"].split(",")] if os.environ.get("FR") else [1, 2, 4, 6, 7, 8, 9]
for ref in sys.argv[1:]:
    b = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(int)
    for k in FR:
        f = f'faces/{ref}/m{k}.webp'; m = np.array(Image.open(f).convert('RGBA')).astype(int)
        vis = (m[..., 3] > 128) | (b[..., 3] > 128)   # (a see-through pixel's colour means nothing)
        d = vis & ((np.abs(m[..., :3] - b[..., :3]).sum(-1) > 60) | (np.abs(m[..., 3] - b[..., 3]) > 60))
        r, g, bb = m[..., 0], m[..., 1], m[..., 2]
        mouthC = ((r > g * 1.5) & (r > bb * 1.15) & (r - g > 60)) | ((m[..., :3].sum(-1) > 600) & (m[..., :3].max(-1) - m[..., :3].min(-1) < 40)) | (m[..., :3].sum(-1) < 150)
        lab, n = ndimage.label(ndimage.binary_closing(d, iterations=2))
        keep = np.zeros_like(d)
        if n:
            sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); mc = ndimage.sum(mouthC & d, lab, range(1, n + 1))
            ids = [i + 1 for i in range(n) if sz[i] >= 30 and mc[i] >= 0.15 * sz[i]]
            keep = np.isin(lab, ids)
            # (and only near the mouth itself, the biggest change: specks the image tool left along a tail or a hat outline
            #  aren't the mouth, 24 Nov)
            if ids:
                big = max(ids, key=lambda i: sz[i - 1]); keep &= ndimage.binary_dilation(lab == big, iterations=40)
        keep = ndimage.binary_dilation(keep, iterations=10)
        back = d & ~keep
        m[back] = b[back]
        Image.fromarray(m.astype(np.uint8)).save(f, 'WEBP', lossless=True)
        print(ref, k, 'changed', int(d.sum()), 'put back', int(back.sum()))
