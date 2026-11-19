import { server } from './wkserve.mjs'; import { webkit } from './wd.mjs';
server.listen(8770); const w = await webkit();
await w.go('http://127.0.0.1:8770/beta/index.html');
await w.js(`const b = document.createElement('button'); b.id = 'tb'; b.textContent = 'test'; b.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;width:200px;height:60px'; document.body.appendChild(b);
  b.onclick = () => { const res = window.__res = {};
  const c = document.createElement('canvas'); c.width = 320; c.height = 320; const g = c.getContext('2d'); document.body.appendChild(c);
  let k = 0; const iv = setInterval(() => { g.fillStyle = 'hsl(' + (k++ * 20) + ',80%,50%)'; g.fillRect(0, 0, 320, 320); }, 33);
  const out = c.captureStream(30);
  const ac = new AudioContext(); const o = ac.createOscillator(); const d = ac.createMediaStreamDestination(); o.connect(d); o.start(); res.state0 = ac.state; d.stream.getAudioTracks().forEach(t => out.addTrack(t));
  const rec = new MediaRecorder(out, { mimeType:'video/mp4' }); const ch = []; rec.ondataavailable = e => ch.push(e.data.size);
  rec.onstop = () => { res.chunks = ch; res.state1 = ac.state; clearInterval(iv); res.done = true; }; rec.start(500); setTimeout(() => rec.stop(), 3000); };`);
await w.click(await w.find('#tb'));
let r; for (let i = 0; i < 40; i++) { r = await w.js('return window.__res'); if (r && r.done) break; await new Promise(r => setTimeout(r, 500)); }
console.log(JSON.stringify(r)); await w.quit(); process.exit(0);
