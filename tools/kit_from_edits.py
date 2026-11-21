# A kit's mouths from whole-picture edits (Gemini "change only his beak" on the kit's own picture, one picture per
# mouth): each edit is lined up with the kit picture, and only the mouth area is taken from it (the beak as it was,
# and as it is now, plus a margin), so the eyes, comb, feathers and clothes stay the kit picture's own, pixel for pixel.
# Usage: python3 tools/kit_from_edits.py <ref> <out_dir> <frame>=<picture> ...
#   e.g. python3 tools/kit_from_edits.py 310 faces/310 3=ah.png 5=o.png
# The box (x0,y0,x1,y1) the mouth can reach is per kit (BOX below).
import sys, numpy as np
from PIL import Image
from scipy import ndimage

BOX = { '310':(330, 470, 880, 900), '929':(420, 500, 800, 830) }
# kits with a mouth (not a beak): the area always taken (the old mouth line and teeth), as an ellipse (cx, cy, rx, ry)
MOUTH_AREA = { '929':(600, 620, 165, 80) }
ref, out_dir, pairs = sys.argv[1], sys.argv[2], [a.split('=', 1) for a in sys.argv[3:]]
base = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(np.float32)
N = base.shape[0]; x0, y0, x1, y1 = BOX[ref]
yy, xx = np.mgrid[0:N, 0:N]; inbox = (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)

def mouth_parts(rgb, both=False):
    if ref in MOUTH_AREA: return lip_parts(rgb, both)
    return beak_parts(rgb, both)
def lip_parts(rgb, both=False):   # a mouth under a muzzle: what's drawn in mouth colours (inside, tongue, teeth) in the box
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    inside = (((r > 70) & (g < r * 0.55) & (b < r * 0.75) & (r + g + b < 520)) | ((r > 190) & (g > 80) & (g < 180) & (b > 95) & (b < 200) & (r - g > 45))) & inbox
    cx, cy, rx, ry = MOUTH_AREA[ref]; ell = (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 < 1) & inbox
    near = ((xx - cx) / (rx + 20)) ** 2 + ((yy - cy) / (ry + 8)) ** 2 < 1      # (his orange shirt is a mouth colour too: only near the mouth)
    inside = ndimage.binary_opening(inside & near, iterations=1)
    m = ell | ndimage.binary_fill_holes(ndimage.binary_closing(inside, iterations=4))
    return (m, inside) if both else m
def beak_parts(rgb, both=False):   # the beak, and what's inside its outline (mouth, tongue); not the wattle or the shirt
    from scipy.spatial import ConvexHull
    from PIL import ImageDraw
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    yellow = (r > 185) & (g > 145) & (b < 165) & (r - b > 55) & inbox
    lab, n = ndimage.label(ndimage.binary_opening(yellow, iterations=1)); sizes = ndimage.sum(yellow, lab, range(1, n + 1))
    beak = np.isin(lab, [i + 1 for i, v in enumerate(sizes) if v > 2000])
    ys, xs = np.where(beak); h = ConvexHull(np.c_[xs, ys]); im = Image.new('L', (N, N), 0)
    ImageDraw.Draw(im).polygon([(xs[i], ys[i]) for i in h.vertices], fill=255); hull = np.array(im) > 127
    inside = ((r > 70) & (g < r * 0.55) & (b < r * 0.75) & (r + g + b < 520)) | ((r > 190) & (g > 80) & (g < 180) & (b > 95) & (b < 200) & (r - g > 45))
    inside = inside & hull
    m = ndimage.binary_fill_holes(ndimage.binary_closing(beak | inside, iterations=4)) & hull
    return (m, inside & ~beak) if both else m

was = mouth_parts(base[..., :3])
for k, pic in pairs:
    im = Image.open(pic).convert('RGB')
    if im.size != (N, N): im = im.resize((N, N), Image.LANCZOS)
    g = np.array(im).astype(np.float32)
    now = mouth_parts(g)
    # flat colours: the edit's colours snapped to the kit picture's own (its feathers, beak, ink, clothes) and to the
    # mouth's (a few insides and tongues), so no near-miss shade is left for the kit engine to mistake for something new;
    # blends at an edge (far from every flat colour) are left as they are
    from scipy.cluster.vq import kmeans2
    ring = ndimage.binary_dilation(was, iterations=30) & inbox & (base[..., 3] > 250)
    pal_base = kmeans2(base[ring][:, :3][::7], 14, seed=1, minit='++')[0]
    insides = mouth_parts(g, True)[1]
    pal_mouth = kmeans2(g[insides][::5], 5, seed=1, minit='++')[0] if insides.sum() > 200 else np.zeros((0, 3))
    pal = np.vstack([pal_base, pal_mouth])
    flat = g.reshape(-1, 3); d = ((flat[:, None, :] - pal[None, :, :]) ** 2).sum(-1); j = d.argmin(1); dm = np.sqrt(d.min(1))
    snap = flat.copy(); close = dm < 42; snap[close] = pal[j[close]]; g = snap.reshape(g.shape)
    # the back of the throat: any dark blob drawn inside the mouth (a uvula, a nostril-like shape) becomes the mouth's own red
    if insides.sum() > 200:
        deep = pal_mouth[np.argmin(pal_mouth.sum(1))]
        hole = ndimage.binary_fill_holes(ndimage.binary_closing(insides, iterations=6))     # the open mouth only (not the nostril)
        # (near-black well inside the opening, away from its outline: a drawn throat hole or uvula -> the mouth's darkest red)
        dark = (g.sum(-1) < 130) & (np.abs(g[..., 0] - g[..., 2]) < 60) & ndimage.binary_erosion(hole, iterations=12)
        g[ndimage.binary_dilation(dark, iterations=2) & ndimage.binary_erosion(hole, iterations=9) & (g.sum(-1) < 200)] = deep
    # the area taken from the edit: the beak before and after, with its outline (a margin), and nothing else
    changed = np.zeros_like(was)
    if ref in MOUTH_AREA:
        diff = np.abs(g - base[..., :3]).sum(-1) > 110
        cx, cy, rx, ry = MOUTH_AREA[ref]; near_mouth = ((xx - cx) / (rx + 20)) ** 2 + ((yy - cy) / (ry + 15)) ** 2 < 1
        changed = ndimage.binary_opening(diff & near_mouth, iterations=5)   # (a face redrawn a little off elsewhere isn't a change)
    zone = ndimage.binary_dilation(was | now | changed, iterations=14 if ref not in MOUTH_AREA else 8) & inbox
    sg = 2.5 if ref not in MOUTH_AREA else 5   # (a redrawn face never lines up perfectly: a wider, softer seam)
    zone = zone & ~ndimage.binary_dilation(~inbox, iterations=int(3 * sg))   # (and it never reaches the box's edge)
    a = ndimage.gaussian_filter(zone.astype(np.float32), sg)
    a = np.where(ndimage.binary_erosion(zone, iterations=int(2 * sg)), 1.0, a)[..., None]
    out = base.copy()
    out[..., :3] = base[..., :3] * (1 - a) + g * a
    # the edit's white background never becomes picture: outside the kit's own outline only the new beak (and its ink) is
    # (the edit's background: the white that reaches the picture's edge; where the old beak tip stuck out past the new
    # one, it goes see-through instead of white)
    lw, _ = ndimage.label(g.min(-1) > 225); edge = np.unique(np.concatenate([lw[0], lw[-1], lw[:, 0], lw[:, -1]])); edge = edge[edge > 0]
    white = ndimage.binary_dilation(np.isin(lw, edge), iterations=1)
    out[..., 3] = np.where(zone, np.where(white, 0, np.maximum(base[..., 3], 255 * a[..., 0])), base[..., 3])
    # (specks of the edit left outside his outline: dropped)
    extra = (out[..., 3] > 40) & (base[..., 3] < 128); le, ne = ndimage.label(extra)
    if ne: sz = ndimage.sum(extra, le, range(1, ne + 1)); out[..., 3][np.isin(le, [i + 1 for i, v in enumerate(sz) if v < 150])] = 0
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(f'{out_dir}/m{k}.webp', 'WEBP', lossless=True)
    print(k, pic, 'mouth px before', int(was.sum()), 'after', int(now.sum()), 'zone', int(zone.sum()))
