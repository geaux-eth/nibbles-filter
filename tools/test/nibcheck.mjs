// The all-Nibbles check (problems.md): every Nibble made the way the app makes it, each talking mouth measured against
// the problems GEAUX has found. Writes one line per Nibble (pass/fail and why) to <out>/results.jsonl, a strip of its mouths
// for every failure, and a summary. Resumes where it left off (Nibbles already in results.jsonl are skipped).
//   node tools/test/nibcheck.mjs <ids: all | builtins | 12,34,...> <out dir>
//   env: ROOT=<site folder> (default the repo: point it at an old copy to see a check fail on old art/code)
//        LIMIT=n (first n), SHARD=i/n (every n-th, from i), STRIPS=all (a strip for every Nibble)
// The measures (all in the mouth's box, on 1000 px pictures; a kit Nibble is compared with its kit, frame by frame):
//   teethTan   teeth the kit draws white that aren't white on the Nibble: measured, not failed (teeth_check.py checks the kits)
//   scraps     new dark marks: dark on the Nibble's talking frame, dark on neither the kit's frame nor the
//              Nibble's own face (scribbles over a bow, leftover outline bits)                              fail > 250 px
//   seam       the box's edge cutting through the picture: at the edge, the frame unlike the picture where
//              the kit's mouth changes nothing (a cut-off muzzle highlight)                                  fail > 60 px
//   noOpen     a mouth that doesn't open: the wide AH's new mouth-inside under half the kit's (hidden by gum,
//              smeared); for a built-in, under 3000 px                                                       fail
//   restFlash  the face a made video rests on, unlike the shut mouth in colour (drool, tongue, gum flashing
//              between words)                                                                                fail > 2500 px
//   foreign    colours on the talking frames that are neither this Nibble's own nor a mouth's (a kit's
//              collar or muzzle colour carried over)                                                         fail > 400 px
//   boxEdge    a straight cut edge with a colour step and no outline where a talking mouth was pasted
//              (the beaver's dark rectangles, the chip's white box)                                          fail >= 18 px
//   restOpen   the face a made video rests on is an open mouth (mouth open with no voice): its new
//              mouth-inside over a third of the AH's                                                        fail
//   noTwin     a big mouth of its own (tongue, drool, open, grin) and no twin to talk from: the kit engine
//              keeps it in front of every talking mouth                                                     fail
//   prepare    the Nibble can't be made at all                                                               fail
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const S = '/tmp/claude-0/-home-claude/983647b0-485b-5cec-a0d0-3276a7c1b795/scratchpad', ROOT = process.env.ROOT || '/home/claude/nibbles-filter';
process.env.ROOT = ROOT; const { serve } = await import(S + '/serve2.mjs');
const out = process.argv[3]; fs.mkdirSync(out + '/strips', { recursive:true });
const T = JSON.parse(fs.readFileSync(ROOT + '/data/traits-min.json')), have = new Set(['full', 'fullw'].flatMap(d => fs.readdirSync(`${S}/research/${d}`).filter(f => /^\d+\.(png|webp)$/.test(f)).map(f => parseInt(f))));
const picFile = n => fs.existsSync(`${S}/research/full/${n}.png`) ? [`${S}/research/full/${n}.png`, 'image/png'] : fs.existsSync(`${S}/research/fullw/${n}.webp`) ? [`${S}/research/fullw/${n}.webp`, 'image/webp'] : null;
const pic = id => T.p[String(id)] || id, html = fs.readFileSync(ROOT + '/beta/index.html', 'utf8');
const builtins = [...html.matchAll(/option value="(\d+)">/g)].map(m => +m[1]);
let ids = process.argv[2] === 'all' ? [...new Set([...builtins, ...Array.from({ length:T.t.length }, (_, i) => i + 1).filter(id => have.has(pic(id)))])]
  : process.argv[2] === 'builtins' ? builtins : process.argv[2].split(',').map(Number);
if (process.env.SHARD) { const [i, n] = process.env.SHARD.split('/').map(Number); ids = ids.filter((_, k) => k % n === i); }
if (process.env.LIMIT) ids = ids.slice(0, +process.env.LIMIT);
const done = new Set(); const rf = out + '/results.jsonl'; if (fs.existsSync(rf)) for (const l of fs.readFileSync(rf, 'utf8').split('\n')) if (l) done.add(JSON.parse(l).id);
const b = await chromium.launch(); let pg;
const open = async () => { if (pg) await pg.close().catch(() => {}); pg = await b.newPage(); await serve(pg); await pg.route(/supabase|jsdelivr|googleapis/, r => r.fulfill({ json:[] }));
  await pg.route('https://d24r2edyfve7yo.cloudfront.net/**', r => { const m = r.request().url().match(/(\d+)\.png/), f = m && picFile(m[1]); if (f) r.fulfill({ path:f[0], contentType:f[1], headers:{ 'access-control-allow-origin':'*' } }); else r.abort(); });
  await pg.goto('http://127.0.0.1:8765/beta/index.html'); await pg.waitForFunction(() => window.__nf && window.__nf.ready, null, { timeout:120000 }); };
await open();
if (process.env.DBGF) await pg.evaluate(k => { window.__dbgFrame = k; }, +process.env.DBGF);
if (process.env.FLAGS) await pg.evaluate(f => { for (const k of f.split(',')) window[k] = true; }, process.env.FLAGS);
const kindOf = id => { const row = T.t[id - 1], j = T.k.indexOf('Character'), m = T.k.indexOf('Mouth'); return [row && row[j] >= 0 ? T.v[j][row[j]] : '?', row && row[m] >= 0 ? T.v[m][row[m]] : '?']; };
let n = 0;
for (const id of ids) {
  if (done.has(id)) continue;
  const t0 = Date.now();
  const r = await pg.evaluate(async ({ id, strip, mouthT }) => {
    const nf = window.__nf; let ok; try { ok = await nf.prepare(id); } catch (e) { return { err:'prepare: ' + String(e).slice(0, 120) }; }
    if (!ok && !nf.NIBBLES[id]) return { err:'prepare: not made' };
    const NB = nf.NIBBLES[id], L = NB.layout || {}, N = 1000, rest = nf.restOf(id), kit = NB.kit || null; let mb = L.mb;
    const load = async u => { const im = new Image(); im.src = u; await im.decode(); return im; };
    const cv = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
    const px = c => c.getContext('2d', { willReadFrequently:true }).getImageData(0, 0, N, N).data;
    const base = await load(nf.artOf(id, 'base'));
    // (a Nibble with a layout stores only its mouth's box; a built-in without one has ten whole pictures, as the app draws them)
    const frame = async k => { const c = cv(), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, N, N);
      let m = null; try { m = await load(nf.artOf(id, 'm' + k)); } catch (e) {}
      if (!mb) { g.drawImage(m || base, 0, 0, N, N); return c; }
      g.drawImage(base, 0, 0, N, N); if (m) { g.clearRect(mb[0], mb[1], m.width, m.height); g.fillStyle = '#fff'; g.fillRect(mb[0], mb[1], m.width, m.height); g.drawImage(m, mb[0], mb[1]); } return c; };
    const F = []; for (let k = 0; k < 10; k++) F.push(px(await frame(k)));
    if (!mb || mb[2] <= mb[0]) { mb = [N, N, 0, 0]; for (let k = 2; k < 10; k++) for (let p = 0; p < N * N; p++) { const i = p * 4; if (Math.abs(F[k][i] - F[1][i]) + Math.abs(F[k][i + 1] - F[1][i + 1]) + Math.abs(F[k][i + 2] - F[1][i + 2]) > 60) { const x = p % N, y = (p / N) | 0; if (x < mb[0]) mb[0] = x; if (y < mb[1]) mb[1] = y; if (x > mb[2]) mb[2] = x; if (y > mb[3]) mb[3] = y; } } }
    if (mb[2] <= mb[0]) return { err:'mouth never changes' };
    const baseP = (() => { const c = cv(), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, N, N); g.drawImage(base, 0, 0, N, N); return px(c); })();
    let K = null;
    if (kit) { K = []; const kb = await load(`faces/${kit}/base.webp`);
      for (let k = 0; k < 10; k++) { const c = cv(), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, N, N); g.drawImage(kb, 0, 0, N, N); if (k) { const m = await load(`faces/${kit}/m${k}.webp`); g.drawImage(m, 0, 0, N, N); } K.push(px(c)); } }
    const x0 = Math.max(0, mb[0] - 4), y0 = Math.max(0, mb[1] - 4), x1 = Math.min(N - 1, mb[2] + 4), y1 = Math.min(N - 1, mb[3] + 4);
    const sum = (A, i) => A[i] + A[i + 1] + A[i + 2], dark = (A, i) => sum(A, i) < 200;
    const white = (A, i) => Math.min(A[i], A[i + 1], A[i + 2]) >= 195 && Math.max(A[i], A[i + 1], A[i + 2]) - Math.min(A[i], A[i + 1], A[i + 2]) <= 50;
    const red = (A, i) => A[i] > A[i + 1] * 1.8 && A[i] > A[i + 2] * 1.3 && A[i] > 60;   // (a mouth's dark red, red or pink; not brown fur (181,111,66), which passed a looser test)
    const mouthy = (A, i) => A[i] > A[i + 1] * 1.25 && A[i] > A[i + 2] * 1.05 && A[i] > 60;   // (a mouth's colours, light pink tongues too: not 'foreign')
    const inside = (A, i) => red(A, i) && sum(A, i) < 600;   // (a mouth's inside: its red and tongue; not 'dark', which on a dark-furred Nibble is the fur)
    const dif = (A, B, i) => Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
    // masks over the box, grown by r (a square): 'is there one of these within r px'
    const W = x1 - x0 + 1, H = y1 - y0 + 1, at = (x, y) => (y - y0) * W + (x - x0);
    const mask = (A, test) => { const o = new Uint8Array(W * H); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (test(A, (y * N + x) * 4)) o[at(x, y)] = 1; return o; };
    const grow = (M, r) => { const t = new Uint8Array(W * H), o = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) { let last = -1e9; for (let x = 0; x < W; x++) { if (M[y * W + x]) last = x; if (x - last <= r) t[y * W + x] = 1; } last = 1e9; for (let x = W - 1; x >= 0; x--) { if (M[y * W + x]) last = x; if (last - x <= r) t[y * W + x] = 1; } }
      for (let x = 0; x < W; x++) { let last = -1e9; for (let y = 0; y < H; y++) { if (t[y * W + x]) last = y; if (y - last <= r) o[y * W + x] = 1; } last = 1e9; for (let y = H - 1; y >= 0; y--) { if (t[y * W + x]) last = y; if (last - y <= r) o[y * W + x] = 1; } }
      return o; };
    // the Nibble's own colours (its whole picture and its rest face, 16 levels a channel, grown by one level)
    const own = new Uint8Array(4096); for (const P of [F[0], F[rest]]) for (let i = 0; i < P.length; i += 4) own[(P[i] >> 4) * 256 + (P[i + 1] >> 4) * 16 + (P[i + 2] >> 4)] = 1;
    const ownG = new Uint8Array(4096); for (let q = 0; q < 4096; q++) if (own[q]) { const r = q >> 8, g = (q >> 4) & 15, b2 = q & 15; for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) for (let d = -1; d <= 1; d++) { const rr = r + a, gg = g + c, bb = b2 + d; if (rr >= 0 && gg >= 0 && bb >= 0 && rr < 16 && gg < 16 && bb < 16) ownG[rr * 256 + gg * 16 + bb] = 1; } }
    const ownNear = (A, i) => ownG[(A[i] >> 4) * 256 + (A[i + 1] >> 4) * 16 + (A[i + 2] >> 4)];
    const darkNear0 = grow(mask(F[0], dark), 3), darkNearR = grow(mask(F[rest], dark), 3);
    const m = { teethTan:0, scraps:0, seam:0, restFlash:0, foreign:0, boxEdge:0, open:[] }, per = {};
    // straight cut edges: where a talking frame's change from the shut mouth stops along a straight line, with a colour
    // step across it and no outline, that the Nibble's own picture doesn't have there (a pasted box: the beaver's dark
    // rectangles, the chip's white box)
    const edgeRun = A0 => { let best = 0, A = A0;
      // an edge: a hard colour step (> 45) with one side flat for 2 px across it (a pasted region's own edge; the other side
      // may be anything). One with dark within 5 px on the other side, or dark on the flat side, is an outline's edge: a run made mostly of those is a
      // stretch of drawn outline (a flat lip), not a cut
      const P = (x, y) => ((y + y0) * N + x + x0) * 4, ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
      const d3 = (i, j) => Math.abs(A[i] - A[j]) + Math.abs(A[i + 1] - A[j + 1]) + Math.abs(A[i + 2] - A[j + 2]);
      const step = (xa, ya, dx, dy) => { if (!ok(xa + 2 * dx, ya + 2 * dy) || !ok(xa - 4 * dx, ya - 4 * dy)) return 0;
        const i = P(xa, ya), j = P(xa - dx, ya - dy); if (d3(i, j) <= 45) return 0;
        let side = 0; if (d3(i, P(xa + dx, ya + dy)) <= 20 && d3(i, P(xa + 2 * dx, ya + 2 * dy)) <= 20) side = 1;
        else if (d3(j, P(xa - 2 * dx, ya - 2 * dy)) <= 20 && d3(j, P(xa - 3 * dx, ya - 3 * dy)) <= 20) side = -1; else return 0;
        let ink = dark(A, side > 0 ? i : j); for (let t = 1; t <= 5; t++) { const q = side > 0 ? P(xa - (t) * dx, ya - (t) * dy) : P(xa + (t - 1) * dx, ya + (t - 1) * dy); if (dark(A, q)) ink = true; }
        return ink ? 2 : 1; };
      const scan = (dx, dy) => { const L1 = dx ? W : H, L2 = dx ? H : W;
        for (let u = 1; u < L1; u++) { let run = 0, ink = 0;
          for (let v = 0; v < L2; v++) { const x = dx ? u : v, y = dx ? v : u; A = A0; const e = step(x, y, dx, dy); A = F[0]; const e0 = e && step(x, y, dx, dy); A = A0;
            if (e && !e0) { run++; if (e === 2) ink++; if (run > best && ink < 0.7 * run) { best = run; m.edgeAt = [x + x0, y + y0, dx ? 'v' : 'h']; } } else { run = 0; ink = 0; } } } };
      scan(1, 0); scan(0, 1);
      return best; };
    for (let k = 1; k < 10; k++) { const A = F[k]; let tt = 0, sc = 0, se = 0, fo = 0;
      const KredNear = K && grow(mask(K[k], red), 8), KdarkNear = K && grow(mask(K[k], dark), 3);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * N + x) * 4, p = at(x, y);
        if (K) {
          if (KredNear[p] && white(K[k], i) && !white(K[1], i) && !white(A, i) && sum(A, i) > 250) tt++;
          if (dark(A, i) && !KdarkNear[p] && !darkNearR[p] && !darkNear0[p]) sc++;
          const edge = x <= mb[0] + 1 || y <= mb[1] + 1 || x >= mb[2] - 1 || y >= mb[3] - 1;
          if (edge && dif(A, baseP, i) > 80 && dif(K[k], K[0], i) <= 30) se++; }
        if (!dark(A, i) && !mouthy(A, i) && !white(A, i) && !ownNear(A, i) && dif(A, F[rest], i) > 60) fo++; }
            const ea = m.edgeAt, be = k === 1 ? 0 : edgeRun(A); if (be < m.boxEdge || k === 1) m.edgeAt = ea; else m.edgeAt = [...(m.edgeAt || []), k];
      per[k] = [tt, sc, se, fo, be]; m.teethTan = Math.max(m.teethTan, tt); m.scraps = Math.max(m.scraps, sc); m.seam = Math.max(m.seam, se); m.foreign = Math.max(m.foreign, fo); m.boxEdge = Math.max(m.boxEdge, be); }
    // the mouth opens: the new mouth-inside in the small open and the wide AH, against the kit's own; and the face a made
    // video rests on, against the AH (a rest face this open is a mouth hanging open with no voice)
    for (const k of [2, 3, 5, rest]) { let a = 0, ka = 0; const ins = k === rest && k !== 3 ? red : inside; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * N + x) * 4; if (ins(F[k], i) && !ins(F[1], i)) a++; if (K && inside(K[k], i) && !inside(K[1], i)) ka++; } m.open.push([k, a, ka]); }
    m.restOpen = m.open[3][1]; m.open.length = 3;
    // a big mouth of its own (tongue, drool, open, a grin) with no twin to talk from: the kit engine keeps it in front of
    // every talking mouth (a tongue hanging over every word). A frown is filled from its own face; a mustache, straw or match
    // is kept on purpose
    m.noTwin = !!(K && NB.twin === false && !/^(Smile|Frown|Mustache|Straw|Match)$/.test(mouthT));

    // the rest face against the talking ones: what it shows that no talking frame has anywhere near (drool, a hanging tongue,
    // a gum bubble; a smile resting between words is a mouth like the talking ones, and isn't counted)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * N + x) * 4; if (rest === 1 || dif(F[rest], F[1], i) <= 90 || dark(F[rest], i)) continue;
      let seen = false; for (let k = 1; k < 10 && !seen; k++) { if (k === rest) continue; for (let dy = -4; dy <= 4 && !seen; dy += 2) for (let dx = -4; dx <= 4 && !seen; dx += 2) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const j = (yy * N + xx) * 4; if (Math.abs(F[k][j] - F[rest][i]) + Math.abs(F[k][j + 1] - F[rest][i + 1]) + Math.abs(F[k][j + 2] - F[rest][i + 2]) < 60) seen = true; } }
      if (!seen) m.restFlash++; }
    m.box = (mb[2] - mb[0]) * (mb[3] - mb[1]);
    let png = null;
    if (strip) { const Z = 180, pad = 60, bx = [Math.max(0, mb[0] - pad), Math.max(0, mb[1] - pad), Math.min(N, mb[2] + pad), Math.min(N, mb[3] + pad)], sc = Z / Math.max(bx[2] - bx[0], bx[3] - bx[1]);
      const c = document.createElement('canvas'); c.width = Z * 10; c.height = Z; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      const order = [rest, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].filter(k => k !== rest), ...(rest ? [0] : [])].slice(0, 10);
      for (let j = 0; j < order.length; j++) { const k = order[j], fc = cv(); fc.getContext('2d').putImageData(new ImageData(F[k], N, N), 0, 0);
        g.save(); g.translate(j * Z, 0); g.beginPath(); g.rect(0, 0, Z, Z); g.clip(); g.scale(sc, sc); g.translate(-bx[0], -bx[1]); g.drawImage(fc, 0, 0); g.restore();
        g.fillStyle = '#000'; g.font = '11px sans-serif'; g.fillText((j === 0 ? 'rest ' : '') + k + (per[k] ? ' ' + per[k].join('/') : ''), j * Z + 3, 11); }
      png = c.toDataURL(); }
    // (a close-up of the worst straight edge, marked, to look at: tools/test/nibcheck.mjs writes it as <id>.edge.png)
    if (m.boxEdge >= 18 && m.edgeAt && m.edgeAt[3]) { const [ex, ey, ed, ek] = m.edgeAt, c = document.createElement('canvas'); c.width = c.height = 240; const g = c.getContext('2d'), fc = cv();
      fc.getContext('2d').putImageData(new ImageData(F[ek], N, N), 0, 0); g.imageSmoothingEnabled = false; g.drawImage(fc, ex - 60, ey - 60, 120, 120, 0, 0, 240, 240);
      g.strokeStyle = '#0f0'; g.beginPath(); if (ed === 'h') { g.moveTo((60 - m.boxEdge) * 2, 126); g.lineTo(120, 126); } else { g.moveTo(126, (60 - m.boxEdge) * 2); g.lineTo(126, 120); } g.stroke(); m.edgePng = c.toDataURL(); }
    if (window.__dbgFrame) { const c = cv(); c.getContext('2d').putImageData(new ImageData(F[window.__dbgFrame], N, N), 0, 0); m.dbgPng = c.toDataURL(); }
    return { m, per, kit, rest, png };
  }, { id, strip:true, mouthT:kindOf(id)[1] }).catch(e => ({ err:'page: ' + String(e).slice(0, 160) }));
  const [kind, mouth] = kindOf(id);
  const rec = { id, kind, mouth, ms:Date.now() - t0 };
  if (r.err) { rec.fail = [r.err]; if (/page:|Target|crash/.test(r.err)) await open(); }
  else { const m = r.m, f = [];
    // (teethTan is measured but doesn't fail a Nibble: it missed the brown bear fangs, which were in the kit itself, and flags the
    //  gecko grin's tinted ends; the kit's teeth are checked by tools/test/teeth_check.py, which caught the fangs)
    if (m.scraps > 250) f.push('scraps ' + m.scraps); if (m.seam > 60) f.push('seam ' + m.seam);
    if (m.restFlash > 2500) f.push('restFlash ' + m.restFlash); if (m.foreign > 400) f.push('foreign ' + m.foreign);
    if (m.boxEdge >= 18) f.push('boxEdge ' + m.boxEdge); if (m.noTwin) f.push('noTwin');
    const ah = m.open.find(o => o[0] === 3); if (m.restOpen > 0.35 * ah[1]) f.push('restOpen ' + m.restOpen + '/' + ah[1]); if (r.kit ? ah[1] < 0.5 * ah[2] : ah[1] < 3000) f.push('noOpen ' + ah[1] + (r.kit ? '/' + ah[2] : ''));
    Object.assign(rec, { kit:r.kit, rest:r.rest, m, per:r.per, fail:f }); }
  fs.appendFileSync(rf, JSON.stringify(rec) + '\n');
  if (rec.m && rec.m.edgePng) { if (rec.fail.length) fs.writeFileSync(`${out}/strips/${id}.edge.png`, Buffer.from(rec.m.edgePng.split(',')[1], 'base64')); delete rec.m.edgePng; }
  if (rec.m && rec.m.dbgPng) { fs.writeFileSync(`${out}/${id}.f${process.env.DBGF}.png`, Buffer.from(rec.m.dbgPng.split(',')[1], 'base64')); delete rec.m.dbgPng; }
  if (r.png && (rec.fail.length || process.env.STRIPS === 'all')) fs.writeFileSync(`${out}/strips/${id}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
  if (++n % 25 === 0) { console.log(n, 'done'); await open(); if (process.env.FLAGS) await pg.evaluate(f => { for (const k of f.split(',')) window[k] = true; }, process.env.FLAGS); }   // (a fresh page now and then: the made Nibbles' memory back)
}
await b.close();
// summary
const all = fs.readFileSync(rf, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)), bad = all.filter(x => x.fail.length);
const by = {}; for (const x of bad) for (const f of x.fail) { const k = f.split(' ')[0]; (by[k] = by[k] || []).push(x.id); }
console.log(`${all.length} Nibbles checked, ${all.length - bad.length} pass, ${bad.length} fail`); for (const k in by) console.log(' ', k, by[k].length, by[k].slice(0, 12).join(','));
