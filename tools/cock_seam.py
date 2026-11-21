# Cock kit (#310): the open beaks' upper edge. keep_upper_beak.py blended the kit picture's own upper beak over each
# talking beak with a soft edge a little above where the halves meet; where the image tool had drawn the mouth opening
# higher than that, the kept yellow faded straight into the dark inside of the mouth, with no outline (GEAUX's sitcom,
# 21 Nov: blurred beaks). Here the seam is made hard again: blended pixels go to the beak or the mouth, whichever they're
# nearer, and an ink line runs along the top of the opening, as thick as the kit's own outlines.
# Usage: python3 tools/cock_seam.py [frames, default 2 3 4 5 8]
import sys, numpy as np
from PIL import Image
from scipy import ndimage
frames = [int(a) for a in sys.argv[1:]] or [2, 3, 4, 5, 8]
b = np.array(Image.open('faces/310/base.webp').convert('RGBA')).astype(int)
ink0 = (b[..., :3].sum(-1) < 200) & (b[..., 3] > 128)
xs, ys = [], []
for x in range(470, 771, 5):
    r = [y for y in range(640, 700) if ink0[y, x]]
    if r: xs.append(x); ys.append((r[0] + r[-1]) / 2 if r[-1] - r[0] < 14 else r[0] + 4)
P = np.polyfit(xs, ys, 2); yy, xx = np.mgrid[0:1000, 0:1000]
line = np.polyval(P, np.clip(xx, 470, 770)) - 10                   # where the kept upper beak ended
band = (np.abs(yy - line) < 26) & (xx > 400) & (xx < 800)           # around that seam only
INK = np.array([33, 24, 22])
for k in frames:
    f = f'faces/310/m{k}.webp'; a = np.array(Image.open(f).convert('RGBA')).astype(int); rgb = a[..., :3]; s = rgb.sum(-1)
    beak = (rgb[..., 0] > 180) & (rgb[..., 1] > 150) & (rgb[..., 2] < 150)                  # beak yellow
    inside = (s < 420) & (rgb[..., 0] > rgb[..., 2] + 15) & (a[..., 3] > 128)                # the mouth's reds and maroons
    tongue = (rgb[..., 0] > 190) & (rgb[..., 1] < 150) & (rgb[..., 2] > 90)
    ink = (s < 200) & (a[..., 3] > 128)
    open_ = ndimage.binary_opening((inside | tongue) & band, iterations=2)
    if open_.sum() < 200: print(k, 'no opening at the seam'); continue
    # blended seam pixels (neither clean beak, mouth nor ink): to whichever side they're nearer
    by = np.median(rgb[beak & band], axis=0); iy = np.median(rgb[inside & band], axis=0)
    mid = band & ~beak & ~inside & ~tongue & ~ink & (a[..., 3] > 128)
    near_b = np.abs(rgb - by).sum(-1) < np.abs(rgb - iy).sum(-1)
    rgb[mid & near_b] = by; rgb[mid & ~near_b] = iy
    # the outline: the top edge of the opening, where beak yellow sits right above the inside of the mouth
    top = np.zeros_like(open_)
    for x in range(400, 800):
        col = np.where(open_[:, x])[0]
        if not len(col): continue
        y0 = col[0]
        if y0 > 3 and (beak[max(0, y0 - 8):y0, x].any() or mid[max(0, y0 - 8):y0, x].any()) and not ink[max(0, y0 - 7):y0, x].any(): top[y0, x] = 1
    line_m = ndimage.binary_dilation(top, structure=np.ones((7, 3)), iterations=1) & (yy <= ndimage.binary_dilation(top, iterations=0).nonzero()[0].max() + 6 if top.any() else False)
    lm = ndimage.binary_dilation(top, iterations=3) & band
    rgb[lm] = INK; a[..., :3] = rgb; a[lm, 3] = 255
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(f, 'WEBP', lossless=True)
    print(k, 'seam outline px', int(lm.sum()), 'blended fixed', int(mid.sum()))
