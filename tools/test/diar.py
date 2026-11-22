# Prototype: who talks when by clustering the voices first (diarization), then naming each voice by the faces.
# 1. every voiced quarter second's voice print; clustered into as many voices as people found (average link, then
#    refined to the centroids); points far from every voice are left unknown
# 2. each voice named: the person whose lips move most while it's heard (and who's on screen for it)
# 3. scored every quarter second against a truth list
# Usage: python3 diar.py <dir> <clip> [truth json key]
import json, sys, numpy as np
from scipy.cluster.hierarchy import linkage, fcluster
D, name = sys.argv[1], sys.argv[2]
V = json.load(open(f'{D}/{name}.voice.json')); F = json.load(open(f'{D}/{name}.follow.json')); R = json.load(open(f'{D}/{name}.result.json'))
t = np.array(V['t']); E = np.array(V['e']); rms = np.array(V['rms'])
r = np.sort(rms); gate = max(0.003, min(r[int(len(r) * .15)] * 2.5, r[int(len(r) * .9)] * 0.05)); on = rms > gate
P = [p for p in R['people']]; real = [i for i, p in enumerate(P) if not p.get('off')]; K = len(real)
smp = list(F.values())
def act(i, x):   # lip activity around x, relative to that face's busiest (like the app), -1 when not seen
    s = smp[i]['smp'] if i < len(smp) else []
    mo = [q['mo'] for q in s]; sc = max(0.01, np.percentile(mo, 90)) if mo else 0.01
    w = [q for q in s if x - 0.5 <= q['t'] <= x + 0.5]
    if len(w) < 2: return -1
    a = np.mean([abs(w[j + 1]['mo'] - w[j]['mo']) for j in range(len(w) - 1)]) / sc * 6
    return a
busy = []
for i in range(len(smp)):
    v = [act(i, x) for x in np.arange(0, t[-1] + 1, 0.25)]; v = [a for a in v if a >= 0]; busy.append(max(0.6, np.percentile(v, 90) if v else 0.6))
def rel(i, x): a = act(i, x); return -1 if a < 0 else a / busy[i]
idx = np.where(on)[0]; X = E[idx]
Z = linkage(X, 'average', metric='cosine'); lab = fcluster(Z, K, 'maxclust') - 1
for it in range(5):   # refine: each point to its nearest voice
    C = np.array([X[lab == c].mean(0) / np.linalg.norm(X[lab == c].mean(0)) if (lab == c).any() else np.zeros(X.shape[1]) for c in range(K)])
    d = 1 - X @ C.T; lab = d.argmin(1)
dist = d.min(1)
L = np.full(len(t), -1); L[idx] = np.where(dist < 0.75, lab, -1)
# name each voice: mean relative lip activity of each person over the voice's quarter seconds (unseen = 0)
S = np.zeros((K, len(smp)))
for c in range(K):
    pts = t[L == c]
    for i in range(len(smp)):
        S[c, i] = np.mean([max(0, rel(i, x)) for x in pts]) if len(pts) else 0
names = {}
used = set()
for c, i in sorted([(c, i) for c in range(K) for i in range(len(smp))], key=lambda ci: -S[ci[0], ci[1]]):
    if c in names or i in used: continue
    names[c] = i; used.add(i)
print('voices', [(c, int((L == c).sum())) for c in range(K)], 'names', names); print(np.round(S, 2))
who = np.array([names.get(c, -1) if c >= 0 else -1 for c in L])
if len(sys.argv) > 3:
    T = json.load(open(sys.argv[3]))[name]; m = T['map']   # truth: [[t0, t1, label]], map label -> person index chosen by the app at at(t) etc.
    ok = n = 0; miss = []
    for a, b, w in T['lines']:
        for x in np.arange(a + 0.25, b - 0.25, 0.25):
            k = np.argmin(abs(t - x)); n += 1; g = who[k] if L[k] >= 0 else -9
            if g == m.get(w, -2): ok += 1
            else: miss.append(f'{x:.2f}{w}:{g}')
    print(f'{name}: {100 * ok / max(1, n):.0f}% of talking quarter-seconds to the right voice'); print(' '.join(miss))
else:
    print(' '.join(f'{x:.2f}:{w}' for x, w, l in zip(t, who, L) if l >= -1))
