# A made sitcom video: how often a mouth is open during the audience's laughs (heard: broadband, no voice), per laugh
import json, sys
L = [(6.3, 8.6), (18.4, 19.55), (26.1, 27.7), (32.2, 35.7)]
ml = json.load(open(sys.argv[1]))['log']
for a, b in L:
    fr = [x for x in ml if a <= x[0] < b]; op = [x for x in fr if x[2] not in (0, 1, 9)]
    print(f'laugh {a}-{b}: open {len(op)}/{len(fr)} frames', sorted(set((x[1], x[2]) for x in op))[:8])
tot = [x for x in ml if any(a <= x[0] < b for a, b in L)]; op = [x for x in tot if x[2] not in (0, 1, 9)]
print(f'all laughs: a mouth open in {len(op)}/{len(tot)} frames ({100 * len(op) / max(1, len(tot)):.0f}%)')
