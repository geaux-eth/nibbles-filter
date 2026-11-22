# A made video as contact sheets: four pictures a second, each with its time, to look through like GEAUX would.
# Usage: python3 tools/test/sheet.py <video> <out.png>   (several sheets of 60 frames: out_1.png, out_2.png ...)
import sys, subprocess, glob, os, tempfile
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
d = tempfile.mkdtemp()
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', 'fps=4,scale=180:-1', d + '/%04d.png'], check=True)
fs = sorted(glob.glob(d + '/*.png')); w, h = Image.open(fs[0]).size; cols, per = 12, 60
for s in range(0, len(fs), per):
    part = fs[s:s + per]; rows = (len(part) + cols - 1) // cols
    W = Image.new('RGB', (cols * w, rows * (h + 14)), 'white'); dr = ImageDraw.Draw(W)
    for k, f in enumerate(part):
        x, y = (k % cols) * w, (k // cols) * (h + 14); W.paste(Image.open(f), (x, y + 14)); dr.text((x + 2, y), f'{(s + k) * 0.25:.2f}s', fill='black')
    W.save(out.replace('.png', f'_{s // per + 1}.png'))
for f in fs: os.remove(f)
