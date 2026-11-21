# A kit's blink (closed eyes, e4, and the half-closed e3) from an image tool's edit of the kit picture with its eyes
# closed: fitted to the kit picture around the eyes, then only the eye area that changed is kept, as a layer.
# Usage: python3 tools/blink_from_edit.py <ref> <edit picture> <eye box x0,y0,x1,y1> [more refs to copy it to]
import sys, numpy as np, cv2, shutil
from PIL import Image
from scipy import ndimage
ref, pic, box = sys.argv[1], sys.argv[2], [int(v) for v in sys.argv[3].split(',')]
b = Image.open(f'faces/{ref}/base.webp').convert('RGBA'); w = Image.new('RGBA', b.size, (255, 255, 255, 255)); w.alpha_composite(b)
base = np.array(w.convert('RGB')); N = base.shape[0]; A = np.array(b)[..., 3]
gray = lambda a: cv2.GaussianBlur(cv2.cvtColor(a, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255, (0, 0), 1.5)
x0, y0, x1, y1 = box; yy, xx = np.mgrid[0:N, 0:N]
# fit on the head around the eyes (not the eyes)
ring = (xx > x0 - 120) & (xx < x1 + 120) & (yy > y0 - 100) & (yy < y1 + 160) & ~((xx > x0 - 6) & (xx < x1 + 6) & (yy > y0 - 6) & (yy < y1 + 6))
im = np.array(Image.open(pic).convert('RGB').resize((N, N), Image.LANCZOS))
W = np.eye(2, 3, dtype=np.float32)
cc, W = cv2.findTransformECC(gray(base), gray(im), W, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-7), ring.astype(np.uint8), 5)
al = cv2.warpAffine(im, W, (N, N), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP, borderValue=(255, 255, 255)).astype(np.float32)
print('fit around the eyes %.3f' % cc)
inbox = (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)
diff = (np.abs(al - base).sum(-1) > 90) & inbox
zone = ndimage.binary_fill_holes(ndimage.binary_closing(ndimage.binary_opening(diff, iterations=2), iterations=10))
zone = ndimage.binary_dilation(zone, iterations=6) & inbox & (A > 200)
a = ndimage.gaussian_filter(zone.astype(np.float32), 2)
a = np.where(ndimage.binary_erosion(zone, iterations=3), 1.0, a)
out = np.zeros((N, N, 4), np.uint8); out[..., :3] = np.clip(al, 0, 255).astype(np.uint8); out[..., 3] = (a * 255).astype(np.uint8)
Image.fromarray(out).save(f'faces/{ref}/e4.webp', 'WEBP', lossless=True); Image.fromarray(out).save(f'faces/{ref}/e3.webp', 'WEBP', lossless=True)
for r in sys.argv[4:]:
    for k in (3, 4): shutil.copy(f'faces/{ref}/e{k}.webp', f'faces/{r}/e{k}.webp')
print('ok', int(zone.sum()))
