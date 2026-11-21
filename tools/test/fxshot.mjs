// a built-in special's moving parts (fx.js) drawn at a few moments, side by side
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { serve } from '../serve2.mjs'; import fs from 'fs';
const id = +(process.argv[2] || 5900), ts = (process.argv[3] || '0,800,1600,2400,3200,4000').split(',').map(Number);
const b = await chromium.launch(), pg = await b.newPage(); await serve(pg); await pg.route(/supabase|jsdelivr|googleapis|cloudfront/, r => r.fulfill({ json:[] }));
await pg.goto('http://127.0.0.1:8765/beta/index.html'); await pg.waitForFunction(() => window.__nf && window.__nf.ready);
const u = await pg.evaluate(async ([id, ts]) => { const FX = await import(new URL('beta/fx.js', document.baseURI).href);
  const im = new Image(); im.src = `faces/${id}/base.webp`; await im.decode(); const fx = FX.prepareFx(im, {}, FX.FX_HAND[id]);
  const c = document.createElement('canvas'); c.width = 300 * ts.length; c.height = 300; const g = c.getContext('2d');
  ts.forEach((t, k) => { g.save(); g.translate(k * 300, 0); g.scale(0.3, 0.3); g.fillStyle = '#393b51'; g.fillRect(0, 0, 1000, 1000); g.drawImage(im, 0, 0); FX.drawFx(g, fx, t, 0, 0, 1000); g.restore(); });
  return c.toDataURL(); }, [id, ts]);
fs.writeFileSync(process.env.OUT || 'fx.png', Buffer.from(u.split(',')[1], 'base64')); await b.close();
