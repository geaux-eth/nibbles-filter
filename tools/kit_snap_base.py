# Kit clean-up (23 Nov, found by the all-Nibbles check): every talking picture of a kit is a whole redraw of its kit picture,
# and the image tool re-shaded the skin around the mouth in faint patches (on the ghost kits ~30,000 pixels a frame within a
# shade of the kit picture). The kit engine maps those patches onto each Nibble as patches: pale blotches, halos round the
# lines and straight cut edges. Here every pixel of a talking picture within a shade of the kit picture (summed RGB
# difference under 40, both solid) becomes the kit picture's own, so the only differences left are the mouth itself.
# Usage: python3 tools/kit_snap_base.py <kit> ...     (writes faces/<kit>/m1..m9.webp in place; lossless)
import sys, numpy as np
from PIL import Image
for ref in sys.argv[1:]:
    b = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(int)
    for k in range(1, 10):
        f = f'faces/{ref}/m{k}.webp'; m = np.array(Image.open(f).convert('RGBA')).astype(int)
        near = (m[..., 3] > 250) & (b[..., 3] > 250) & (np.abs(m[..., :3] - b[..., :3]).sum(-1) < 40)
        m[near] = b[near]
        Image.fromarray(m.astype(np.uint8)).save(f, 'WEBP', lossless=True)
        print(ref, k, int(near.sum()))
