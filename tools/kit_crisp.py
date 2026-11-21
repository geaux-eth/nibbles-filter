# A kit's talking frames made crisp like flat cartoon art: the mouths made from small sheet panels were scaled up soft
# (blurry outlines, smeared patches, a muzzle a few shades off), and every Nibble of the kind copied that softness. Here,
# around the mouth, every pixel is snapped to the nearest of the frame's own flat colours (the picture's face colours,
# ink, and the mouth's reds, pinks and teeth, found by clustering), then the edges get a thin anti-aliasing again.
# Usage: python3 tools/kit_crisp.py <ref> [frames]
import sys, numpy as np
from PIL import Image
from scipy import ndimage
from scipy.cluster.vq import kmeans2
ref = sys.argv[1]; frames = [int(a) for a in sys.argv[2:]] or list(range(1, 10))
b = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(float); N = b.shape[0]
for k in frames:
    f = f'faces/{ref}/m{k}.webp'; a = np.array(Image.open(f).convert('RGBA')).astype(float)
    if a.shape != b.shape: continue
    hit = (np.abs(a - b).sum(-1) > 30)
    zone = ndimage.binary_dilation(ndimage.binary_opening(hit, iterations=1), iterations=14) & (a[..., 3] > 200)
    if zone.sum() < 200: continue
    px = a[zone][:, :3]
    # the palette: the frame's own flat colours here (cluster centres), plus ink and the picture's colours around
    ring = ndimage.binary_dilation(zone, iterations=30) & ~zone & (b[..., 3] > 200)
    cs, lab = kmeans2(px[::3], 12, seed=1, minit='++')
    cnt = np.bincount(lab, minlength=12); cs = cs[cnt > len(lab) * 0.01]
    rv = b[ring][:, :3]
    if len(rv) > 50: rc, rl = kmeans2(rv[::5], 6, seed=2, minit='++'); rc = rc[np.bincount(rl, minlength=6) > len(rl) * 0.03]; cs = np.vstack([cs, rc])
    # a cluster that isn't a mouth colour (red, pink, teeth white, ink) must be one of the picture's own colours here: a
    # smudge or shade-off patch of the face isn't a colour of its own (it snaps to the face)
    mouthy = lambda c: (c[0] > c[1] * 1.35 and c[0] > c[2] * 1.1) or c.min() > 235 or c.sum() < 150
    keepc = [c for c in cs[:len(cs) - (len(rc) if len(rv) > 50 else 0)] if mouthy(c)]
    pal = np.vstack([np.array(keepc).reshape(-1, 3), rc if len(rv) > 50 else np.zeros((0, 3)), [[20, 14, 14]]])
    d = ((px[:, None, :] - pal[None, :, :]) ** 2).sum(-1); j = d.argmin(1)
    snapped = pal[j]
    out = a.copy(); out[zone, :3] = snapped
    # a thin anti-aliased edge again (only along colour changes, inside the zone)
    soft = out.copy();
    for c in range(3): soft[..., c] = ndimage.gaussian_filter(out[..., c], 0.6)
    edge = zone & (ndimage.maximum_filter(j_full := np.full((N, N), -1), size=1) == -1)   # placeholder, set below
    jf = np.full((N, N), -1); jf[zone] = j
    edge = zone & ((ndimage.maximum_filter(jf, size=3) != ndimage.minimum_filter(jf, size=3)))
    out[edge, :3] = soft[edge, :3]
    # (where the zone meets the untouched picture: blended over a few pixels, so no seam)
    w = ndimage.gaussian_filter(zone.astype(float), 1.5)[..., None]; w = np.where(ndimage.binary_erosion(zone, iterations=3)[..., None], 1.0, w)
    res = a * (1 - w) + out * w
    Image.fromarray(np.clip(res, 0, 255).astype(np.uint8)).save(f, 'WEBP', lossless=True)
    print(ref, k, 'palette', len(pal), 'px', int(zone.sum()))
