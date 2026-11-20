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

// a clip with a quiet start, read from scratch with the part picked by itself, edited view checked, and made into a video
const file = process.argv[2] || 'u11/r10.webm';
const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required', '--js-flags=--max-old-space-size=4096'] }); const pg = await b.newPage({ viewport:{ width:390, height:844 } });
const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await routes(pg); await pg.goto('http://127.0.0.1:8765/' + PAGE); await pg.waitForFunction(() => window.__nf);
await pg.evaluate(() => { window.__T = { noLike:true }; });
const t0 = Date.now();
await pg.click('#vidBtn'); await pg.setInputFiles('#vmFile', `${S}/${file}`);
await pg.waitForSelector('#edMake', { timeout:1800000 });
const r = await pg.evaluate(() => { const V = window.__vm; return { off:V.off, dur:V.dur, full:V.full, people:V.people.map(p => [+p.t0.toFixed(1), +p.t1.toFixed(1), p.n]), lines:V.lines.map(l => [+l.t0.toFixed(1), +l.t1.toFixed(1), l.who]), envLen:V.env && V.env.length / 50, ed:[document.getElementById('edTime').textContent, (document.querySelector('.ed-trim') || {}).textContent] }; });
console.log(Math.round((Date.now() - t0) / 1000) + 's', JSON.stringify(r));
await pg.screenshot({ path:`${G}/trim_editor.png` });
// the editor's clock: seek to 1 s of the part, the real video should sit at off + 1
const clk = await pg.evaluate(async () => { const v = document.getElementById('edVid'); v.currentTime = 1; await new Promise(r => setTimeout(r, 400)); return [v.currentTime, Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime').get.call(v)]; });
console.log('editor clock (part, real):', clk);
await pg.click('#edMake');
await pg.waitForSelector('video.vm-out', { timeout:600000 });
const made = await pg.evaluate(async () => { const v = document.querySelector('video.vm-out'); const bl = await (await fetch(v.src)).blob();
  const w = document.createElement('video'); w.src = URL.createObjectURL(bl); await new Promise(r => { w.onloadedmetadata = r; });
  if (!isFinite(w.duration)) { w.currentTime = 1e9; await new Promise(r => { w.ontimeupdate = r; }); } return { size:bl.size, dur:w.duration }; });
console.log('made', JSON.stringify(made), 'errors', JSON.stringify(errs));
await b.close(); process.exit(0);
