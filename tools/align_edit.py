# Line an edited picture (or each picture of a sheet) up with a kit's own picture, for tools/kit_from_edits.py: the
# image tool may redraw the character a little bigger, smaller or moved, so each one is fitted (scale, turn, shift)
# to the kit picture over everything except the mouth, then saved at the kit's size on white.
# Usage: python3 tools/align_edit.py <ref> <picture> <out_prefix> [rows cols]
#   one picture -> <out_prefix>.png ; a sheet (rows x cols) -> <out_prefix>1.png ... in reading order
import sys, numpy as np, cv2
from PIL import Image

ref, pic, out = sys.argv[1], sys.argv[2], sys.argv[3]
rows, cols = (int(sys.argv[4]), int(sys.argv[5])) if len(sys.argv) > 5 else (1, 1)
b = Image.open(f'faces/{ref}/base.webp').convert('RGBA'); w = Image.new('RGBA', b.size, (255, 255, 255, 255)); w.alpha_composite(b)
base = np.array(w.convert('RGB')); N = base.shape[0]
MOUTH = { '310':(400, 560, 860, 860), '929':(520, 540, 760, 800), '271':(420, 560, 900, 900) }[ref]    # left out of the fit (it's what changed)
gray = lambda a: cv2.GaussianBlur(cv2.cvtColor(a, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255, (0, 0), 2)
mask = np.ones((N, N), np.uint8); x0, y0, x1, y1 = MOUTH; mask[y0:y1, x0:x1] = 0

im = np.array(Image.open(pic).convert('RGB'))
def cells(a):   # split a sheet at its white gaps (else into equal parts)
    if rows == cols == 1: return [a]
    H, W = a.shape[:2]; white = a.min(-1) > 235
    def cuts(prof, n, L):
        out = []
        for k in range(1, n):
            c = int(L * k / n); lo, hi = max(0, c - L // (3 * n)), min(L, c + L // (3 * n))
            seg = prof[lo:hi]; best = np.where(seg >= seg.max() - 0.002)[0]; out.append(lo + int(best.mean()))
        return [0] + out + [L]
    ry, cx = cuts(white.mean(1), rows, H), cuts(white.mean(0), cols, W)
    return [a[ry[r]:ry[r + 1], cx[c]:cx[c + 1]] for r in range(rows) for c in range(cols)]

for i, c in enumerate(cells(im), 1):
    h, w_ = c.shape[:2]; s = max(h, w_)
    sq = np.full((s, s, 3), 255, np.uint8); sq[(s - h) // 2:(s - h) // 2 + h, (s - w_) // 2:(s - w_) // 2 + w_] = c
    sq = cv2.resize(sq, (N, N), interpolation=cv2.INTER_CUBIC if s < N else cv2.INTER_AREA)
    # fit: a similarity (scale, small turn, shift), coarse to fine
    warp = np.eye(2, 3, dtype=np.float32); best = None
    for sc in np.linspace(0.85, 1.18, 12):     # (a rough start for the scale, then ECC settles it)
        W0 = np.array([[sc, 0, (1 - sc) * N / 2], [0, sc, (1 - sc) * N / 2]], np.float32)
        try:
            cc, W1 = cv2.findTransformECC(gray(base), gray(sq), W0.copy(), cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), mask, 5)
        except cv2.error: continue
        if best is None or cc > best[0]: best = (cc, W1)
    cc, W1 = best
    al = cv2.warpAffine(sq, W1, (N, N), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP, borderValue=(255, 255, 255))
    name = f'{out}.png' if rows == cols == 1 else f'{out}{i}.png'
    Image.fromarray(al).save(name)
    d = np.abs(gray(base) - gray(al))[mask > 0].mean()
    print(name, 'fit %.3f' % cc, 'diff outside mouth %.3f' % d, 'scale %.3f' % np.sqrt(abs(np.linalg.det(W1[:, :2]))))
