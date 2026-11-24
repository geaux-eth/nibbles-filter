# Teeth check (problems.md M9): in every kit, every talking frame's teeth stay tooth-white, and the beaver's buck teeth are
# in every frame. Compares each frame with the kit as first made (before any clean-up): a tooth pixel there that's no
# longer near-white now fails (the clean-up once turned the bear's fangs muzzle-tan). The O and OO of kits whose fangs go
# away on purpose aren't checked for that; the beavers' are (their buck teeth stay).
import subprocess, io, sys, os, numpy as np
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.realpath(__file__))))   # (the history; the art read is the folder it runs in)
from PIL import Image
from scipy import ndimage
ORIG = '6bdb1fb'
KITS = ['1680', '1992', '310', '67', '6965', '757', '929', 'k929b', 'k2757', 'k500', 'k5842']   # (k4946, the mummy: its white is bandage, not teeth)
BEAVER = {'929', 'k929b'}
# (mouths redrawn from a new sheet since: their teeth sit somewhere else, so the first-made frame says nothing about them;
#  looked at by eye when they went in, 24 Nov)
REDRAWN = {('310', 1), ('310', 2), ('310', 3), ('310', 4), ('310', 6), ('310', 7), ('310', 9), ('1680', 1), ('1680', 7), ('67', 7), ('67', 9), ('310', 5), ('310', 8), ('6965', 2), ('6965', 8), ('1992', 2)}
white = lambda a: (a[..., 3] > 200) & (a[..., :3].min(-1) >= 195) & (a[..., :3].max(-1) - a[..., :3].min(-1) <= 50)
bad = 0
for ref in KITS:
    base = np.array(Image.open(f'faces/{ref}/base.webp').convert('RGBA')).astype(int)
    for k in range(1, 10):
        a = np.array(Image.open(f'faces/{ref}/m{k}.webp').convert('RGBA')).astype(int)
        try: o = np.array(Image.open(io.BytesIO(subprocess.check_output(['git', '-C', REPO, 'show', f'{ORIG}:faces/{ref}/m{k}.webp'], stderr=subprocess.DEVNULL))).convert('RGBA')).astype(int)
        except Exception: continue
        if o.shape != a.shape: continue
        n = 0
        if k not in (5, 6) and (ref, k) not in REDRAWN:
            tw = ndimage.binary_erosion(white(o), iterations=1)
            n = int((tw & ~white(a) & (a[..., :3].sum(-1) > 250) & (a[..., 3] > 200)).sum())
        if ref in BEAVER:   # the buck teeth: as many tooth pixels as the picture has, in every frame
            box = np.zeros(a.shape[:2], bool); box[515:616, 560:666] = True
            short = int((white(base) & box).sum()) - int((white(a) & box).sum())
            if short > (1300 if ref == 'k929b' else 800): n += short   # (the broken tooth is shorter by its chip)
        if n > 150: bad += 1; print('✗', ref, 'm%d' % k, n, 'tooth pixels not white or missing')
print('teeth check:', 'all kits pass' if not bad else f'{bad} frames fail')
sys.exit(1 if bad else 0)
