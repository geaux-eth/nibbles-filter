// a kit Nibble made in the page, all ten mouths in a row (zoomed on the mouth), on white
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { serve } from '../serve2.mjs'; import fs from 'fs';
const S = '/tmp/claude-0/-home-claude/983647b0-485b-5cec-a0d0-3276a7c1b795/scratchpad', ids = process.argv[2].split(',').map(Number);
const b = await chromium.launch(), pg = await b.newPage();
await serve(pg); await pg.route(/supabase|jsdelivr|googleapis/, r => r.fulfill({ json:[] }));
await pg.route('https://d24r2edyfve7yo.cloudfront.net/**', r => { const m = r.request().url().match(/(\d+)\.png/), f = m && `${S}/research/full/${m[1]}.png`; if (f && fs.existsSync(f)) r.fulfill({ path:f, contentType:'image/png', headers:{ 'access-control-allow-origin':'*' } }); else r.abort(); });
await pg.goto('http://127.0.0.1:8765/' + (process.env.PAGE || 'beta/index.html')); await pg.waitForFunction(() => window.__nf && window.__nf.ready, null, { timeout:120000 });
for (const id of ids) {
  const u = await pg.evaluate(async id => { if (!(await window.__nf.prepare(id))) return null; const L = window.__nf.layout(id); const mb = L.mb, Z = 230, pad = 60;
    const bx = [Math.max(0, mb[0] - pad), Math.max(0, mb[1] - pad - 80), Math.min(1000, mb[2] + pad), Math.min(1000, mb[3] + pad)], bw = bx[2] - bx[0], bh = bx[3] - bx[1], sc = Z / Math.max(bw, bh);
    const c = document.createElement('canvas'); c.width = Z * 10; c.height = Z; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    const load = async n => { const im = new Image(); im.src = window.__nf.artOf(id, n); await im.decode(); return im; }, base = await load('base');
    for (let k = 0; k < 10; k++) { let m = null; try { m = await load('m' + k); } catch (e) {}
      g.save(); g.translate(k * Z, 0); g.beginPath(); g.rect(0, 0, Z, Z); g.clip(); g.scale(sc, sc); g.translate(-bx[0], -bx[1]); g.drawImage(base, 0, 0, 1000, 1000); if (m) g.drawImage(m, mb[0], mb[1]); g.restore();
      g.fillStyle = '#000'; g.font = '14px sans-serif'; g.fillText(String(k), k * Z + 4, 16); }
    return c.toDataURL(); }, id);
  if (u) fs.writeFileSync(`${process.env.OUT || S + '/strip'}_${id}.png`, Buffer.from(u.split(',')[1], 'base64')); else console.log('not ready', id);
}
await b.close();
