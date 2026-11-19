// face recognizers compared on the test clips: face-api (the app's now) vs Human's faceres / faceres-deep.
// Labels = who the app ended up with on clips where its result is right. Same person in DIFFERENT shots is the hard case.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import { serve } from '../serve2.mjs';
const S = '/tmp/claude-0/-home-claude/983647b0-485b-5cec-a0d0-3276a7c1b795/scratchpad', mp = S + '/mp', G = S + '/golden';
const CL = { podcast26:'u11/r.webm', podcast23:'u11/r23.webm', robots:'duo/robots.webm', choir22:'v4/choir_mid.webm' };
async function run(name) {
  const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required', '--js-flags=--max-old-space-size=4096'] }); const pg = await b.newPage({ viewport:{ width:390, height:844 } });
  await serve(pg);
  await pg.route(/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@[^/]+\/(.*)/, r => { const p = r.request().url().split(/tasks-vision@[^/]+\//)[1]; r.fulfill({ body:fs.readFileSync(`${mp}/package/${p}`), contentType:p.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' }); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-audio@[^/]+\/(.*)/, r => { const p = r.request().url().split(/tasks-audio@[^/]+\//)[1]; r.fulfill({ body:fs.readFileSync(`${S}/mpa/package/${p}`), contentType:p.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' }); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/@vladmandic\/face-api@[^/]+\/(.*)/, r => { const p = r.request().url().split(/face-api@[^/]+\//)[1]; r.fulfill({ body:fs.readFileSync(`${S}/fa/package/${p}`), contentType:p.endsWith('.js') ? 'text/javascript' : p.endsWith('.json') ? 'application/json' : 'application/octet-stream', headers:{ 'access-control-allow-origin':'*' } }); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/@vladmandic\/human-models@[^/]+\/(.*)/, r => { const p = r.request().url().split(/human-models@[^/]+\//)[1]; r.fulfill({ body:fs.readFileSync(`${S}/hm/package/${p}`), contentType:p.endsWith('.json') ? 'application/json' : 'application/octet-stream', headers:{ 'access-control-allow-origin':'*' } }); });
  await pg.route(/storage\.googleapis\.com.*yamnet\.tflite/, r => r.fulfill({ body:fs.readFileSync('/tmp/yam/package/src/model/yamnet.tflite'), contentType:'application/octet-stream' }));
  await pg.route(/storage\.googleapis\.com.*face_landmarker\.task/, r => r.fulfill({ body:fs.readFileSync(`${mp}/pk/package/face_landmarker.task`), contentType:'application/octet-stream' }));
  await pg.route('https://d24r2edyfve7yo.cloudfront.net/**', r => r.abort());
  await pg.route('https://jmiesqhrpcmrthrquqpq.supabase.co/**', r => r.fulfill({ json:[] }));
  await pg.goto('http://127.0.0.1:8765/beta/index.html'); await pg.waitForFunction(() => window.__nf);
  const T = { noLike:true, scanIn:JSON.parse(fs.readFileSync(`${G}/${name}.scan.json`)), followIn:JSON.parse(fs.readFileSync(`${G}/${name}.follow.json`)) };
  await pg.evaluate(T => { window.__T = T; }, T);
  await pg.click('#vidBtn'); await pg.setInputFiles('#vmFile', `${S}/${CL[name]}`);
  await pg.waitForSelector('#edMake', { timeout:900000 });
  const out = await pg.evaluate(async () => {
    const V = window.__vm, fa = await import('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.esm.js'), tf = fa.tf;
    await tf.ready(); if (!fa.nets.faceRecognitionNet.isLoaded) await fa.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model');
    const M = {}; for (const m of ['faceres', 'faceres-deep']) M[m] = await tf.loadGraphModel(`https://cdn.jsdelivr.net/npm/@vladmandic/human-models@3.0.4/models/${m}.json`);
    const v = document.createElement('video'); v.muted = true; v.src = V.url; await new Promise(r => { v.onloadeddata = r; }); const fw = v.videoWidth, fh = v.videoHeight;
    const fc = document.createElement('canvas'); fc.width = fw; fc.height = fh; const fg = fc.getContext('2d');
    const c150 = document.createElement('canvas'); c150.width = c150.height = 150; const g150 = c150.getContext('2d');
    const c224 = document.createElement('canvas'); c224.width = c224.height = 224; const g224 = c224.getContext('2d');
    const seek = t => new Promise(r => { v.onseeked = r; v.currentTime = Math.min(t + 0.001, v.duration - 0.05); });
    const rows = [];
    for (let i = 0; i < V.people.length; i++) { const p = V.people[i]; if (p.off || !p.tracks) continue;
      let fs_ = []; p.tracks.forEach((tr, k) => tr.faces.forEach(f => fs_.push({ f, tr:k + ':' + i })));
      if (fs_.length > 40) fs_ = fs_.filter((_, j) => j % Math.ceil(fs_.length / 40) === 0);
      for (const { f, tr } of fs_) {
        await seek(f.t); fg.drawImage(v, 0, 0, fw, fh);
        const sx = f.cx * fw, sy = f.cy * fh, side = f.sp * 1.25 * fw / window.__T.scanIn.fw;
        g150.fillStyle = '#808080'; g150.fillRect(0, 0, 150, 150); g150.drawImage(fc, sx - side / 2, sy - side / 2, side, side, 0, 0, 150, 150);
        g224.drawImage(fc, sx - side / 2, sy - side / 2, side, side, 0, 0, 224, 224);
        const dRaw = await fa.nets.faceRecognitionNet.computeFaceDescriptor(c150);
        const r = { who:i, shot:tr, t:f.t, app:Array.from(f.desc || []), faRaw:Array.from(dRaw.length === 128 ? dRaw : dRaw[0]) };
        for (const m in M) { const x = tf.tidy(() => tf.browser.fromPixels(c224).toFloat().expandDims(0)); const res = M[m].execute(x); const d = (Array.isArray(res) ? res : [res]).find(t => t.shape[1] === 1024); r[m] = Array.from(await d.data()); tf.dispose(res); x.dispose(); }
        rows.push(r);
      }
    }
    return rows;
  });
  await b.close(); return out;
}
const auc = (same, diff) => { let w = 0; for (const s of same) for (const d of diff) w += s < d ? 1 : s === d ? 0.5 : 0; return w / (same.length * diff.length); };
const dist = { app:'euc', faRaw:'euc', faceres:'cos', 'faceres-deep':'cos' };
const D = (a, b, k) => { if (dist[k] === 'euc') { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s); } let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; } return 1 - d / Math.sqrt(na * nb); };
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CL);
for (const n of names) {
  if (!fs.existsSync(`${G}/${n}.scan.json`)) { console.log(n, 'no saved scan yet'); continue; }
  const rows = await run(n); fs.writeFileSync(`${G}/${n}.fr.json`, JSON.stringify(rows));
  const ppl = new Set(rows.map(r => r.who));
  console.log(`\n${n}: ${rows.length} faces, ${ppl.size} people`);
  for (const k of Object.keys(dist)) {
    const same = [], sameX = [], diff = [];
    for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) { const a = rows[i], b = rows[j]; if (!a[k].length || !b[k].length) continue; const d = D(a[k], b[k], k);
      if (a.who === b.who) { same.push(d); if (a.shot !== b.shot) sameX.push(d); } else diff.push(d); }
    if (!diff.length) { console.log(`  ${k}: only one person`); continue; }
    console.log(`  ${k.padEnd(13)} AUC all ${auc(same, diff).toFixed(3)}  across shots ${sameX.length ? auc(sameX, diff).toFixed(3) : '—'} (${sameX.length} pairs)`);
  }
}
process.exit(0);
