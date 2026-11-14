// Leak audit: runs the kit engine on every Nibble that has a kit and flags any talking frame or blink that shows
// colours from somewhere else: a colour this Nibble's own picture doesn't have and that isn't a mouth colour
// (dark inside, red, pink tongue, white teeth). That is what another Nibble's body, clothes or skin looks like.
//   node tools/audit.mjs <shard> <shards> <out dir> [local pictures dir]
// Writes <out>/report-<shard>.json and, for flagged Nibbles, <out>/flags/<id>.webp (the frames, leaks marked).
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const [SHARD = '0', SHARDS = '1', OUT = 'audit', PICS = ''] = process.argv.slice(2);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
fs.mkdirSync(path.join(OUT, 'flags'), { recursive:true });

// the app's rules for which kit a Nibble uses and whether it blinks (kept in step with index.html)
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const grab = name => { const m = html.match(new RegExp(`const ${name} = ([^;]+);`)); if (!m) throw new Error('missing ' + name); return Function(`return (${m[1]})`)(); };
const KIT_REF = grab('KIT_REF'), SPECIAL_SKINS = grab('SPECIAL_SKINS'), KIT_GROUP = grab('KIT_GROUP'), NO_BLINK = grab('NO_BLINK'), KIT_SKIP = grab('KIT_SKIP');
const groupOf = a => a && KIT_GROUP[a.Character + ':' + a.Skin];
const kitFor = a => groupOf(a) ? groupOf(a).ref : (!SPECIAL_SKINS.has(a.Skin) && !KIT_SKIP.has(a.Character + ':' + a.Skin) ? KIT_REF[a.Character] || null : null);
const blinks = a => !NO_BLINK.test(String(a.Eyes || '')) && !/glasses|goggles|visor|opera mask/i.test(String(a.Accessory || '')) && !(groupOf(a) && groupOf(a).noBlink && groupOf(a).noBlink.test(String(a.Eyes || '')));

const traits = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/traits.json'), 'utf8'));
const jobs = Object.entries(traits).map(([id, t]) => ({ id:+id, a:t.a, ref:kitFor(t.a) })).filter(j => j.ref)
  .filter(j => !process.env.IDS || process.env.IDS.split(',').includes(String(j.id)))
  .filter((j, n) => n % +SHARDS === +SHARD);

// a tiny static server for the repo (the engine and the kits), plus local pictures when given
const types = { '.js':'text/javascript', '.webp':'image/webp', '.png':'image/png', '.json':'application/json', '.html':'text/html' };
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  const f = u.startsWith('/pic/') ? path.join(PICS, u.slice(5)) : path.join(ROOT, u);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type':types[path.extname(f)] || 'application/octet-stream', 'Access-Control-Allow-Origin':'*' }); r.end(d); });
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.log('pageerror', String(e)));
await page.goto(base + '/kit.js');
await page.evaluate(() => { window.__refs = {}; });

const report = [];
let n = 0; const t0 = Date.now();
for (const j of jobs) {
  const pic = PICS ? `${base}/pic/${j.id}.png` : `https://d24r2edyfve7yo.cloudfront.net/nibbles/images/${j.id}.png`;
  let r;
  for (let tries = 0; tries < 3; tries++) {
    try {
      r = await page.evaluate(async ({ pic, ref, blink }) => {
        const B = await import('/builder.js'), K = await import('/kit.js');
        const li = async s => { const im = new Image(); im.crossOrigin = 'anonymous'; im.src = s; await im.decode(); return im; };
        if (!window.__refs[ref]) window.__refs[ref] = { base:await li(`/faces/${ref}/base.webp`), mouths:await Promise.all([0,1,2,3,4,5,6,7,8,9].map(k => li(`/faces/${ref}/m${k}.webp`))), eyes:await Promise.all([0,1,2,3,4].map(k => li(`/faces/${ref}/e${k}.webp`).catch(() => null))) };
        const R = window.__refs[ref], cut = B.cutOriginal(await li(pic));
        const N0 = 1000, dat0 = c => { const x = document.createElement('canvas'); x.width = x.height = N0; const g = x.getContext('2d', { willReadFrequently:true }); g.drawImage(c, 0, 0, N0, N0); return g.getImageData(0, 0, N0, N0).data; };
        const b0 = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        if (!R.newCols) {   // colours the kit's mouths draw that its own body doesn't have anywhere (tongues, mouth shading)
          const Bd = dat0(R.base), inBase = new Uint8Array(32768), drawn = new Uint32Array(32768);
          for (let p = 0; p < N0 * N0; p++) { const i = p * 4; if (Bd[i + 3] > 200) { const k = b0(Bd[i], Bd[i + 1], Bd[i + 2]); const a = k >> 10, b = (k >> 5) & 31, c = k & 31;
            for (let x = Math.max(0, a - 1); x <= Math.min(31, a + 1); x++) for (let y = Math.max(0, b - 1); y <= Math.min(31, b + 1); y++) for (let z = Math.max(0, c - 1); z <= Math.min(31, c + 1); z++) inBase[(x << 10) | (y << 5) | z] = 1; } }
          for (const m of R.mouths.slice(1)) { const D = dat0(m); for (let p = 0; p < N0 * N0; p++) { const i = p * 4; if (D[i + 3] > 200 && Math.abs(D[i] - Bd[i]) + Math.abs(D[i + 1] - Bd[i + 1]) + Math.abs(D[i + 2] - Bd[i + 2]) > 60) drawn[b0(D[i], D[i + 1], D[i + 2])]++; } }
          R.newCols = new Uint8Array(32768); for (let k = 0; k < 32768; k++) if (drawn[k] >= 20 && !inBase[k]) { const a = k >> 10, b = (k >> 5) & 31, c = k & 31;
            for (let x = Math.max(0, a - 1); x <= Math.min(31, a + 1); x++) for (let y = Math.max(0, b - 1); y <= Math.min(31, b + 1); y++) for (let z = Math.max(0, c - 1); z <= Math.min(31, c + 1); z++) R.newCols[(x << 10) | (y << 5) | z] = 1; } }
        const res = K.fromKit(cut.canvas, { base:R.base, mouths:R.mouths, eyes:R.eyes }, { blink });
        const N = 1000, dat = c => { const x = document.createElement('canvas'); x.width = x.height = N; const g = x.getContext('2d', { willReadFrequently:true }); g.drawImage(c, 0, 0, N, N); return g.getImageData(0, 0, N, N).data; };
        const T = dat(cut.canvas), bin = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        // this Nibble's own colours (any shade near one it has)
        const cnt = new Uint32Array(32768); for (let p = 0; p < N * N; p++) { const i = p * 4; if (T[i + 3] > 200) cnt[bin(T[i], T[i + 1], T[i + 2])]++; }
        const own = new Uint8Array(32768);
        for (let k = 0; k < 32768; k++) { if (cnt[k] < 6) continue; const a = k >> 10, b = (k >> 5) & 31, c = k & 31;
          for (let x = Math.max(0, a - 2); x <= Math.min(31, a + 2); x++) for (let y = Math.max(0, b - 2); y <= Math.min(31, b + 2); y++) for (let z = Math.max(0, c - 2); z <= Math.min(31, c + 2); z++) own[(x << 10) | (y << 5) | z] = 1; }
        // what a mouth may be drawn in: dark, deep red / maroon, pink, white or grey teeth
        const mouthy = (r, g, b) => r + g + b < 170 || (Math.max(r, g, b) - Math.min(r, g, b) < 28 && r + g + b > 420) || (r > 60 && g < r * 0.5 && b < r * 0.8) || (r > 170 && b >= g * 0.9 && g < r * 0.8);
        const frames = [...res.frames.slice(1).map((f, k) => ({ k:k + 1, c:f, over:false })), ...[3, 4].filter(k => res.eyes[k]).map(k => ({ k:'e' + k, c:res.eyes[k], over:true }))];
        let worst = 0, worstK = null, worstMarks = [], mark0 = 0; const marks = [];
        for (const f of frames) {
          const D = dat(f.c), m = new Uint8Array(N * N); let any = 0;
          for (let p = 0; p < N * N; p++) { const i = p * 4; if (D[i + 3] < 200) continue;
            if (!f.over && Math.abs(D[i] - T[i]) + Math.abs(D[i + 1] - T[i + 1]) + Math.abs(D[i + 2] - T[i + 2]) < 50) continue;
            if (own[bin(D[i], D[i + 1], D[i + 2])] || R.newCols[bin(D[i], D[i + 1], D[i + 2])] || mouthy(D[i], D[i + 1], D[i + 2])) continue; m[p] = 1; any = 1; }
          if (!any) continue;
          // only solid patches count (anti-aliased edges and specks don't)
          const lab = new Int32Array(N * N), q = new Int32Array(N * N); let tot = 0;
          for (let s = 0; s < N * N; s++) { if (!m[s] || lab[s]) continue; let h = 0, t = 0; q[t++] = s; lab[s] = 1;
            while (h < t) { const p = q[h++], x = p % N; for (const r of [x > 0 ? p - 1 : -1, x < N - 1 ? p + 1 : -1, p - N, p + N]) if (r >= 0 && r < N * N && m[r] && !lab[r]) { lab[r] = 1; q[t++] = r; } }
            if (t >= 120) { tot += t; for (let u = 0; u < t; u++) marks.push(q[u]); } }
          if (tot > worst) { worst = tot; worstK = f; worstMarks = marks.slice(mark0); }
          mark0 = marks.length;
        }
        let strip = null;
        if (worst > 0) {   // the rest face and the frames, cropped to the face, leaks in magenta
          const box = res.mouthBox && res.mouthBox[2] > res.mouthBox[0] ? res.mouthBox : [300, 400, 700, 700];
          const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, S = 520, sx = Math.max(0, Math.min(N - S, cx - S / 2)), sy = Math.max(0, Math.min(N - S, cy - S / 2 - 60));
          const W = 160, list = [res.frames[0], ...res.frames.slice(1)], c = document.createElement('canvas'); c.width = W * (list.length + 2); c.height = W;
          const g = c.getContext('2d'); g.fillStyle = cut.bg; g.fillRect(0, 0, c.width, W);
          list.forEach((f, k) => g.drawImage(f, sx, sy, S, S, k * W, 0, W, W));
          if (res.eyes[4]) { g.drawImage(res.frames[0], sx, sy, S, S, list.length * W, 0, W, W); g.drawImage(res.eyes[4], sx, sy, S, S, list.length * W, 0, W, W); }
          // the worst frame with its leaks in magenta
          const L = document.createElement('canvas'); L.width = L.height = N; const lg = L.getContext('2d'); lg.fillStyle = cut.bg; lg.fillRect(0, 0, N, N);
          if (worstK.over) lg.drawImage(res.frames[0], 0, 0, N, N); lg.drawImage(worstK.c, 0, 0, N, N);
          const id = lg.getImageData(0, 0, N, N); for (const p of worstMarks) { id.data[p * 4] = 255; id.data[p * 4 + 1] = 0; id.data[p * 4 + 2] = 255; id.data[p * 4 + 3] = 255; } lg.putImageData(id, 0, 0);
          g.drawImage(L, sx, sy, S, S, (list.length + 1) * W, 0, W, W);
          strip = c.toDataURL('image/webp', 0.8);
        }
        return { worst, worstK:worstK && worstK.k, strip };
      }, { pic, ref:j.ref, blink:blinks(j.a) });
      break;
    } catch (e) { r = { error:String(e).slice(0, 200) }; }
  }
  report.push({ id:j.id, kind:j.a.Character, skin:j.a.Skin, ref:j.ref, leak:r.worst ?? null, frame:r.worstK ?? null, error:r.error });
  if (r.strip) fs.writeFileSync(path.join(OUT, 'flags', `${j.id}.webp`), Buffer.from(r.strip.split(',')[1], 'base64'));
  if (++n % 50 === 0) { console.log(`${n}/${jobs.length}  ${((Date.now() - t0) / n / 1000).toFixed(2)} s each`); fs.writeFileSync(path.join(OUT, `report-${SHARD}.json`), JSON.stringify(report)); }
}
fs.writeFileSync(path.join(OUT, `report-${SHARD}.json`), JSON.stringify(report));
console.log('done', jobs.length, 'flagged', report.filter(x => x.leak).length, 'errors', report.filter(x => x.error).length);
await browser.close(); server.close();
