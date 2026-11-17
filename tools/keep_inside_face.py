#!/usr/bin/env python3
"""Undo kit-frame changes that spill outside the face.

usage: keep_inside_face.py <id> <seed x,y> [<seed x,y> ...] [--grow N] [--frames 2,3,4]

The seeds are points on the face/jaw skin in m0 (the rest frame). Each seed's
same-colour region in m0 is the face; it is grown by N pixels (default 10) to take
in its outline. In every other frame, any pixel outside that area is put back to
m0, so smudges a drawing tool left on the neck, clothes or background go away.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

args = sys.argv[1:]
grow, frames = 10, None
if '--grow' in args:
    i = args.index('--grow'); grow = int(args[i + 1]); del args[i:i + 2]
if '--frames' in args:
    i = args.index('--frames'); frames = [int(v) for v in args[i + 1].split(',')]; del args[i:i + 2]
nid, seeds = args[0], [tuple(int(v) for v in s.split(',')) for s in args[1:]]
d = f'faces/{nid}'
a0 = np.array(Image.open(f'{d}/m0.webp').convert('RGBA')).astype(int)
face = np.zeros(a0.shape[:2], bool)
for x, y in seeds:
    c = a0[y, x]
    near = (np.abs(a0[..., :3] - c[:3]).sum(2) < 60) & (a0[..., 3] > 128)
    lab, _ = ndimage.label(near)
    face |= lab == lab[y, x]
face = ndimage.binary_fill_holes(face)
keep = ndimage.binary_dilation(face, iterations=grow)
for k in frames or range(1, 10):
    p = f'{d}/m{k}.webp'
    a = np.array(Image.open(p).convert('RGBA')).astype(int)
    n = int(((np.abs(a - a0).sum(2) > 0) & ~keep).sum())
    a[~keep] = a0[~keep]
    Image.fromarray(a.astype(np.uint8)).save(p, quality=95, method=6)
    print(f'm{k}: put back {n} px')
