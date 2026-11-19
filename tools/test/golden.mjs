// node ch/golden.mjs [name ...]   the test clips: read each (from its saved first look and face readings when there are
// any: seconds), compare with what it should find, save the readings the first time. PAGE=beta/index.html by default.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import { serve } from '../serve2.mjs';
const S = '/tmp/claude-0/-home-claude/983647b0-485b-5cec-a0d0-3276a7c1b795/scratchpad', mp = S + '/mp', G = S + '/golden';
const PAGE = process.env.PAGE || 'beta/index.html', FRESH = !!process.env.FRESH;
const ov = (l, a, b) => Math.min(l[1], b) - Math.max(l[0], a);
const real = r => r.people.filter(p => !p.off);
const CLIPS = {
  podcast26:{ file:'u11/r.webm', checks:r => [
    ['2 people (host + guest)', real(r).length === 2],
    ['3 lines: host, guest, host', r.lines.length === 3 && r.lines.map(l => l[2]).join() === '0,1,0'],
    ['guest has "For real?" (~9.3–10.5 s)', r.lines.some(l => l[2] === 1 && ov(l, 9.3, 10.5) > 0.4)],
    ['no gap in the host\'s story (8.4–26 s: at most 1 host line after the guest)', r.lines.filter(l => l[2] === 0 && l[0] > 9).length <= 1]] },
  podcast23:{ file:'u11/r23.webm', checks:r => [
    ['2 people (host + guest)', real(r).length === 2],
    ['3 lines: host, guest, host', r.lines.length === 3 && r.lines.map(l => l[2]).join() === '0,1,0'],
    ['guest has "For real?" (~5.9–7.1 s)', r.lines.some(l => l[2] === 1 && ov(l, 5.9, 7.1) > 0.4)]] },
  choir22:{ file:'v4/choir_mid.webm', checks:r => [
    ['lead = the one person cast', real(r).length === 1],
    ['the choir is everyone else (3+)', (r.crowd || 0) >= 3],
    ['backing vocals found (3+ parts)', (r.back || []).length >= 3],
    ['row behind sings in the backing parts', r.sing && r.group === 'all']] },
  fred:{ file:'fd/src.webm', checks:r => [
    ['1 person, no made-up extras', real(r).length === 1 && !r.people.some(p => p.off)],
    ['no talking before 0.8 s (mouth shut at the start)', !r.lines.length || r.lines[0][0] >= 0.8]] },
  robots:{ file:'duo/robots.webm', checks:r => [
    ['2 people', real(r).length === 2],
    ['they take turns (both have lines)', [0, 1].every(w => r.lines.some(l => l[2] === w))],
    ['ending (after 21.6 s): just the one singing on screen (not 2, not everyone)', r.lines.filter(l => l[0] >= 21.5).every(l => l[3] === 'solo')]] },
  turtle:{ file:'tt/turtle.webm', checks:r => [
    ['the kid on screen + the reporter as a voice off camera', real(r).length === 1 && r.people.filter(p => p.off).length === 1],
    ['they take turns (4+ changes of speaker)', r.lines.filter((l, i) => i && l[2] !== r.lines[i - 1][2]).length >= 4]] },
  macho:{ file:'rs/macho.webm', checks:r => [
    ['1 person (the one with the mic), no made-up extras', real(r).length === 1 && !r.people.some(p => p.off)],
    ['talks right through (1–2 lines)', r.lines.length >= 1 && r.lines.length <= 2]] },
  podcast10mp4:{ file:'wk/r10.mp4', checks:r => [['host talks from ~4.2 s', r.lines.length >= 1 && Math.abs(r.lines[0][0] - 4.2) < 0.4 && r.lines[0][2] === 0]] },
  robotsEnd:{ file:'duo/rob_end.webm', checks:r => [
    ['ending: only the main robot sings → just them on screen (not 2, not everyone)', r.lines.filter(l => l[0] >= 3).every(l => l[3] === 'solo')]] },
};
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
async function run(name) {
  const c = CLIPS[name], t0 = Date.now(), sf = `${G}/${name}.scan.json`, ff = `${G}/${name}.follow.json`;
  const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required', '--js-flags=--max-old-space-size=4096'] }); const pg = await b.newPage({ viewport:{ width:390, height:844 } });
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await routes(pg); await pg.goto('http://127.0.0.1:8765/' + PAGE); await pg.waitForFunction(() => window.__nf);
  const T = { noLike:true, noAV:!!process.env.NOAV }; if (!FRESH && fs.existsSync(sf)) T.scanIn = JSON.parse(fs.readFileSync(sf)); if (!FRESH && fs.existsSync(ff)) T.followIn = JSON.parse(fs.readFileSync(ff));
  await pg.evaluate(T => { window.__T = T; }, T);
  await pg.click('#vidBtn'); await pg.setInputFiles('#vmFile', `${S}/${c.file}`);
  await pg.waitForSelector('#edMake', { timeout:1800000 });
  const r = await pg.evaluate(() => { const V = window.__vm; return { people:V.people.map(p => ({ t0:+p.t0.toFixed(1), t1:+p.t1.toFixed(1), n:p.n, lipOk:p.lipOk, off:!!p.off })),
    lines:V.lines.map(l => [+l.t0.toFixed(1), +l.t1.toFixed(1), l.who, l.show || 'solo']), back:(V.back || []).map(x => [x.t0, x.t1]), crowd:V.crowd && V.crowd.n, sing:V.sing, group:V.group, who:V.whoDbg, av:V.avDbg, found:(V.found || []).length }; });
  const saved = await pg.evaluate(() => ({ scan:window.__T.scan && !window.__T.scanIn ? JSON.stringify(window.__T.scan) : null, follow:window.__T.follow ? JSON.stringify(window.__T.follow) : null }));
  if (saved.scan) fs.writeFileSync(sf, saved.scan); if (saved.follow) fs.writeFileSync(ff, saved.follow);
  await b.close();
  const res = c.checks(r), secs = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(`${G}/${name}${process.env.NOAV ? ".noav" : ""}.result.json`, JSON.stringify(r));
  return { name, secs, res, r, cached:!!T.scanIn, refollowed:!!saved.follow && !!T.followIn, errs };
}
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPS), out = [];
const pool = +(process.env.POOL || 3); let k = 0;
await Promise.all(Array.from({ length:pool }, async () => { while (k < names.length) { const n = names[k++]; try { out.push(await run(n)); } catch (e) { out.push({ name:n, err:String(e).slice(0, 300) }); } } }));
let pass = 0, all = 0;
for (const o of names.map(n => out.find(x => x.name === n))) {
  if (o.err) { console.log(`✗ ${o.name}: ${o.err}`); all++; continue; }
  console.log(`${o.name} (${o.secs}s${o.cached ? ', saved first look' : ', read fresh'}${o.refollowed ? ', faces re-followed' : ''})`);
  for (const [txt, ok] of o.res) { console.log(`   ${ok ? '✓' : '✗'} ${txt}`); all++; if (ok) pass++; }
  if (o.res.some(x => !x[1])) console.log('     lines', JSON.stringify(o.r.lines), 'people', JSON.stringify(o.r.people));
  if (o.errs.length) console.log('     page errors', JSON.stringify(o.errs.slice(0, 3)));
}
console.log(`\n${pass}/${all} checks pass`);
process.exit(0);
