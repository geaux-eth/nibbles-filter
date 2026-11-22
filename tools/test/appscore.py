# The app's own lines (result.json) scored like diar.py: every quarter second of talking, the right person's line?
import json, sys, numpy as np
D, name, tf = sys.argv[1:4]
R = json.load(open(f'{D}/{name}.result.json')); T = json.load(open(tf))[name]; m = T['map']
def at(x):
    for a, b, w, *_ in R['lines']:
        if a <= x < b: return w
    return -1
ok = n = 0; miss = []
for a, b, w in T['lines']:
    for x in np.arange(a + 0.25, b - 0.25, 0.25):
        n += 1; g = at(x)
        if g == m.get(w, -2): ok += 1
        else: miss.append(f'{x:.2f}{w}:{g}')
print(f'{name} (app): {100 * ok / max(1, n):.0f}% right'); print(' '.join(miss))
