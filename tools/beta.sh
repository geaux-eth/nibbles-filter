#!/bin/sh
# Beta site: https://geaux-eth.github.io/nibbles-filter/beta/
#   tools/beta.sh start    copy the live code into beta/ (beta then gets the changes)
#   tools/beta.sh promote  copy beta/ over the live code (after GEAUX has tried it)
# Only the code (index.html, kit.js, fx.js, builder.js, lipsync-worker.js) is separate; art, data and backgrounds are shared.
set -e
cd "$(dirname "$0")/.."
case "$1" in
  start)
    mkdir -p beta
    cp kit.js fx.js builder.js lipsync-worker.js beta/ 2>/dev/null || cp kit.js fx.js builder.js beta/
    sed -e 's#<html lang="en">#<html lang="en" data-code="beta/">#' -e 's#<head>#<head>\n<base href="../">#' -e 's#<title>Nibble FILTER</title>#<title>Nibble FILTER (beta)</title>#' index.html > beta/index.html ;;
  promote)
    cp beta/kit.js beta/fx.js beta/builder.js beta/lipsync-worker.js .
    sed -e 's#<html lang="en" data-code="beta/">#<html lang="en">#' -e '/^<base href="..\/">$/d' -e 's#<title>Nibble FILTER (beta)</title>#<title>Nibble FILTER</title>#' beta/index.html > index.html ;;
  *) echo "usage: tools/beta.sh start|promote"; exit 1 ;;
esac
