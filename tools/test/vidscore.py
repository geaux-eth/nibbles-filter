# The made-video score (problems.md): every made video measured against what GEAUX has called a bad video, each with a
# pass mark. Reads what the app drew, frame by frame (<clip>.mlog.json, written by golden.mjs with RENDER=1), the clip's
# lip-sync cues, and the hand-made edit of who talks when (ho/truth.json, ho/truth_sitcom.json) where there is one.
#   python3 tools/test/vidscore.py <reading dir>:<clip> ...      exit code 1 when anything fails
# The measures (frames are the app's drawn frames; 'talking' = the frames the app hears a voice in a line):
#   on screen    the one talking is on screen, every quarter second they talk; in pauses, the edit's pick   90%+
#   flash        nobody on screen for under 0.4 s between two others                                     none
#   no talker    a mouth open where the edit says nobody talks (music, laughs, silence; 0.4 s margins)    under 3%
#   no voice     a mouth open with no voice within 0.2 s                                                 under 3%
#   mumbling     of the open mouths while talking, the small open one                                    60% or less
#   moving       mouth changes a second while talking (real speech animates ~6-8)                        5 or more
#   shouting     the wide AH, of the open mouths                                                         30% or less
#   teeth grin   the teeth mouth, of the open mouths                                                     8% or less
#   shut talking the closed mouth while talking                                                          35% or less
import json, sys, os
S = '/tmp/claude-0/-home-claude/983647b0-485b-5cec-a0d0-3276a7c1b795/scratchpad'
TR = {}
for f in ('truth.json', 'truth_sitcom.json'):
    p = f'{S}/ho/{f}'
    if os.path.exists(p): TR.update(json.load(open(p)))
bad_all = 0
for arg in sys.argv[1:]:
    d, n = arg.split(':'); d = d if d.startswith('/') else f'{S}/{d}'
    L = json.load(open(f'{d}/{n}.mlog.json'))['log']; N = len(L)
    shut = (0, 1, 9); res = []
    T = TR.get(n)
    if T:
        m = T['map']; ok = tot = 0; ts = [x[0] for x in L]; import bisect
        def who(t):
            k = min(N - 1, max(0, bisect.bisect_left(ts, t))); return L[k][1]
        # (while someone talks, they're the one on screen (T['talk'], from the sound, where the edit has it; else its lines);
        #  in a pause the edit's own choice (GEAUX's edit of the sitcom covers the pauses too))
        talk = T.get('talk', T['lines'])
        for a, b, w in talk:
            t = a + 0.25
            while t < b - 0.25: tot += 1; ok += who(t) == m.get(w, -9); t += 0.25
        if 'talk' in T:
            for a, b, w in T['lines']:
                t = a + 0.25
                while t < b - 0.25:
                    if not any(c - 0.5 <= t < d + 0.5 for c, d, _ in talk): tot += 1; ok += who(t) == m.get(w, -9)
                    t += 0.25
        res.append(('on screen', round(100 * ok / max(1, tot)), '%', ok >= 0.9 * tot))
        T = dict(T, lines=talk)
        inl = lambda t: any(a - 0.4 <= t < b + 0.4 for a, b, _ in T['lines']) or any(a <= t < b for a, b in T.get('skip', []))   # (skip: voices the edit can't give anyone, not scored)
        op = [x for x in L if x[2] not in shut]; nt = [x for x in op if not inl(x[0])]
        res.append(('no talker', round(100 * len(nt) / max(1, len(op)), 1), '%', len(nt) <= 0.03 * max(1, len(op))))
    # flash: runs of one person shorter than 0.4 s between two others
    runs = []
    for x in L:
        if runs and runs[-1][2] == x[1]: runs[-1][1] = x[0]
        else: runs.append([x[0], x[0], x[1]])
    fl = [r for i, r in enumerate(runs) if 0 < i < len(runs) - 1 and (runs[i + 1][0] - r[0]) < 0.4]
    res.append(('flash', len(fl), '', not fl))
    op = [i for i, x in enumerate(L) if x[2] not in shut]
    nv = [i for i in op if not any(L[j][6] for j in range(max(0, i - 6), min(N, i + 7)))]
    res.append(('no voice', round(100 * len(nv) / max(1, len(op)), 1), '%', len(nv) <= 0.03 * max(1, len(op))))
    v = [x for x in L if x[6]]; vo = [x for x in v if x[2] not in shut]
    dur = sum(min(0.1, b[0] - a[0]) for a, b in zip(v, v[1:])) or 1
    ch = sum(1 for a, b in zip(v, v[1:]) if a[2] != b[2] and b[0] - a[0] < 0.1)
    c = lambda k: sum(1 for x in vo if x[2] == k)
    res += [('mumbling', round(100 * c(2) / max(1, len(vo))), '%', c(2) <= 0.6 * len(vo)),
            ('moving', round(ch / dur, 1), '/s', ch / dur >= 5),
            ('shouting', round(100 * c(3) / max(1, len(vo))), '%', c(3) <= 0.3 * len(vo)),
            ('teeth grin', round(100 * c(4) / max(1, len(vo))), '%', c(4) <= 0.08 * len(vo)),
            ('shut talking', round(100 * sum(1 for x in v if x[2] == 1) / max(1, len(v))), '%', sum(1 for x in v if x[2] == 1) <= 0.35 * len(v))]
    bad = [r for r in res if not r[3]]; bad_all += len(bad)
    print(f'{n:10s}', '  '.join(f"{'✓' if r[3] else '✗'} {r[0]} {r[1]}{r[2]}" for r in res))
print('all pass' if not bad_all else f'{bad_all} failing')
sys.exit(1 if bad_all else 0)
