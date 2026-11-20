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

// child / woman / man voice scores over a clip, every 0.25 s (YAMNet's ~1 s windows, the sound shifted by quarters)
const b = await chromium.launch(); const pg = await b.newPage();
await routes(pg); await pg.route('http://127.0.0.1:8765/clip/**', r => r.fulfill({ body:fs.readFileSync(S + '/' + process.argv[2]), contentType:'video/webm' }));
await pg.goto('http://127.0.0.1:8765/' + PAGE); await pg.waitForFunction(() => window.__nf);
const d = await pg.evaluate(async () => {
  const V = '0.10.14'; const audio = await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@${V}/audio_bundle.mjs`);
  const mv = V;
  const files = await audio.FilesetResolver.forAudioTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@${mv}/wasm`);
  const cl = await audio.AudioClassifier.createFromOptions(files, { baseOptions:{ modelAssetPath:'https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite' }, maxResults:-1 });
  const ab = await (await fetch('/clip/x.webm')).arrayBuffer(); const ac = new AudioContext(); const buf = await ac.decodeAudioData(ab);
  const oc = new OfflineAudioContext(1, Math.ceil(buf.duration * 16000), 16000), src = oc.createBufferSource(); src.buffer = buf; src.connect(oc.destination); src.start();
  const mono = (await oc.startRendering()).getChannelData(0), out = [];
  for (const off of [0, 0.25, 0.5, 0.75]) { const res = cl.classify(mono.subarray(Math.round(off * 16000)), 16000);
    res.forEach((r, k) => { const cats = r.classifications[0].categories, g = nm => (cats.find(c => c.categoryName === nm) || { score:0 }).score;
      out.push([+(off + (r.timestampMs != null ? r.timestampMs / 1000 : k * 0.975) + 0.48).toFixed(2), g('Speech'), g('Child speech, kid speaking'), g('Female speech, woman speaking'), g('Male speech, man speaking'), g('Music'), g('Laughter')]); }); }
  return out.sort((a, b) => a[0] - b[0]);
});
console.log('  mid   speech  child  woman   man   music  laugh');
for (const r of d) console.log(r.map((x, i) => i ? x.toFixed(3).padStart(6) : String(x).padStart(6)).join(' '));
await b.close(); process.exit(0);
