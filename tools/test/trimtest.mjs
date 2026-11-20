// node ch/golden.mjs [name ...]   the test clips: read each (from its saved first look and face readings when there are
// any: seconds), compare with what it should find, save the readings the first time. PAGE=beta/index.html by default.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import { serve } from '../serve2.mjs';
const S = '/tmp/claude-0/-home-claude/983647b0-485b-5cec-a0d0-3276a7c1b795/scratchpad', mp = S + '/mp', G = S + '/golden';
const PAGE = process.env.PAGE || 'beta/index.html', FRESH = !!process.env.FRESH;
const ov = (l, a, b) => Math.min(l[1], b) - Math.max(l[0], a);
const real = r => r.people.filter(p => !p.off);
const routes = async pg => {
  await serve(pg);
  await pg.route(/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@[^/]+\/(.*)/, r => { const p = r.request().url().split(/tasks-vision@[^/]+\//)[1]; r.fulfill({ body:fs.readFileSync(`${mp}/package/${p}`), contentType:p.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' }); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-audio@[^/]+\/(.*)/, r => { const p = r.request().url().split(/tasks-audio@[^/]+\//)[1]; r.fulfill({ body:fs.readFileSync(`${S}/mpa/package/${p}`), contentType:p.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' }); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/@vladmandic\/face-api@[^/]+\/(.*)/, r => { const p = r.request().url().split(/face-api@[^/]+\//)[1]; r.fulfill({ body:fs.readFileSync(`${S}/fa/package/${p}`), contentType:p.endsWith('.js') ? 'text/javascript' : p.endsWith('.json') ? 'application/json' : 'application/octet-stream', headers:{ 'access-control-allow-origin':'*' } }); });
  await pg.route(/storage\.googleapis\.com.*yamnet\.tflite/, r => r.fulfill({ body:fs.readFileSync('/tmp/yam/package/src/model/yamnet.tflite'), contentType:'application/octet-stream' }));
  await pg.route(/storage\.googleapis\.com.*face_landmarker\.task/, r => r.fulfill({ body:fs.readFileSync(`${mp}/pk/package/face_landmarker.task`), contentType:'application/octet-stream' }));
  await pg.route('https://d24r2edyfve7yo.cloudfront.net/**', r => r.abort());
  await pg.route('https://jmiesqhrpcmrthrquqpq.supabase.co/**', r => r.fulfill({ json:[] }));
};

const CASES = [
  ['podcast26', 'u11/r.webm', r => [['quiet start left out (talk starts ~4.2 s → part starts ~3.9 s)', Math.abs(r.part[0] - 3.9) < 0.4], ['the end kept (talks to the end)', r.full - r.part[1] < 0.6]]],
  ['fred', 'fd/src.webm', r => [['short clip, talk from ~1 s: kept or trimmed by ≤ 0.8 s', r.part[0] <= 0.8], ['whole length otherwise', r.full - r.part[1] < 1.2]]],
  ['choir22', 'v4/choir_mid.webm', r => [['song: nothing cut', r.part[0] < 0.3 && r.full - r.part[1] < 1.2]]],
  ['panel91', 'n1/panel.webm', r => [['over 90 s → Pick the part screen', r.screen === 'Pick the part'], ['window is 90 s', Math.abs(r.part[1] - r.part[0] - 90) < 0.1]]],
];
const out = []; let pass = 0, all = 0;
for (const [name, file, checks] of CASES) {
  const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'] }); const pg = await b.newPage({ viewport:{ width:390, height:844 } });
  await routes(pg); await pg.goto('http://127.0.0.1:8765/' + PAGE); await pg.waitForFunction(() => window.__nf);
  await pg.evaluate(() => { window.__T = { partOnly:true }; });
  await pg.click('#vidBtn'); await pg.setInputFiles('#vmFile', `${S}/${file}`);
  const t0 = Date.now(); let screen = null;
  await pg.waitForFunction(() => (window.__T && window.__T.partOut) || (document.getElementById('vmTitle') || {}).textContent === 'Pick the part', null, { timeout:300000 });
  screen = await pg.textContent('#vmTitle');
  if (screen === 'Pick the part') { await pg.waitForSelector('#ppGo'); await pg.screenshot({ path:`${G}/pick.png` }); await pg.click('#ppGo'); await pg.waitForFunction(() => window.__T.partOut, null, { timeout:60000 }); }
  const r = await pg.evaluate(() => ({ part:window.__T.partOut, full:window.__vm.full, talk:(window.__T.talk || []).length }));
  r.screen = screen; await b.close();
  console.log(`${name} (${Math.round((Date.now() - t0) / 1000)}s): part ${r.part.map(x => x.toFixed(2)).join('–')} of ${r.full.toFixed(1)} s, ${r.talk} talking stretches`);
  for (const [txt, ok] of checks(r)) { console.log(`   ${ok ? '✓' : '✗'} ${txt}`); all++; if (ok) pass++; }
}
console.log(`\n${pass}/${all} checks pass`); process.exit(0);
