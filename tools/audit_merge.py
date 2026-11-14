# Merges the leak audit shards: audit/report.json (every Nibble, worst first), audit/summary.md,
# audit/flags/<id>.webp and contact sheets audit/sheet-<n>.webp of the flagged ones, worst first.
import json, glob, os, sys, shutil
from collections import Counter
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out + '/flags', exist_ok=True)
rows = []
for f in glob.glob(src + '/report-*.json'): rows += json.load(open(f))
rows.sort(key=lambda r: -(r.get('leak') or 0))
json.dump(rows, open(out + '/report.json', 'w'))
flag = [r for r in rows if r.get('leak')]
err = [r for r in rows if r.get('error')]
for r in flag:
    p = f"{src}/flags/{r['id']}.webp"
    if os.path.exists(p): shutil.copy(p, f"{out}/flags/{r['id']}.webp")
# contact sheets: 30 rows each, id and leak size written on each row
for n in range(0, len(flag), 30):
    part = [r for r in flag[n:n + 30] if os.path.exists(f"{out}/flags/{r['id']}.webp")]
    if not part: continue
    ims = [Image.open(f"{out}/flags/{r['id']}.webp").convert('RGB') for r in part]
    W = max(i.width for i in ims) + 150
    sheet = Image.new('RGB', (W, 160 * len(ims)), 'white'); d = ImageDraw.Draw(sheet)
    for j, (r, im) in enumerate(zip(part, ims)):
        sheet.paste(im, (150, j * 160)); d.text((8, j * 160 + 60), f"#{r['id']} {r['kind']}\n{r['skin']}\nleak {r['leak']} @{r['frame']}", fill='black')
    sheet.save(f"{out}/sheet-{n // 30 + 1}.webp", quality=80)
kinds = Counter(r['kind'] for r in rows); fk = Counter(r['kind'] for r in flag)
with open(out + '/summary.md', 'w') as f:
    f.write(f"# Leak audit\n\n{len(rows)} Nibbles checked, {len(flag)} flagged, {len(err)} errors.\n\n| Kind | Checked | Flagged |\n|---|---|---|\n")
    for k in sorted(kinds): f.write(f"| {k} | {kinds[k]} | {fk.get(k, 0)} |\n")
    f.write("\nWorst 50: " + ", ".join(f"#{r['id']} ({r['leak']})" for r in flag[:50]) + "\n")
    if err: f.write("\nErrors: " + ", ".join(f"#{r['id']}" for r in err[:200]) + "\n")
print(len(rows), 'rows', len(flag), 'flagged', len(err), 'errors')
