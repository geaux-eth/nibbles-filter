// The art sweep (problems.md M3, M4, M6): a sample of every Nibble kind and mouth trait made the way the app makes them,
// each talking frame compared with the face the video rests on. A talking mouth may change one place (the mouth); any
// other change (a scribble on the clothes, a tick at the chin, drool or gum showing in one frame and not the next) is a
// stray. Writes a score per Nibble and contact sheets, worst first, to look through.
// Usage: node tools/test/sweep.mjs <pick.json> <out dir>    (pick.json: [[kind, mouth, id], ...])
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const S = '/tmp/claude-0/-home-claude/983647b0-485b-5cec-a0d0-3276a7c1b795/scratchpad';
const { serve } = await import(S + '/serve2.mjs');
const pick = JSON.parse(fs.readFileSync(process.argv[2])), out = process.argv[3]; fs.mkdirSync(out, { recursive:true });
const b = await chromium.launch(), pg = await b.newPage();
await serve(pg); await pg.route(/supabase|jsdelivr|googleapis/, r => r.fulfill({ json:[] }));
await pg.route('https://d24r2edyfve7yo.cloudfront.net/**', r => { const m = r.request().url().match(/(\d+)\.png/), f = m && `${S}/research/full/${m[1]}.png`; if (f && fs.existsSync(f)) r.fulfill({ path:f, contentType:'image/png', headers:{ 'access-control-allow-origin':'*' } }); else r.abort(); });
await pg.goto('http://127.0.0.1:8765/' + (process.env.PAGE || 'beta/index.html')); await pg.waitForFunction(() => window.__nf && window.__nf.ready, null, { timeout:120000 });
const res = [];
for (const [kind, mouth, id] of pick) {
  const r = await pg.evaluate(async id => {
    if (!(await window.__nf.prepare(id))) return null;
    const NB = window.__nf.NIBBLES[id], L = NB.layout, mb = L.mb, N = 1000, rest = NB.twinRest || 0;
    const load = async n => { const im = new Image(); im.src = window.__nf.artOf(id, n); await im.decode(); return im; }, base = await load('base');
    const full = async k => { const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d', { willReadFrequently:true }); g.fillStyle = '#fff'; g.fillRect(0, 0, N, N); g.drawImage(base, 0, 0, N, N);
      let m = null; try { m = await load('m' + k); } catch (e) {} if (m) { g.clearRect(mb[0], mb[1], m.width, m.height); g.fillStyle = '#fff'; g.fillRect(mb[0], mb[1], m.width, m.height); g.drawImage(m, mb[0], mb[1]); } return c; };
    const F = []; for (let k = 0; k < 10; k++) F.push(await full(k));
    const px = c => c.getContext('2d').getImageData(0, 0, N, N).data, R = px(F[rest]);
    // strays: what a frame changes away from its one main change (the mouth), in pieces of 12+ px more than 8 px from it
    const strays = [];
    for (let k = 1; k < 10; k++) { if (k === rest) { strays.push(0); continue; } const D = px(F[k]), m = new Uint8Array(N * N);
      for (let p = 0; p < N * N; p++) { const i = p * 4; if (Math.abs(D[i] - R[i]) + Math.abs(D[i + 1] - R[i + 1]) + Math.abs(D[i + 2] - R[i + 2]) > 90) m[p] = 1; }
      const lab = new Int32Array(N * N), q = new Int32Array(N * N), sz = [0]; let n = 0;
      for (let s0 = 0; s0 < N * N; s0++) { if (!m[s0] || lab[s0]) continue; n++; let h = 0, t = 0; q[t++] = s0; lab[s0] = n;
        while (h < t) { const p = q[h++], x = p % N; for (const j of [x > 0 ? p - 1 : -1, x < N - 1 ? p + 1 : -1, p - N, p + N, p - N - 1, p - N + 1, p + N - 1, p + N + 1]) if (j >= 0 && j < N * N && m[j] && !lab[j]) { lab[j] = n; q[t++] = j; } } sz.push(t); }
      if (!n) { strays.push(0); continue; }
      let main = 1; for (let j = 2; j <= n; j++) if (sz[j] > sz[main]) main = j;
      // distance from the main change (a grown copy of it)
      let g = new Uint8Array(N * N); for (let p = 0; p < N * N; p++) if (lab[p] === main) g[p] = 1;
      for (let it = 0; it < 8; it++) { const g2 = g.slice(); for (let p = N; p < N * N - N; p++) if (!g[p] && (g[p - 1] || g[p + 1] || g[p - N] || g[p + N])) g2[p] = 1; g = g2; }
      let s = 0; const far = new Map(); for (let p = 0; p < N * N; p++) { const l = lab[p]; if (l && l !== main && !g[p]) far.set(l, (far.get(l) || 0) + 1); }
      for (const [l, c] of far) if (sz[l] >= 12) s += c; strays.push(s); }
    // a strip zoomed on the mouth: the face the video rests on, then the nine talking mouths
    const Z = 200, pad = 70, bx = [Math.max(0, mb[0] - pad), Math.max(0, mb[1] - pad - 60), Math.min(N, mb[2] + pad), Math.min(N, mb[3] + pad)], sc = Z / Math.max(bx[2] - bx[0], bx[3] - bx[1]);
    const c = document.createElement('canvas'); c.width = Z * 10; c.height = Z; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    const order = [rest, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k, j) => j === 0 ? rest : k);
    [rest, ...[1, 2, 3, 4, 5, 6, 7, 8, 9]].forEach((k, j) => { g.save(); g.translate(j * Z, 0); g.beginPath(); g.rect(0, 0, Z, Z); g.clip(); g.scale(sc, sc); g.translate(-bx[0], -bx[1]); g.drawImage(F[k], 0, 0); g.restore();
      g.fillStyle = '#000'; g.font = '12px sans-serif'; g.fillText(j === 0 ? 'rest ' + k : k + (strays[k - 1] ? ' !' + strays[k - 1] : ''), j * Z + 3, 12); });
    return { strays, rest, donor:!!NB.twinRest, png:c.toDataURL() };
  }, id).catch(e => ({ err:String(e).slice(0, 200) }));
  if (!r || r.err) { res.push({ kind, mouth, id, err:r ? r.err : 'not ready' }); continue; }
  const score = r.strays.reduce((a, v) => a + v, 0);
  fs.writeFileSync(`${out}/${id}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
  res.push({ kind, mouth, id, score, strays:r.strays, rest:r.rest });
  console.log(kind, mouth, id, 'rest', r.rest, 'strays', score, r.strays.join(' '));
}
fs.writeFileSync(`${out}/scores.json`, JSON.stringify(res));
await b.close();
