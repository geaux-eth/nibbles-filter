#!/bin/sh
# Does the all-Nibbles check catch what GEAUX caught? Builds copies of the site with the art and code he complained about,
# runs the check on the Nibbles each problem hit, and says whether the check fails them (it must) and passes today's.
#   teeth   brown bear fangs, beaver teeth gone (the art of e34aa17, 22 Nov)      -> teeth_check.py (kit art)
#   chip    the broken-tooth beaver's white box (k929b of 3a86f9e)                 -> boxEdge / seam
#   scrib   scribbles over beaver bows and collars (kit art and engine of 8a251c4) -> scraps
#   drool   drool and tongue flashing between words (no twin rest face)            -> restFlash
# Usage: tools/test/nibvalidate.sh            (about 20 minutes)
set -e
R=$(cd "$(dirname "$0")/../.." && pwd); S=/tmp/claude-0/-home-claude/983647b0-485b-5cec-a0d0-3276a7c1b795/scratchpad; B=$S/bad; O=$S/val; rm -rf "$O"; mkdir -p "$B" "$O"
mk() { d=$B/$1; rm -rf "$d"; mkdir -p "$d/faces"; for f in "$R"/*; do n=$(basename "$f"); case $n in node_modules|faces|beta) ;; *) ln -s "$f" "$d/$n";; esac; done
  cp -r "$R/beta" "$d/beta"; for f in "$R"/faces/*; do ln -s "$f" "$d/faces/$(basename "$f")"; done; }
old() { (cd "$B/$1" && rm -rf "$3" && (cd "$R" && git archive "$2" "$3") | tar -x); }
mk teeth; for k in $(cd "$R" && git ls-tree --name-only e34aa17 faces/ | grep -E 'faces/(k|271$|929$|1680$|1992$|67$|6965$|757$)'); do old teeth e34aa17 "$k"; done
mk chip; old chip 3a86f9e faces/k929b
mk scrib; for k in $(cd "$R" && git ls-tree --name-only 8a251c4 faces/ | grep -E 'faces/(k|929$)'); do old scrib 8a251c4 "$k"; done; (cd "$R" && git show 8a251c4:beta/kit.js) > "$B/scrib/beta/kit.js"
mk drool; sed -i 's/^\(\s*\)if (!rig \&\& (donor || !PLAIN_MOUTH/\1if (false \&\& !rig \&\& (donor || !PLAIN_MOUTH/' "$B/drool/beta/index.html"
grep -q 'if (false && !rig' "$B/drool/beta/index.html"
BEAR=10,19,32,52,100,117,161,197; BEAV=9,22,36,294,348,394; BROKEN=214,489,580,593,4395; DROOL=8,38,57,59,177,199
run() { ROOT=$2 node "$R/tools/test/nibcheck.mjs" "$3" "$O/$1" > "$O/$1.log" 2>&1 || true; }
run now "$R" $BEAR,$BEAV,$BROKEN,$DROOL
run chip "$B/chip" $BROKEN
run scrib "$B/scrib" $BEAV
run drool "$B/drool" $DROOL
echo '== teeth (kit art): the old art'; (cd "$B/teeth" && python3 "$R/tools/test/teeth_check.py" | tail -n 1) || true
echo '== teeth (kit art): today'; (cd "$R" && python3 tools/test/teeth_check.py | tail -n 1) || true
python3 - "$O" <<'P'
import json, sys
O = sys.argv[1]
def rd(n): return {r['id']: r for r in map(json.loads, open(f'{O}/{n}/results.jsonl'))}
now = rd('now'); ok = True
for n, want in (('chip', ('boxEdge', 'seam')), ('scrib', 'scraps'), ('drool', 'restFlash')):
    R = rd(n); want = (want,) if isinstance(want, str) else want
    hit = [i for i, r in R.items() if any(f.split()[0] in want for f in r['fail'])]
    print(f'{n:6s} old version: {len(hit)}/{len(R)} Nibbles fail {"/".join(want)}  {hit}')
    ok &= bool(hit)
    clean = [i for i in R if i in now and not any(f.split()[0] in want for f in now[i]['fail'])]
    print(f'{"":6s} today:       {len(clean)}/{len(R)} pass it')
print('the check catches every old problem' if ok else 'THE CHECK MISSES AN OLD PROBLEM')
P
