# A kit's talking frames whose mouth sits inside the face: the picture's own face outline and everything outside it,
# the frame only inside. The image tool redrew the beaver's chin a few pixels off in every frame, and where it met the
# shoulder it left ticks, a doubled line and gaps; the kit engine carried those onto every beaver as scribbles over its own
# clothes (GEAUX, 21 Nov: the bow). Frames whose jaw really drops past the face (a wide AH) are left out.
# Usage: python3 tools/kit_inside_face.py <ref> <face r,g,b> <frames...>
import sys, numpy as np
from PIL import Image
from scipy import ndimage
ref = sys.argv[1]; face = np.array([int(v) for v in sys.argv[2].split(',')]); frames = [int(a) for a in sys.argv[3:]]
fur = lambda a: (a[..., 3] > 128) & (np.abs(a[..., :3] - face).sum(-1) < 70)
mouthc = lambda a: (a[..., 3] > 128) & (((a[..., 0] > a[..., 1] * 1.4) & (a[..., 0] > a[..., 2] * 1.15) & (a[..., 0] > 40)) | (a[..., :3].min(-1) > 225)) & ~fur(a)
sil = lambda a: ndimage.binary_erosion(ndimage.binary_fill_holes(ndimage.binary_dilation(fur(a) | mouthc(a), iterations=6)), iterations=6)   # the face, its inner ink too
b = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(int)
inner = ndimage.binary_erosion(sil(b), iterations=3)
for k in frames:
    f = f'faces/{ref}/m{k}.webp'; a = np.array(Image.open(f).convert('RGBA')).astype(int)
    lost = int((mouthc(a) & ~mouthc(b) & ~inner).sum())
    out = b.copy(); out[inner] = a[inner]
    Image.fromarray(out.astype(np.uint8)).save(f, 'WEBP', lossless=True)
    print(ref, k, 'outside the face: the picture\'s own; mouth pixels left outside:', lost)
