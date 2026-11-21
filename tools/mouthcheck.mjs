// Drawing check for the kit engine's talking mouths (what GEAUX sees as "drawing problems"), on every Nibble on hand:
//   stray  - ink (outlines, or faint grey lines) in a talking frame that neither the kit's mouth (where the mouth moves)
//            nor this Nibble's own picture (everywhere else) has: ghosts of the old mouth, sketchy scraps, doubled lines
//   gap    - outlines the kit's mouth draws (where the mouth moves), or this Nibble's own (next to it), missing from the
//            frame: broken beaks, a sunglasses rim cut where the jaw opens
//   smudge - this Nibble's own picture changed away from where the mouth moves: lighter or darker patches on the muzzle
// Each counted in solid pieces only (anti-aliasing and single pixels don't count). The rest face (frame 0) is this
// Nibble's own picture and isn't checked.
//   node tools/mouthcheck.mjs <pictures dir> <out dir> [kinds, e.g. Cock,Wolf]   (IDS=1,2 for some; CODE=beta for beta/)
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const [PICS, OUT = 'mouthcheck', KINDS = ''] = process.argv.slice(2);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
fs.mkdirSync(path.join(OUT, 'strips'), { recursive:true });
const html = fs.readFileSync(path.join(ROOT, process.env.CODE ? process.env.CODE + '/index.html' : 'index.html'), 'utf8');
const grab = name => { const m = html.match(new RegExp(`const ${name} = ([^;]+);`)); if (!m) throw new Error('missing ' + name); return Function(`return (${m[1]})`)(); };
const KIT_REF = grab('KIT_REF'), SPECIAL_SKINS = grab('SPECIAL_SKINS'), KIT_GROUP = grab('KIT_GROUP'), KIT_SKIP = grab('KIT_SKIP'), KIT_GAPS = grab('KIT_GAPS'), NO_BLINK = grab('NO_BLINK');
const FRONT_MOUTH = /mustache|straw|match|bubbles/i;
const groupOf = a => a && KIT_GROUP[a.Character + ':' + a.Skin];
const kitFor = a => { if (groupOf(a)) return groupOf(a).ref; if (a.Character === 'Beaver' && a.Mouth === 'Broken Tooth') return 'k929b';
  return !SPECIAL_SKINS.has(a.Skin) && !KIT_SKIP.has(a.Character + ':' + a.Skin) ? KIT_REF[a.Character] || null : null; };
const traits = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/traits.json'), 'utf8'));
const PLAIN = ['Smile', 'Frown'];
const donorOf = (id, a) => { if (process.env.NODONOR || (PLAIN.includes(a.Mouth) && (a.Mouth !== 'Frown' || process.env.NOFROWN))) return null; const want = a.Mouth === 'Frown' ? ['Smile'] : PLAIN; let best = 0, bs = -1;
  for (const [k, t] of Object.entries(traits)) { const b = t.a; if (+k === id || b.Character !== a.Character || b.Skin !== a.Skin || b.Outfit !== a.Outfit || !want.includes(b.Mouth)) continue;
    if (!fs.existsSync(path.join(PICS, `${t.img || k}.png`))) continue;
    const sc = (b.Mouth === 'Smile' ? 2 : 1) + (b.Accessory === a.Accessory ? 4 : 0) + (b.Eyes === a.Eyes ? 1 : 0); if (sc > bs) { bs = sc; best = t.img || +k; } }
  return best || null; };
const kinds = KINDS ? KINDS.split(',') : null;
const jobs = Object.entries(traits).map(([id, t]) => ({ id:+id, a:t.a, ref:kitFor(t.a), img:t.img || +id }))   // (pictures are named by image number, not token)
  .filter(j => j.ref && fs.existsSync(path.join(PICS, `${j.img}.png`)) && (!kinds || kinds.includes(j.a.Character)))
  .filter(j => !process.env.IDS || process.env.IDS.split(',').includes(String(j.id)))
  .slice(0, +process.env.MAX || 1e9);

const types = { '.js':'text/javascript', '.webp':'image/webp', '.png':'image/png', '.json':'application/json', '.html':'text/html' };
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  const f = u.startsWith('/pic/') ? path.join(PICS, u.slice(5)) : process.env.CODE && /^\/(kit|builder)\.js$/.test(u) ? path.join(ROOT, process.env.CODE, u) : path.join(ROOT, u);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type':types[path.extname(f)] || 'application/octet-stream', 'Access-Control-Allow-Origin':'*' }); r.end(d); });
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(), page = await browser.newPage();
page.on('pageerror', e => console.log('pageerror', String(e)));
await page.goto(base + '/kit.js'); await page.evaluate(() => { window.__refs = {}; });

const report = [];
for (const j of jobs) {
  const d = donorOf(j.id, j.a);
  const r = await page.evaluate(async ({ pic, ref, gaps, blink, front, dpic, strips }) => {
    const B = await import('/builder.js'), K = await import('/kit.js');
    const li = async s => { const im = new Image(); im.src = s; await im.decode(); return im; };
    if (!window.__refs[ref]) window.__refs[ref] = { base:await li(`/faces/${ref}/base.webp`), mouths:await Promise.all([0,1,2,3,4,5,6,7,8,9].map(k => li(`/faces/${ref}/m${k}.webp`))),
      eyes:await Promise.all([0,1,2,3,4].map(k => li(`/faces/${ref}/e${k}.webp`).catch(() => null))) };
    const R0 = window.__refs[ref], cut = B.cutOriginal(await li(pic), gaps || []);
    const donor = dpic ? B.cutOriginal(await li(dpic), gaps || []).canvas : null;
    const res = K.fromKit(cut.canvas, { base:R0.base, mouths:R0.mouths, eyes:R0.eyes }, { blink, front, donor });
    const N = 1000, dat = c => { const x = document.createElement('canvas'); x.width = x.height = N; const g = x.getContext('2d', { willReadFrequently:true }); g.drawImage(c, 0, 0, N, N); return g.getImageData(0, 0, N, N).data; };
    const T = dat(cut.canvas), R = dat(R0.base);
    const grow = (m, r) => { let a = m; for (let k = 0; k < r; k++) { const b = a.slice(); for (let p = 0; p < N * N; p++) if (a[p]) { const x = p % N; if (x > 0) b[p - 1] = 1; if (x < N - 1) b[p + 1] = 1; if (p >= N) b[p - N] = 1; if (p < N * N - N) b[p + N] = 1; } a = b; } return a; };
    const sum = (S, i) => S[i] + S[i + 1] + S[i + 2], chroma = (S, i) => Math.max(S[i], S[i + 1], S[i + 2]) - Math.min(S[i], S[i + 1], S[i + 2]);
    const ink = (S, i) => S[i + 3] > 150 && sum(S, i) < 200;                                      // an outline
    const faint = (S, i) => S[i + 3] > 60 && ((sum(S, i) < 420 && chroma(S, i) < 45) || (S[i + 3] < 200 && sum(S, i) < 300));   // a grey or see-through line
    const pieces = (m, min) => { const lab = new Uint8Array(N * N), q = new Int32Array(N * N), keep = new Uint8Array(N * N); let n = 0, px = 0;
      for (let s = 0; s < N * N; s++) { if (!m[s] || lab[s]) continue; let h = 0, t = 0; q[t++] = s; lab[s] = 1;
        while (h < t) { const p = q[h++], x = p % N; for (const o of [x > 0 ? p - 1 : -1, x < N - 1 ? p + 1 : -1, p - N, p + N]) if (o >= 0 && o < N * N && m[o] && !lab[o]) { lab[o] = 1; q[t++] = o; } }
        if (t >= min) { n++; px += t; for (let u = 0; u < t; u++) keep[q[u]] = 1; } }
      return { n, px, keep }; };
    const inkT = new Uint8Array(N * N); for (let p = 0; p < N * N; p++) if (ink(T, p * 4) || faint(T, p * 4)) inkT[p] = 1;
    const inkTg = grow(inkT, 2);
    const out = [], marks = [];
    for (let k = 1; k < 10; k++) {
      const D = dat(R0.mouths[k]), F = dat(res.frames[k]);
      // where this mouth moves: the kit's frame differs from the kit's own picture there
      const mv0 = new Uint8Array(N * N); for (let p = 0; p < N * N; p++) { const i = p * 4; if (Math.abs(D[i + 3] - R[i + 3]) > 60 || Math.abs(D[i] - R[i]) + Math.abs(D[i + 1] - R[i + 1]) + Math.abs(D[i + 2] - R[i + 2]) > 60) mv0[p] = 1; }
      const mv = grow(pieces(mv0, 40).keep, 4), mvNear = grow(mv, 10);
      const inkD = new Uint8Array(N * N); for (let p = 0; p < N * N; p++) if (ink(D, p * 4) || faint(D, p * 4)) inkD[p] = 1;
      const inkDg = grow(inkD, 2), inkF = new Uint8Array(N * N); for (let p = 0; p < N * N; p++) if (ink(F, p * 4) || faint(F, p * 4)) inkF[p] = 1;
      const inkFg = grow(inkF, 1);
      const stray = new Uint8Array(N * N), gap = new Uint8Array(N * N), smudge = new Uint8Array(N * N);
      for (let p = 0; p < N * N; p++) { const i = p * 4;
        if (inkF[p] && (mv[p] ? !inkDg[p] && !(inkTg[p] && !mv0[p]) : !inkTg[p] && !inkDg[p])) stray[p] = 1;   // (in the moving part only the kit's lines belong; this Nibble's own line there is a ghost)
        if (mv[p] && mv0[p] && ink(D, i) && !inkFg[p] && R[i + 3] > 150) gap[p] = 1;
        if (!mv[p] && mvNear[p] && ink(T, i) && !inkFg[p]) gap[p] = 1;
        if (!mvNear[p] && T[i + 3] > 200 && F[i + 3] > 30 && Math.abs(F[i] - T[i]) + Math.abs(F[i + 1] - T[i + 1]) + Math.abs(F[i + 2] - T[i + 2]) + Math.abs(F[i + 3] - T[i + 3]) > 45) smudge[p] = 1; }
      const s = pieces(stray, 15), g = pieces(gap, 15), m = pieces(smudge, 60);
      out.push({ k, stray:s.px, gap:g.px, smudge:m.px });
      marks.push({ s:s.keep, g:g.keep, m:m.keep });
    }
    let strip = null;
    if (strips) {   // each frame, then the same with the faults marked: stray magenta, gap cyan, smudge orange
      const box = res.mouthBox && res.mouthBox[2] > res.mouthBox[0] ? res.mouthBox : [300, 400, 700, 700];
      const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, S = 460, sx = Math.max(0, Math.min(N - S, cx - S / 2)), sy = Math.max(0, Math.min(N - S, cy - S / 2 - 40));
      const W = 200, c = document.createElement('canvas'); c.width = W * 10; c.height = W * 2; const gg = c.getContext('2d'); gg.fillStyle = '#fff'; gg.fillRect(0, 0, c.width, c.height);
      for (let k = 0; k < 10; k++) { gg.drawImage(res.frames[k], sx, sy, S, S, k * W, 0, W, W);
        if (k) { const L = document.createElement('canvas'); L.width = L.height = N; const lg = L.getContext('2d'); lg.fillStyle = '#fff'; lg.fillRect(0, 0, N, N); lg.drawImage(res.frames[k], 0, 0); const id = lg.getImageData(0, 0, N, N), mk = marks[k - 1];
          for (let p = 0; p < N * N; p++) { const col = mk.s[p] ? [255, 0, 255] : mk.g[p] ? [0, 200, 255] : mk.m[p] ? [255, 140, 0] : null; if (col) { id.data[p * 4] = col[0]; id.data[p * 4 + 1] = col[1]; id.data[p * 4 + 2] = col[2]; id.data[p * 4 + 3] = 255; } }
          lg.putImageData(id, 0, 0); gg.drawImage(L, sx, sy, S, S, k * W, W, W, W); } }
      strip = c.toDataURL('image/webp', 0.85); }
    return { out, strip };
  }, { pic:`${base}/pic/${j.img}.png`, ref:j.ref, gaps:KIT_GAPS[j.a.Character], blink:!NO_BLINK.test(String(j.a.Eyes || '')), front:/match/i.test(j.a.Mouth) ? 'match' : FRONT_MOUTH.test(j.a.Mouth) || /mustache/i.test(j.a.Accessory || '') ? (/straw/i.test(j.a.Mouth) ? 'stick' : /mustache/i.test(j.a.Mouth + j.a.Accessory) ? 'mustache' : true) : false,
       dpic:d ? `${base}/pic/${d}.png` : null, strips:!!process.env.STRIPS }).catch(e => ({ error:String(e).slice(0, 200) }));
  const tot = r.out ? r.out.reduce((a, f) => ({ stray:a.stray + f.stray, gap:a.gap + f.gap, smudge:a.smudge + f.smudge }), { stray:0, gap:0, smudge:0 }) : null;
  report.push({ id:j.id, kind:j.a.Character, mouth:j.a.Mouth, eyes:j.a.Eyes, acc:j.a.Accessory, skin:j.a.Skin, ref:j.ref, donor:d, ...tot, frames:r.out, error:r.error });
  if (r.strip) fs.writeFileSync(path.join(OUT, 'strips', `${j.id}.webp`), Buffer.from(r.strip.split(',')[1], 'base64'));
  if (report.length % 10 === 0) { console.log(report.length + '/' + jobs.length); fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report)); }
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report));
const by = {}; for (const r of report) { if (r.error) continue; const b = by[r.kind] = by[r.kind] || { n:0, stray:0, gap:0, smudge:0 }; b.n++; b.stray += r.stray; b.gap += r.gap; b.smudge += r.smudge; }
for (const [k, b] of Object.entries(by)) console.log(k, 'n', b.n, 'stray/Nibble', Math.round(b.stray / b.n), 'gap/Nibble', Math.round(b.gap / b.n), 'smudge/Nibble', Math.round(b.smudge / b.n));
console.log('errors', report.filter(r => r.error).length);
await browser.close(); server.close();
