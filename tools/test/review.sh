#!/bin/sh
# The review before anything goes to GEAUX (problems.md): every clip through every check, the talking clips made into
# videos and checked frame by frame, contact sheets of each made video to look through, the automatic picks, and the art
# sweep. Nothing ships with a failing check or a sheet nobody looked at.
# Usage: tools/test/review.sh [reading set dir]   (default: the scratchpad's gv1b; the held-out clips live in gho)
set -e
S=/tmp/claude-0/-home-claude/983647b0-485b-5cec-a0d0-3276a7c1b795/scratchpad
G=${1:-$S/gv1b}; OUT=$S/review/$(date +%m%d-%H%M); mkdir -p "$OUT"
cd "$(dirname "$0")/../.."
echo "== every clip, every check ($G)"; GDIR=$G node $S/ch/golden.mjs 2>&1 | grep -E "✗|checks pass" | tee "$OUT/golden.txt"
echo "== held-out clips"; GDIR=$S/gho node $S/ch/golden.mjs office1 office2 sunny 2>&1 | grep -E "✗|✓|checks pass" | tee "$OUT/heldout.txt" || true
for c in sitcom podcast26 macho; do echo "== made video: $c"; RENDER=1 GDIR=$G node $S/ch/golden.mjs $c 2>&1 | grep -E "made video|✗" | tee -a "$OUT/made.txt"
  [ -f "$G/$c.made.webm" ] && python3 tools/test/sheet.py "$G/$c.made.webm" "$OUT/made_$c.png"; done
for c in office1 office2 sunny; do echo "== made video (held out): $c"; RENDER=1 GDIR=$S/gho node $S/ch/golden.mjs $c 2>&1 | grep -E "made video|✗" | tee -a "$OUT/made.txt"
  [ -f "$S/gho/$c.made.webm" ] && python3 tools/test/sheet.py "$S/gho/$c.made.webm" "$OUT/made_$c.png"; done
echo "== automatic picks"; node $S/ch/castmix.mjs 2>&1 | tail -1 | tee "$OUT/picks.txt"
echo "== art sweep"; node tools/test/sweep.mjs $S/sweep_pick.json "$OUT/sweep" | tail -3
echo "sheets to look through: $OUT"
