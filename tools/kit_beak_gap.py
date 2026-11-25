# Cock kit (24 Nov, found by the all-Nibbles check): where the kit picture's longer beak tip was, the redrawn open beaks
# show the sheet's feathers, textured and in their own browns; on every black or dark cock that came out as a blotchy smudge
# beside the beak. Here, in each talking picture, the pixels there that are feather (not beak, ink, or the mouth's inside)
# become the kit picture's one flat feather colour round the beak.
# Usage: python3 tools/kit_beak_gap.py <kit> <frame,...>    (in place, lossless; back up first)
import sys, numpy as np
from PIL import Image
from scipy import ndimage
ref, ks = sys.argv[1], [int(k) for k in sys.argv[2].split(',')]
B = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(int)
beak = lambda A: (A[..., 0] > 180) & (A[..., 1] > 140) & (A[..., 2] < 160) & (A[..., 0] - A[..., 2] > 60)
lb, nb = ndimage.label(beak(B)); kb = lb == 1 + int(np.argmax(ndimage.sum(np.ones_like(lb), lb, range(1, nb + 1))))
ring = ndimage.binary_dilation(kb, iterations=30) & ~ndimage.binary_dilation(kb, iterations=6) & (B[..., 3] > 200) & (B[..., :3].sum(-1) > 200)
q = (B[ring][:, :3] // 8); u, c = np.unique(q, axis=0, return_counts=True); FE = u[c.argmax()] * 8 + 4
print('feather colour', FE)
for k in ks:
    f = f'faces/{ref}/m{k}.webp'; M = np.array(Image.open(f).convert('RGBA')).astype(int)
    F = B.copy(); a = M[..., 3:4] / 255; F[..., :3] = (M[..., :3] * a + B[..., :3] * (1 - a)).astype(int)
    r, g, b = F[..., 0], F[..., 1], F[..., 2]
    feather = ~beak(F) & (F[..., :3].sum(-1) >= 200) & (np.abs(F[..., :3] - FE).sum(-1) < 120) & ~((r > g * 1.5) & (r - g > 60))
    gap = ndimage.binary_dilation(kb, iterations=4) & feather & (M[..., 3] > 0)
    out = M.copy(); out[gap, :3] = FE; out[gap, 3] = 255
    Image.fromarray(out.astype(np.uint8)).save(f, 'WEBP', lossless=True)
    print(ref, k, 'flattened', int(gap.sum()))
