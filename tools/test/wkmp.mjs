// WebKit: which ways of setting up MediaPipe's face reader actually find a face here
import { server } from './wkserve.mjs'; import { webkit } from './wd.mjs';
server.listen(8770); const w = await webkit(); await w.timeouts({ script:300000 });
await w.go('http://127.0.0.1:8770/beta/index.html');
for (let i = 0; i < 60 && !(await w.js('return !!window.__nf')); i++) await new Promise(r => setTimeout(r, 500));
const r = await w.jsAsync(`const cb = arguments[arguments.length - 1]; (async () => {
  const V = '${process.argv[2]}', vision = await import('/cdn/npm/@mediapipe/tasks-vision@' + V + '/vision_bundle.mjs');
  const files = await vision.FilesetResolver.forVisionTasks('/cdn/npm/@mediapipe/tasks-vision@' + V + '/wasm');
  const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(await (await fetch('/clips/wk/r10.mp4')).blob()); await new Promise(r => { v.onloadeddata = r; v.load(); });
  await new Promise(r => { v.onseeked = r; v.currentTime = 2; });
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
  const out = { offscreenWebgl2: (() => { try { return !!new OffscreenCanvas(8, 8).getContext('webgl2'); } catch (e) { return String(e); } })() };
  for (const [name, del, cv] of [['GPU', 'GPU', null], ['CPU', 'CPU', null], ['GPU+page canvas', 'GPU', 1], ['CPU+page canvas', 'CPU', 1]]) {
    try { const o = { baseOptions:{ modelAssetPath:'/gs/x/face_landmarker.task', delegate:del }, runningMode:'IMAGE', numFaces:4 }; if (cv) o.canvas = document.createElement('canvas');
      const lm = await vision.FaceLandmarker.createFromOptions(files, o); const res = lm.detect(c); out[name] = (res.faceLandmarks || []).length + ' faces'; lm.close(); }
    catch (e) { out[name] = 'ERR ' + String(e).slice(0, 100); } }
  cb(out); })().catch(e => cb('outer ' + e)); `);
console.log(JSON.stringify(r, null, 1)); await w.quit(); process.exit(0);
