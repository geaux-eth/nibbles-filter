# Hand fixes for two specials whose Canva mouth sheets came out partly wrong (run after clean_mouths.py).
import numpy as np, shutil
from PIL import Image
from scipy import ndimage
# Wolf #3538: the OO, F/V, L and frown panels lost his jaw: they borrow O, M/B/P, slightly open and M/B/P
for dst, src in [(6, 5), (7, 1), (9, 1), (8, 2)]: shutil.copy(f'faces/3538/m{src}.webp', f'faces/3538/m{dst}.webp')
# Bear #794: the closed and slightly open panels lost the skull's nose; it goes back on from his picture.
# His L panel was odd: it borrows slightly open.
mb = [424, 542, 748, 728]; base = np.array(Image.open('faces/794/base.webp').convert('RGBA'))
m2 = np.array(Image.open('faces/794/m2.webp').convert('RGBA')); h, w = m2.shape[:2]; bb = base[mb[1]:mb[1] + h, mb[0]:mb[0] + w]
lab, n = ndimage.label((bb[..., :3].astype(int).sum(-1) > 600) & (bb[..., 3] > 250)); best = None
for c in range(1, n + 1):
    ys, xs = np.where(lab == c)
    if ys.min() == 0 or xs.min() == 0 or ys.max() >= h - 1 or xs.max() >= w - 1: continue
    if 300 < len(ys) < 6000 and (best is None or len(ys) > best[0]): best = (len(ys), c)
nose = ndimage.binary_dilation(lab == best[1], iterations=6)
shutil.copy('faces/794/m2.webp', 'faces/794/m8.webp')
for k in (1, 2, 8):
    f = f'faces/794/m{k}.webp'; m = np.array(Image.open(f).convert('RGBA')); m[nose] = bb[nose]; Image.fromarray(m).save(f, 'WEBP', lossless=True)
print('ok')
# Wolf #3538's wide-open mouth: nothing of it sits over the background (Canva left a teal smear there)
mb = [494, 586, 760, 816]; base = np.array(Image.open('faces/3538/base.webp').convert('RGBA'))
f = 'faces/3538/m3.webp'; m = np.array(Image.open(f).convert('RGBA')); h, w = m.shape[:2]
bb = base[mb[1]:mb[1] + h, mb[0]:mb[0] + w]; c = m[..., :3].astype(int)
teal = ((c[..., 2] > c[..., 0] + 20) & (c[..., 1] > c[..., 0] + 20)) | (bb[..., 3] < 10)
m[teal] = bb[teal]; Image.fromarray(m).save(f, 'WEBP', lossless=True)
# Gecko #7813's AH came out smudged: it borrows his L. 
shutil.copy('faces/7813/m8.webp', 'faces/7813/m3.webp')
print('ok2')
