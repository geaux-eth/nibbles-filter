// the editor's round thumbnails (nibThumb) for some Nibbles, side by side, as a picture
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { serve } from '../serve2.mjs';
const ids = (process.argv[2] || '5900,546,3159,929').split(',').map(Number);
const b = await chromium.launch(), pg = await b.newPage({ viewport:{ width:120 * ids.length, height:140 } });
await serve(pg); await pg.route(/supabase|cloudfront|jsdelivr|googleapis/, r => r.fulfill({ json:[] }));
await pg.goto('http://127.0.0.1:8765/' + (process.env.PAGE || 'beta/index.html')); await pg.waitForFunction(() => window.__nf && window.__nf.ready);
await pg.evaluate(ids => { document.body.innerHTML = ''; document.body.style.cssText = 'background:#fff;display:flex;flex-wrap:nowrap;margin:0';
  ids.forEach((id, n) => { const c = document.createElement('span'); c.className = 'circ'; c.style.cssText = `position:absolute;left:${10 + n * 120}px;top:10px;display:block;width:100px;height:100px;border-radius:50%;margin:0;border:3px solid #000`; window.__nf.thumb(c, id); document.body.appendChild(c); }); }, ids);
await pg.waitForTimeout(1500); await pg.screenshot({ path:process.env.OUT || 'thumbs.png' }); await b.close();
