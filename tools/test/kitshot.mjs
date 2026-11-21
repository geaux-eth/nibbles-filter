// kit Nibbles made in the page (kitPrepare), each drawn on green with a talking mouth: to see what the cut-out leaves
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { serve } from '../serve2.mjs'; import fs from 'fs';
const S = '/tmp/claude-0/-home-claude/983647b0-485b-5cec-a0d0-3276a7c1b795/scratchpad', ids = process.argv[2].split(',').map(Number);
const b = await chromium.launch(), pg = await b.newPage();
await serve(pg); await pg.route(/supabase|jsdelivr|googleapis/, r => r.fulfill({ json:[] }));
await pg.route('https://d24r2edyfve7yo.cloudfront.net/**', r => { const m = r.request().url().match(/(\d+)\.png/), f = m && `${S}/research/full/${m[1]}.png`; if (f && fs.existsSync(f)) r.fulfill({ path:f, contentType:'image/png', headers:{ 'access-control-allow-origin':'*' } }); else r.abort(); });
await pg.goto('http://127.0.0.1:8765/' + (process.env.PAGE || 'beta/index.html')); await pg.waitForFunction(() => window.__nf && window.__nf.ready, null, { timeout:120000 });
const urls = await pg.evaluate(async ids => { const out = [];
  for (const id of ids) { const ok = await window.__nf.prepare(id); if (!ok) { out.push(null); continue; }
    const c = document.createElement('canvas'); c.width = c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#00c800'; g.fillRect(0, 0, 400, 400);
    for (const n of ['base', 'm3']) { const u = window.__nf.artOf(id, n); if (!u) continue; const im = new Image(); im.src = u; await im.decode(); const L = window.__nf.layout(id);
      if (n === 'base') g.drawImage(im, 0, 0, 400, 400); else if (L && L.mb) g.drawImage(im, L.mb[0] * 0.4, L.mb[1] * 0.4, im.width * 0.4, im.height * 0.4); }
    out.push(c.toDataURL()); }
  return out; }, ids);
urls.forEach((u, k) => { if (u) fs.writeFileSync(`${process.env.OUT || S + '/kit'}_${ids[k]}.png`, Buffer.from(u.split(',')[1], 'base64')); else console.log('not ready', ids[k]); });
await b.close();
