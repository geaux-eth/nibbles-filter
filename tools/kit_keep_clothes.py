# A kit's talking frames keep the kit picture's own clothes, pixel for pixel: the image tool redraws the suspenders, collar
# or shirt a few pixels off, and the kit engine took that as part of the mouth (cream and grey stripes through other
# wolves' hoods and shirts, GEAUX's sitcom). Where a frame shows clothes (not the face colour, the mouth's colours, or an
# outline right next to them), the kit picture's own pixel goes back.
# Usage: python3 tools/kit_keep_clothes.py <ref> <face r,g,b> [frames]   (only solid pixels: never anything see-through)
import sys, numpy as np
from PIL import Image
from scipy import ndimage
ref = sys.argv[1]; face = np.array([int(v) for v in sys.argv[2].split(',')]); frames = [int(a) for a in sys.argv[3:]] or list(range(1, 10))
KEEP = { '271':(690, 610, 905, 780) }.get(ref)   # the wolf's fangs (gone on purpose in the O and OO)
b = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(int)
def kinds(a):
    rgb = a[..., :3]; s = rgb.sum(-1); op = a[..., 3] > 128
    skin = op & (np.abs(rgb - face).sum(-1) < 70)
    mouth = op & (((rgb[..., 0] > rgb[..., 1] * 1.6) & (rgb[..., 0] > 90)) | ((rgb.min(-1) > 225) & (rgb.max(-1) - rgb.min(-1) < 30)))   # reds, pinks, teeth
    ink = op & (s < 200)
    return skin, mouth, ink, op
bs, bm, bi, bo = kinds(b)
for k in frames:
    f = f'faces/{ref}/m{k}.webp'; a = np.array(Image.open(f).convert('RGBA')).astype(int)
    s_, m_, i_, o_ = kinds(a)
    facey = ndimage.binary_dilation(s_ | m_, iterations=5) | ndimage.binary_dilation(ndimage.binary_dilation(s_ | m_, iterations=2) & (a[..., :3].sum(-1) < 200), iterations=8) & (a[..., :3].sum(-1) < 200)   # the face and mouth, and the whole outline round them
    bfacey = ndimage.binary_dilation(bs | bm, iterations=5)
    clothes = o_ & ~facey                                                   # this frame shows clothes or background here
    revert = clothes & ~bfacey & bo & (np.abs(a - b).sum(-1) > 0)           # ...and the kit picture shows clothes here too (both solid)
    if KEEP: x0, y0, x1, y1 = KEEP; yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]   # (never where the frame drew something on purpose)
    # and anywhere the frame shows only a re-shade of the picture (neither is face or mouth, both solid, close in colour):
    # the image tool redrew it a touch off, not a change; the picture's own (a suspender box and an apron logo came through)
    revert |= o_ & bo & ~s_ & ~m_ & ~bs & ~bm & (np.abs(a[..., :3] - b[..., :3]).sum(-1) < 150)
    if KEEP: revert &= ~((xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1))
    a[revert] = b[revert]
    Image.fromarray(a.astype(np.uint8)).save(f, 'WEBP', lossless=True)
    print(k, 'kept the picture\'s own clothes at', int(revert.sum()), 'px')
