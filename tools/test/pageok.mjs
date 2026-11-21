import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { serve } from '../serve2.mjs';
const b = await chromium.launch(), pg = await b.newPage(); pg.on('pageerror', e => console.log('PAGEERR', e.message)); pg.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await serve(pg); await pg.route(/supabase|jsdelivr|googleapis|cloudfront/, r => r.fulfill({ json:[] }));
await pg.goto('http://127.0.0.1:8765/beta/index.html'); await pg.waitForTimeout(5000);
console.log(await pg.evaluate(() => ({ nf:!!window.__nf, ready:window.__nf && window.__nf.ready, prep:!!(window.__nf && window.__nf.prepare) })));
await b.close();
