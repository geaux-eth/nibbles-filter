# Read a tracking-device report from the debug site (nf_reports rows with a note starting "[trace]") as a timeline.
# Usage: python3 tools/trace_read.py <file>   (the row's data as JSON, or one JSON report per line, as the test harness keeps them)
import sys, json

def show(d):
    if 'data' in d and isinstance(d['data'], dict): d = d['data']
    r = d.get('run') or {}
    print(f"== {d.get('state')}  run {r.get('id')}  {r.get('at')}")
    print(f"   phone: {r.get('ua', '')[:110]}")
    print(f"   cores {r.get('cores')}  memory {r.get('mem')}  screen {r.get('screen')}  network {r.get('net')}  screen lock possible {r.get('wake')}")
    if r.get('file'): print(f"   file: {r['file'].get('size', 0) / 1e6:.1f} MB {r['file'].get('type')}")
    c = d.get('clip') or {}; print(f"   clip: {c.get('dur')} s, part {c.get('part')}, {c.get('w')}x{c.get('h')}")
    print(f"   step times (s from start): {d.get('times')}")
    n = d.get('n') or {}
    if n.get('seek'): print(f"   frame reads: {n['seek']}  total {n['seekMs'] / 1000:.1f} s  avg {n['seekMs'] / n['seek']:.0f} ms  slow {n.get('slowSeek')}")
    if n.get('scan'): print(f"   face looks: {n['scan']}  total {n['scanMs'] / 1000:.1f} s  avg {n['scanMs'] / n['scan']:.0f} ms  faces {n.get('faces')}  slow {n.get('slowScan', 0)}")
    print(f"   went to background: {n.get('hide', 0)} times")
    f = d.get('found') or {}
    print(f"   people: {len(f.get('people') or [])}  lines: {len(f.get('lines') or [])}  sound: {f.get('sound')}  voice: {f.get('voice')}  err: {f.get('err')}")
    last = 0
    for e in d.get('ev', []):
        t, k = e[0], e[1]; v = e[2] if len(e) > 2 else ''
        gap = '' if t - last < 5000 else f'   <-- {(t - last) / 1000:.0f} s with nothing new'
        print(f"   {t / 1000:7.1f}  {k:10} {json.dumps(v) if v != '' else ''}{gap}"); last = t

src = open(sys.argv[1]).read().strip()
try: show(json.loads(src))
except json.JSONDecodeError:
    for line in src.splitlines(): show(json.loads(line))
