# Cock kit (25 Nov, seen on white and black cocks that passed the nibble check): the redrawn talking beaks are smaller than the
# kit picture's beak, and where the kit picture's beak was, outside the new beak's own outline, the sheets left its old lower
# outline and sketchy hatching (frames 1, 2, 5) and scribbles past the shorter tip (frames 4, 8). On a brown cock it barely
# shows; on a white one it is a second, scratchy jaw line. Here, in each talking picture, everything in that ring that isn't
# feather becomes the kit picture's flat feather colour (and where the old tip stuck out past the head, the background).
# Usage: python3 tools/kit_beak_ghost.py <kit> [frames] [outdir]   (in place unless outdir; lossless). DRY=1 only reports.
import sys, os, numpy as np
from PIL import Image
from scipy import ndimage
ref = sys.argv[1]; ks = [int(k) for k in sys.argv[2].split(',')] if len(sys.argv) > 2 and sys.argv[2] else list(range(1, 10))
out = sys.argv[3] if len(sys.argv) > 3 else f'faces/{ref}'
B = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(int)
beak = lambda A: (A[..., 0] > 180) & (A[..., 1] > 140) & (A[..., 2] < 160) & (A[..., 0] - A[..., 2] > 60)
beakL = lambda A: (A[..., 0] > 190) & (A[..., 1] > 150) & (A[..., 0] - A[..., 2] > 40)   # with the pale highlight
def solid(A):   # the beak with its mouth: the biggest beak-coloured piece, closed and filled
    lb, nb = ndimage.label(beak(A)); big = lb == 1 + int(np.argmax(ndimage.sum(np.ones_like(lb), lb, range(1, nb + 1))))
    return ndimage.binary_fill_holes(ndimage.binary_closing(big, iterations=25, border_value=0))
S0 = solid(B)
ring = ndimage.binary_dilation(S0, iterations=30) & ~ndimage.binary_dilation(S0, iterations=6) & (B[..., 3] > 200) & (B[..., :3].sum(-1) > 200)
q = (B[ring][:, :3] // 8); u, c = np.unique(q, axis=0, return_counts=True); FE = u[c.argmax()] * 8 + 4
print('feather colour', FE)
qy = B[S0 & beak(B)][:, :3] // 4; u, c = np.unique(qy, axis=0, return_counts=True); YE = u[c.argmax()] * 4 + 2
print('beak colour', YE)
# the head without its beak: where the kit picture is opaque outside the beak, and the beak's own area that lies inside the head
# outline (the tip sticks out past it). Inside = filled head silhouette.
head = ndimage.binary_fill_holes(ndimage.binary_closing(B[..., 3] > 200, iterations=4))
for k in ks:
    f = f'faces/{ref}/m{k}.webp'; M = np.array(Image.open(f).convert('RGBA')).astype(int)
    a = M[..., 3:4] / 255; F = B.copy(); F[..., :3] = (M[..., :3] * a + B[..., :3] * (1 - a)).astype(int); F[..., 3] = np.maximum(M[..., 3], B[..., 3])
    yk = beak(F); lb, nb = ndimage.label(yk); yk = np.isin(lb, [i + 1 for i, v in enumerate(ndimage.sum(np.ones_like(lb), lb, range(1, nb + 1))) if v > 400])
    # the beak with its pale highlight (not the cream neck stripes: only pale pieces touching the beak)
    lb, nb = ndimage.label(beakL(F)); yl = np.isin(lb, np.unique(lb[ndimage.binary_dilation(yk, iterations=2)])[1:]) | yk
    dY = ndimage.distance_transform_edt(~yl)
    # between the jaws (the mouth's inside, whatever its colour): beak above and below in the same column, within 220 px
    H, W = yk.shape; rows = np.arange(H)[:, None] * np.ones((1, W), int)
    up = np.where(yk, rows, -10**6); up = np.maximum.accumulate(up, axis=0)
    dn = np.where(yk, rows, 10**6); dn = np.minimum.accumulate(dn[::-1], axis=0)[::-1]
    between = (rows - up < 220) & (dn - rows < 220)
    zone = ndimage.binary_dilation(S0, iterations=12) & (dY > 6) & ~between
    feather = (np.abs(F[..., :3] - FE).sum(-1) < 36)
    bad = zone & ~feather
    # a thin second outline hugging the beak's own (1-2 px, a sliver of feather between): dark that an opening removes, outside
    # the beak and not between the jaws (the real outline is thick and stays)
    dk = F[..., :3].sum(-1) < 200; thick = ndimage.binary_dilation(ndimage.binary_opening(dk, iterations=2), iterations=2)
    redish = (F[..., 0] > 150) & (F[..., 0] - F[..., 1] > 60)
    thin = dk & ~thick & ndimage.binary_dilation(S0, iterations=14) & ~yl & (dY > 1) & ~ndimage.binary_dilation(redish, iterations=6)
    # (between the jaws too: past the shorter lower jaw, the sheets' scratches round the mouth's end at the beak tip)
    bad |= thin
    # the mouth's inside past the shorter lower jaw is the mouth's: dark or red pieces of the ring that touch the inside stay
    lz, nz = ndimage.label(bad, structure=np.ones((3, 3)))
    touch = np.unique(lz[ndimage.binary_dilation(between & ~yk & ~feather, iterations=2) & bad])
    bad &= ~np.isin(lz, touch[touch > 0])
    # outside the head silhouette, where the old tip was: background, unless the frame's head outline runs there
    print(ref, k, 'zone', int(zone.sum()), 'bad', int(bad.sum()))
    if os.environ.get('DRY'): continue
    O = M.copy(); O[bad, :3] = FE; O[bad, 3] = 255
    # and where the kit picture's mouth line was, inside its beak, the frames' paint-over is a shade paler than the beak: a pale
    # streak across every closed beak (the 'o' and 'mm' mouths). There, beak-coloured pixels become the beak's flat yellow.
    oldL = ndimage.binary_dilation((B[..., :3].sum(-1) < 400) & (ndimage.distance_transform_edt(S0) > 14), iterations=6)
    pale = oldL & (F[..., 0] > 200) & (F[..., 1] > 180) & (np.abs(F[..., :3] - YE).sum(-1) > 6) & (np.abs(F[..., :3] - YE).sum(-1) < 160) & (F[..., :3].sum(-1) >= YE.sum() - 10)
    O[pale, :3] = YE; O[pale, 3] = 255
    print('   evened pale', int(pale.sum()))
    Image.fromarray(O.astype(np.uint8)).save(f'{out}/m{k}.webp', 'WEBP', lossless=True)
