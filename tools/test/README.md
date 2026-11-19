# Test harness (runs in Claude's workspace)

- `golden.mjs`: the test clips and what each should find. The first run of a clip reads it fully (minutes) and saves
  its first look and face readings; after that every clip re-runs in ~10 s. `NOAV=1` turns off the mouth-to-sound match
  (to compare), `FRESH=1` reads again from scratch. The clips and saved readings stay out of this repo (people's videos).
- `wkserve.mjs`, `wd.mjs`, `wkrun.mjs`: the same site in WebKit (Safari's engine, WebKitGTK + WebKitWebDriver),
  a clip all the way through to the made video.
- `freval.mjs`: face recognizers compared on the test clips.
