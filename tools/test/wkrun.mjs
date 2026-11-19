// one clip all the way through in WebKit (Safari's engine): read it, open the editor, make the video
import { server } from './wkserve.mjs'; import { webkit } from './wd.mjs'; import fs from 'fs';
const S = '/tmp/claude-0/-home-claude/983647b0-485b-5cec-a0d0-3276a7c1b795/scratchpad', clip = process.argv[2] || 'wk/r10.mp4';
server.listen(8770); const w = await webkit(); const t0 = Date.now(), el = () => Math.round((Date.now() - t0) / 1000) + 's';
const wait = async (js, secs) => { for (let i = 0; i < secs * 2; i++) { const r = await w.js(js); if (r) return r; await new Promise(r => setTimeout(r, 500)); } return null; };
await w.timeouts({ script:600000 });
await w.go('http://127.0.0.1:8770/' + (process.env.PAGE || 'beta/index.html'));
await wait('return !!window.__nf', 60);
await w.js(`window.__errs = []; addEventListener('error', e => __errs.push(String(e.message))); addEventListener('unhandledrejection', e => __errs.push('rej ' + String(e.reason)));`);
await w.js(`document.getElementById('vidBtn').click()`);
// a page can't set a file input; WebDriver can (send the path to the input)
await w.js(`const i = document.getElementById('vmFile'); i.hidden = false; i.style.cssText = 'display:block;position:fixed;top:0;left:0;z-index:9999;width:200px;height:40px'`);
const inp = await w.find('#vmFile'); await w.keys(inp, `${S}/${clip}`);
console.log(el(), 'clip given');
let last = '';
const ok = await (async () => { for (let i = 0; i < 1800; i++) {
  const st = await w.js(`const t = document.getElementById('vmTitle'), p = document.getElementById('vmProg'); return [t && t.textContent, p && p.style.width, !!document.getElementById('edMake'), (window.__errs || []).slice(0, 3)]`);
  const s = st[0] + ' ' + st[1]; if (s !== last) { console.log(el(), s, st[3].length ? JSON.stringify(st[3]) : ''); last = s; }
  if (st[2]) return true; await new Promise(r => setTimeout(r, 1000)); } return false; })();
fs.writeFileSync(`${S}/wk/editor.png`, await w.shot());
if (ok) {
  const sum = await w.js(`const V = window.__vm; return { people:V.people.length, lines:V.lines.map(l => [+l.t0.toFixed(1), +l.t1.toFixed(1), l.who]), sound:V.soundFrom, diag:V.diag && { looks:V.diag.looks, miss:V.diag.miss, mode:V.diag.mode }, err:V.err || null }`);
  console.log(el(), 'editor', JSON.stringify(sum));
  await w.js(`document.getElementById('edMake').click()`);
  let done = null; for (let i = 0; i < 900 && !done; i++) { done = await w.js(`const v = document.querySelector('#vm video.vm-out, #vm video[src^="blob:"]'); const t = document.getElementById('vmTitle'); return (v && v.src && t && !/ready|making|getting/i.test(t.textContent)) ? [t.textContent, v.src] : null`); if (!done) await new Promise(r => setTimeout(r, 1000)); }
  const info = done && await w.jsAsync(`const cb = arguments[arguments.length - 1]; fetch(arguments[0]).then(r => r.blob()).then(b => cb([b.size, b.type])).catch(e => cb(String(e)))`, [done[1]]);
  console.log(el(), 'made', JSON.stringify(done && done[0]), JSON.stringify(info), JSON.stringify(await w.js('return window.__errs')));
  fs.writeFileSync(`${S}/wk/made.png`, await w.shot());
}
await w.quit(); process.exit(0);
