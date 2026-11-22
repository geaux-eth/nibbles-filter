// the kit engine before and after, on several Nibbles: how many pixels of each talking frame changed, and a picture of
// the frames that changed most (old above, new below)
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = '/home/claude/nibbles-filter', PICS = '/tmp/claude-0/-home-claude/983647b0-485b-5cec-a0d0-3276a7c1b795/scratchpad/research/full';
const list = process.argv[2].split(',').map(x => x.split(':')), out = process.argv[3];
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = u.startsWith('/pic/') ? path.join(PICS, u.slice(5)) : /^\/(kit|kit_old|builder)\.js$/.test(u) ? path.join(ROOT, 'beta', u) : path.join(ROOT, u);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type':f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png' : 'image/webp' }); r.end(d); }); }).listen(0);
const base = `http://127.0.0.1:${srv.address().port}`, b = await chromium.launch(), pg = await b.newPage(); await pg.goto(base + '/kit.js');
const res = await pg.evaluate(async list => { const B = await import('/builder.js'), K1 = await import('/kit_old.js'), K2 = await import('/kit.js');
  const li = async s => { const im = new Image(); im.src = s; await im.decode(); return im; }, N = 1000, rows = [], stats = [];
  for (const [id, ref] of list) {
    const R = { base:await li(`/faces/${ref}/base.webp`), mouths:await Promise.all([0,1,2,3,4,5,6,7,8,9].map(j => li(`/faces/${ref}/m${j}.webp`))), eyes:await Promise.all([0,1,2,3,4].map(j => li(`/faces/${ref}/e${j}.webp`).catch(() => null))) };
    const cut = B.cutOriginal(await li(`/pic/${id}.png`)), a = K1.fromKit(cut.canvas, R, {}), c = K2.fromKit(B.cutOriginal(await li(`/pic/${id}.png`)).canvas, R, {});
    const px = f => f.getContext('2d').getImageData(0, 0, N, N).data; let worst = 1, wn = -1; const per = [];
    for (let k = 1; k < 10; k++) { const A = px(a.frames[k]), C = px(c.frames[k]); let n = 0; for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - C[i]) + Math.abs(A[i + 1] - C[i + 1]) + Math.abs(A[i + 2] - C[i + 2]) + Math.abs(A[i + 3] - C[i + 3]) > 40) n++; per.push(n); if (n > wn) { wn = n; worst = k; } }
    stats.push([id, ref, per]);
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 300; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1200, 300);
    const L = a.layout || null; const box = [250, 400, 500];   // x, y, size
    g.drawImage(a.frames[worst], box[0], box[1], box[2], box[2], 0, 0, 300, 300); g.drawImage(c.frames[worst], box[0], box[1], box[2], box[2], 300, 0, 300, 300);
    const k2 = worst === 3 ? 8 : 3; g.drawImage(a.frames[k2], box[0], box[1], box[2], box[2], 600, 0, 300, 300); g.drawImage(c.frames[k2], box[0], box[1], box[2], box[2], 900, 0, 300, 300);
    g.fillStyle = '#000'; g.font = '16px sans-serif'; g.fillText(`${id} m${worst} old`, 4, 16); g.fillText('new', 304, 16); g.fillText(`m${k2} old`, 604, 16); g.fillText('new', 904, 16);
    rows.push(cv.toDataURL()); }
  return { rows, stats }; }, list);
for (const s of res.stats) console.log(s[0], s[1], 'changed px per frame', s[2].join(' '));
const { execSync } = await import('child_process');
res.rows.forEach((u, i) => fs.writeFileSync(`${out}_${i}.png`, Buffer.from(u.split(',')[1], 'base64')));
await b.close(); srv.close();
