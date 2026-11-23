# The Nibbles the all-Nibbles check runs first: every kind with every mouth trait (two each, different skins), every outfit
# and every skin once. What makes a Nibble's talking mouths is its kind's kit, its mouth trait (a twin's face or its own),
# its clothes (kept from its own picture) and its colours: this covers every combination of those that can go wrong on its
# own, in about an hour. The whole collection (8,888, about a day on this machine) runs after it.
#   python3 tools/test/nibpick.py [seed] > ids.txt
import json, random, sys
T = json.load(open('data/traits-min.json')); K = T['k']; V = T['v']
def tr(i):
    row = T['t'][i - 1]; return {K[j]: (V[j][row[j]] if row[j] >= 0 else None) for j in range(len(K))}
A = {i: tr(i) for i in range(1, len(T['t']) + 1)}
rnd = random.Random(int(sys.argv[1]) if len(sys.argv) > 1 else 1); pick = []
by = {}
for i, a in A.items(): by.setdefault((a['Character'], a['Mouth']), []).append(i)
for k in sorted(by, key=str):
    ids = by[k][:]; rnd.shuffle(ids); seen = set()
    for i in ids:
        if A[i]['Skin'] in seen: continue
        seen.add(A[i]['Skin']); pick.append(i)
        if len(seen) == 2: break
for trait in ('Outfit', 'Skin'):
    have = {A[i][trait] for i in pick}; by = {}
    for i, a in A.items(): by.setdefault(a[trait], []).append(i)
    for v in sorted(by, key=str):
        if v not in have: pick.append(rnd.choice(by[v]))
print(','.join(map(str, sorted(set(pick)))))
