# Who talks when, worked out apart from the app (for the held-out clips' expected results): the voice prints of every
# quarter second, clustered (average-link, cosine) with no knowledge of faces or lips; each cluster then named by hand from
# the clip's close-ups. Prints the clusters' timeline.
# Usage: python3 vclust.py <voice.json> <k> [gate]
import json, sys, numpy as np
from scipy.cluster.hierarchy import linkage, fcluster
v = json.load(open(sys.argv[1])); k = int(sys.argv[2])
t = np.array(v['t']); E = np.array(v['e']); rms = np.array(v['rms'])
r = np.sort(rms); gate = float(sys.argv[3]) if len(sys.argv) > 3 else max(0.003, min(r[int(len(r) * .15)] * 2.5, r[int(len(r) * .9)] * 0.05))
on = rms > gate
Z = linkage(E[on], 'average', metric='cosine'); lab = np.zeros(len(t), int) - 1; lab[on] = fcluster(Z, k, 'maxclust')
for c in range(1, k + 1):
    m = E[lab == c].mean(0); m /= np.linalg.norm(m)
    print('cluster', c, 'n', (lab == c).sum(), 'spread', round(float(np.mean([1 - e @ m for e in E[lab == c]])), 2))
cs = [E[lab == c].mean(0) / np.linalg.norm(E[lab == c].mean(0)) for c in range(1, k + 1)]
print(' '.join(f'{a + 1}-{b + 1}:{1 - cs[a] @ cs[b]:.2f}' for a in range(k) for b in range(a + 1, k)))
line = ''
for x, l in zip(t, lab): line += f'{x:5.2f}:{"." if l < 0 else l}  '
print(line)
