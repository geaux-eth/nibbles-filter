// node ch/golden.mjs [name ...]   the test clips: read each (from its saved first look and face readings when there are
// any: seconds), compare with what it should find, save the readings the first time. PAGE=beta/index.html by default.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import { serve } from '../serve2.mjs';
const S = '/tmp/claude-0/-home-claude/983647b0-485b-5cec-a0d0-3276a7c1b795/scratchpad', mp = S + '/mp', G = process.env.GDIR || S + '/golden';
const PAGE = process.env.PAGE || 'beta/index.html', FRESH = !!process.env.FRESH;
const ov = (l, a, b) => Math.min(l[1], b) - Math.max(l[0], a);
const real = r => r.people.filter(p => !p.off);
// the mouth itself (what the video shows): the share of [a, b) seconds in which a mouth moves, every moment counted as
// inside someone's line (so a line stretched over a laugh in the editor is covered too)
const mv = (r, a, b) => { const m = r.mouth || [], i0 = Math.round(a / 0.05), i1 = Math.round(b / 0.05); let s = 0; for (let i = i0; i < i1; i++) s += m[i] || 0; return s / Math.max(1, i1 - i0); };
const keepsTalk = r => ['talking isn\'t shut by the laugh rule (mouth moves at least 95% as much as without it)', !!r.mouth && r.mouth.reduce((a, b) => a + b, 0) >= 0.95 * r.mouthOff.reduce((a, b) => a + b, 0)];
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
    // (GEAUX, 20 Nov: the kid starts speaking just before 9 s; before that it's the reporter)
    ...(() => { const at = t => { const l = r.lines.find(l => l[0] <= t && t < l[1]); return l ? l[2] : -1; }, kid = r.people.findIndex(p => !p.off), off = r.people.findIndex(p => p.off);
      return [['the reporter asks first (2 s, 4 s, 6 s, 8 s are the voice off camera)', off >= 0 && [2, 4, 6, 8].every(t => at(t) === off)],
        ['the kid answers just before 9 s ("I like turtles", 9.3 s)', kid >= 0 && at(9.3) === kid]]; })()] },
  macho:{ file:'rs/macho.webm', checks:r => [
    ['1 person (the one with the mic), no made-up extras', real(r).length === 1 && !r.people.some(p => p.off)],
    ['talks right through (1–2 lines)', r.lines.length >= 1 && r.lines.length <= 2]] },
  podcast10mp4:{ file:'wk/r10.mp4', checks:r => [['host talks from ~4.2 s', r.lines.length >= 1 && Math.abs(r.lines[0][0] - 4.2) < 0.4 && r.lines[0][2] === 0]] },
  sitcom:{ file:'n1/seinfeld.webm', checks:r => { const at = t => { const l = r.lines.find(l => l[0] <= t && t < l[1]); return l ? l[2] : -1; }, K = at(3.5), G = at(9.5);
    return [
    ['no made-up voice off camera (the laugh track isn\'t a person)', !r.people.some(p => p.off)],
    ['not "everyone on screen" by default (no row behind in a sitcom)', r.group !== 'all'],
    ['4 people: Kramer, George, Jerry and Elaine', real(r).length === 4],
    ['Kramer\'s close-ups are his lines (2–5.8, 12–14, 24–27 s)', K >= 0 && at(13) === K && at(25) === K],
    ['George\'s close-ups are his (8–11.9, 28–30, 43–45 s)', G >= 0 && G !== K && at(29) === G && at(44) === G],
    ['Jerry/Elaine two-shots go to Jerry or Elaine', [15, 22].every(t => at(t) >= 0 && at(t) !== K && at(t) !== G)],   // (19.5 s is Kramer off camera: GEAUX's edit)
    ['the laugh at 6.6–8.2 s is nobody\'s line', at(6.8) === -1 && at(7.6) === -1],
    ['the laugh at 6.6–8.2 s doesn\'t move a mouth, even if a line is stretched over it', mv(r, 6.6, 8.2) <= 0.15],
    ['GEAUX\'s own edit (21 Nov): Kramer 4, 12.5, 25, 38.3 s (and 35.2 s no one else); George 10, 30, 37, 44 s; Elaine 16, 41 s; Jerry 21.5 s',
      (() => { const E = at(16), J = at(21.5); return [4, 12.5, 25, 38.3].every(t => at(t) === K) && [K, -1].includes(at(35.2)) && [10, 30, 37, 44].every(t => at(t) === G) && at(41) === E && new Set([K, G, E, J]).size === 4 && ![E, J].includes(-1); })()],
    // Elaine's lines start with her (GEAUX, 21 Nov: 'you really struggle to transition to Elaine's lines'): her two-shot at
    // 14–15 s isn't George's (he's not in it), and she's on by 15.1 s and by 40 s
    (() => { const E = at(16); return ['Elaine\'s lines start with her: not George at 14–15 s, Elaine on by 15.1 and 40 s', E >= 0 && [14.25, 14.5, 14.75].every(t => at(t) !== G) && at(15.1) === E && at(40) === E]; })(),
    // the audience's laugh at 26–27.7 s after Kramer's line: nobody's line (Jerry, laughing along, 'said' it: a cut to him)
    ['the laugh at 26–27.7 s is nobody\'s line (no cut to someone laughing)', !r.lines.some(l => l[0] >= 25.9 && l[1] <= 27.8)],
    // the whole of GEAUX's edit, every quarter second, as it's seen: who's on screen (their line, a pause under a second still
    // on whoever just spoke, else the main one). A quarter second either side of each change not counted
    (() => { const E = at(16), J = at(21.5), who = { K, G, E, J }, seen = t => { const w = at(t); if (w >= 0) return w; const l = r.lines.filter(l => l[1] <= t).pop(); return l && t - l[1] < 1 ? l[2] : 0; }, T = [[0, 9.1, 'K'], [9.1, 11.3, 'G'], [11.3, 14.5, 'K'], [14.5, 18.3, 'E'], [18.3, 20, 'K'], [20, 23.4, 'J'], [23.4, 27.7, 'K'], [27.7, 34.4, 'G'], [34.4, 36, 'K'], [36, 38.2, 'G'], [38.2, 39.7, 'K'], [39.7, 42.7, 'E'], [42.7, 45.6, 'G']];
      let n = 0, ok = 0; const miss = []; for (const [a, b, w] of T) for (let t = a + 0.25; t < b - 0.25; t += 0.25) { n++; if (seen(t) === who[w] && who[w] >= 0) ok++; else if (!miss.length || t - miss[miss.length - 1][1] > 0.3) miss.push([+t.toFixed(2), +t.toFixed(2), w]); else miss[miss.length - 1][1] = +t.toFixed(2); }
      const pc = Math.round(ok / n * 100); return ['GEAUX\'s edit, all of it: ' + pc + '% of the time the right person (85%+ to pass); wrong at ' + miss.map(m => m[0] + '–' + m[1] + ' ' + m[2]).join(', '), pc >= 85]; })()]; } },
  panel90:{ file:'n1/panel90.webm', checks:r => { const at = t => { const l = r.lines.find(l => l[0] <= t && t < l[1]); return l ? l[2] : -1; };
    const H = at(5), Ho = at(15), Gl = at(18.5), W = at(26), D = at(31);
    return [
    ['5 people: the host and the 4 on the panel', real(r).length === 5],
    ['no made-up voice off camera (the audience isn\'t a person)', !r.people.some(p => p.off)],
    ['not "everyone on screen" by default', r.group !== 'all'],
    ['each close-up is that person\'s line (host 5 s, hoodie 15 s, glasses 18.5 s, woman 26 s, dark hair 31 s)', new Set([H, Ho, Gl, W, D]).size === 5 && ![H, Ho, Gl, W, D].includes(-1)],
    ['and later on too (dark hair 58 s, hoodie 75 s, woman 50 s)', at(58) === D && at(75) === Ho && at(50) === W]]; } },
  robotsEnd:{ file:'duo/rob_end.webm', checks:r => [
    ['ending: only the main robot sings → just them on screen (not 2, not everyone)', r.lines.filter(l => l[0] >= 3).every(l => l[3] === 'solo')]] },
};
CLIPS.panelB = { file:'n2/a.h264.mp4', checks:r => { const at = t => { const l = r.lines.find(l => l[0] <= t && t < l[1]); return l ? l[2] : -1; };
    const H = at(8), W = at(15), D = at(21), G = at(26), S = at(33);
    return [
    ['5 people: the host and the 4 on the panel (the BBC logo isn\'t one)', real(r).length === 5 && !r.people.some(p => p.off)],
    ['the host\'s intro is his (4–12 s)', H >= 0 && at(4.5) === H && at(12) === H],
    ['each one\'s first line is theirs (woman 15 s, piano 21 s, glasses 26 s, white shirt 33 s)', new Set([H, W, D, G, S]).size === 5 && ![W, D, G, S].includes(-1)],
    ['and later on too (piano 47, 63.5 s; glasses 52, 69, 70 s; white shirt 55 s; woman 60, 75 s)', at(47) === D && at(63.5) === D && at(52) === G && at(69) === G && at(70) === G && at(55) === S && at(60) === W && at(75) === W],
    ['mouths stay shut through the laughter (captioned LAUGHTER: 21.5–23.5, 28–32, 36–37.6, 65.5–67.5, 70.7–72 s)', [[21.5, 23.5], [28, 32], [36, 37.6], [65.5, 67.5], [70.7, 72]].every(([a, b]) => mv(r, a, b) <= 0.15)],
    ['mouths move while they talk (host 5–11, woman 13.5–16.5, white shirt 32.6–34.3, woman 58–61 s)', [[5, 11], [13.5, 16.5], [32.6, 34.3], [58, 61]].every(([a, b]) => mv(r, a, b) >= 0.4)]]; } };
CLIPS.latarian = { file:'n2/b.h264.mp4', checks:r => { const at = t => { const l = r.lines.find(l => l[0] <= t && t < l[1]); return l ? l[2] : -1; };
    const off = r.people.findIndex(p => p.off), K = at(26), Gm = at(21), O = at(45);
    return [
    ['the narrator over shots with nobody in them is a voice off camera (10, 40, 50 s)', off >= 0 && at(10) === off && at(40) === off && at(50) === off],
    ['grandma 21 s, the kid 26 s, the officer 45 s: three different people, none the narrator', new Set([K, Gm, O, off]).size === 4 && ![K, Gm, O].includes(-1)],
    ['the kid\'s later lines are his (34, 58 s)', at(34) === K && at(58) === K]]; } };
// GEAUX's held-out clips (21 Nov): never tuned on. Their expected results are written from the clips themselves
// (ho/truth.json), scored every quarter second as seen
CLIPS.office1 = { file:'ho/h1.mp4', checks:r => hoChecks('office1', r) };
CLIPS.office2 = { file:'ho/h2.mp4', checks:r => hoChecks('office2', r) };
CLIPS.sunny = { file:'ho/h3.mp4', checks:r => hoChecks('sunny', r) };
CLIPS.final = { file:'ho/final.mp4', checks:r => hoChecks('final', r) };
CLIPS.frank = { file:'ho/frank.mp4', checks:r => hoChecks('frank', r) };
for (const n of ['podcast26', 'podcast23', 'turtle', 'macho', 'podcast10mp4', 'latarian']) { const f = CLIPS[n].checks; CLIPS[n].checks = r => [...f(r), keepsTalk(r)]; }
function hoChecks(name, r) {
  const f = S + '/ho/truth.json'; if (!fs.existsSync(f)) return [];
  const T = JSON.parse(fs.readFileSync(f))[name]; if (!T) return [];
  // (who's who: each truth name is the person the app found nearest that face; written in truth.json by hand from the
  // faces' positions. Scored every quarter second of talking, a quarter second either side of each change not counted)
  const at = t => { const l = r.lines.find(l => l[0] <= t && t < l[1]); return l ? l[2] : -1; };
  let n = 0, ok = 0; const miss = [];
  for (const [a, b, w] of T.lines) for (let t = a + 0.25; t < b - 0.25; t += 0.25) { n++; if (at(t) === T.map[w]) ok++; else miss.push(+t.toFixed(2) + w); }
  const pc = Math.round(100 * ok / Math.max(1, n));
  return [['held out: ' + pc + '% of the talking with the right person (85%+); wrong at ' + miss.join(' '), pc >= 85]];
}
const routes = async pg => {
  await serve(pg);
  await pg.route(/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@[^/]+\/(.*)/, r => { const p = r.request().url().split(/tasks-vision@[^/]+\//)[1]; r.fulfill({ body:fs.readFileSync(`${mp}/package/${p}`), contentType:p.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' }); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-audio@[^/]+\/(.*)/, r => { const p = r.request().url().split(/tasks-audio@[^/]+\//)[1]; r.fulfill({ body:fs.readFileSync(`${S}/mpa/package/${p}`), contentType:p.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' }); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/@vladmandic\/face-api@[^/]+\/(.*)/, r => { const p = r.request().url().split(/face-api@[^/]+\//)[1]; r.fulfill({ body:fs.readFileSync(`${S}/fa/package/${p}`), contentType:p.endsWith('.js') ? 'text/javascript' : p.endsWith('.json') ? 'application/json' : 'application/octet-stream', headers:{ 'access-control-allow-origin':'*' } }); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/@vladmandic\/human-models@[^/]+\/(.*)/, r => { const p = r.request().url().split(/human-models@[^/]+\//)[1]; r.fulfill({ body:fs.readFileSync(`${S}/hm/package/${p}`), contentType:p.endsWith('.json') ? 'application/json' : 'application/octet-stream', headers:{ 'access-control-allow-origin':'*' } }); });
  await pg.route(/storage\.googleapis\.com.*yamnet\.tflite/, r => r.fulfill({ body:fs.readFileSync('/tmp/yam/package/src/model/yamnet.tflite'), contentType:'application/octet-stream' }));
  await pg.route(/storage\.googleapis\.com.*face_landmarker\.task/, r => r.fulfill({ body:fs.readFileSync(`${mp}/pk/package/face_landmarker.task`), contentType:'application/octet-stream' }));
  await pg.route('https://d24r2edyfve7yo.cloudfront.net/**', r => { const m = r.request().url().match(/(\d+)\.png/), f = m && `${S}/research/full/${m[1]}.png`; if (process.env.RENDER && f && fs.existsSync(f)) r.fulfill({ path:f, contentType:'image/png', headers:{ 'access-control-allow-origin':'*' } }); else r.abort(); });
  await pg.route('https://jmiesqhrpcmrthrquqpq.supabase.co/**', r => { const q = r.request();
    if (process.env.TRACE && q.method() === 'POST' && /nf_reports/.test(q.url())) fs.appendFileSync(process.env.TRACE, q.postData() + '\n');   // (the tracking device's reports, kept for the check)
    r.fulfill({ json:[] }); });
};
async function run(name) {
  const c = CLIPS[name], t0 = Date.now(), sf = `${G}/${name}.scan.json`, ff = `${G}/${name}.follow.json`;
  const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required', '--js-flags=--max-old-space-size=4096'] }); const pg = await b.newPage({ viewport:{ width:390, height:844 } });
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 200))); pg.on('console', m => { if (m.type() === 'warning' && /faceres/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  await routes(pg); await pg.goto('http://127.0.0.1:8765/' + PAGE); await pg.waitForFunction(() => window.__nf);
  const T = { noLike:true, noAV:!!process.env.NOAV, part:'whole', noFR:!!process.env.NOFR, frJoin:+process.env.FRJOIN || 0, frDoubt:+process.env.FRDOUBT || 0, seek:!!process.env.SEEK, noDiar:!!process.env.NODIAR }; if (!FRESH && fs.existsSync(sf)) T.scanIn = JSON.parse(fs.readFileSync(sf)); if (!FRESH && fs.existsSync(ff)) T.followIn = JSON.parse(fs.readFileSync(ff)); { const vf = `${process.env.VOICES || G}/${name}.voice.json`; if (!process.env.NOVOICEIN && fs.existsSync(vf)) T.voiceIn = JSON.parse(fs.readFileSync(vf)); } if (process.env.NOVOICE) T.noVoice = true; { const cf = `${G}/${name}.cues.json`; if (fs.existsSync(cf) && !process.env.FRESHCUES) T.cuesIn = JSON.parse(fs.readFileSync(cf)); else if (!process.env.RENDER || process.env.NOLIPSYNC) T.noLipSync = true; }   // (lip sync: saved once, only made for a made video)
  await pg.evaluate(T => { window.__T = T; }, T);
  if (process.env.DBGT) await pg.evaluate(() => { window.__vm.dbgT = []; });
  if (process.env.SND) await pg.evaluate(() => { window.__soundDbg = []; });
  if (process.env.PROG) await pg.evaluate(() => { window.__prog = []; const ob = new MutationObserver(() => { const e = document.getElementById('vmProg'), m = document.getElementById('vmMsg'); if (e) window.__prog.push([e.style.width, m ? m.textContent : '']); }); ob.observe(document.body, { attributes:true, subtree:true, attributeFilter:['style'], childList:true, characterData:true }); });
  let tick = null; if (process.env.LOG) { pg.on('console', m => console.log('[c]', m.type(), m.text().slice(0, 300))); pg.on('pageerror', e => console.log('[err]', String(e).slice(0, 400))); tick = setInterval(async () => { try { console.log('[msg]', Math.round((Date.now() - t0) / 1000), await pg.evaluate(() => (document.getElementById('vmMsg') || {}).textContent)); } catch {} }, 20000); }
  if (process.env.HIDE) await pg.evaluate(() => { let vis = 'visible'; Object.defineProperty(document, 'visibilityState', { get:() => vis }); Object.defineProperty(document, 'hidden', { get:() => vis !== 'visible' });
    window.__hide = ms => { vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); const v = window.__vm.grabV || document.querySelector('video'); setTimeout(() => { vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); }, ms); }; });
  await pg.click('#vidBtn'); await pg.setInputFiles('#vmFile', `${S}/${c.file}`);
  if (process.env.HIDE) { const hid = setInterval(async () => { try { const w = await pg.evaluate(() => parseFloat((document.getElementById('vmProg') || {}).style?.width || '0')); if (w > 15) { clearInterval(hid); await pg.evaluate(ms => window.__hide(ms), +process.env.HIDE); console.log('hidden at', w + '%'); } } catch (e) {} }, 500); }
  await pg.waitForSelector('#edMake', { timeout:+process.env.TMO || 1800000 }).finally(() => tick && clearInterval(tick));
  if (process.env.VOICED) { const d = await pg.evaluate(() => ({ old:window.__nf.voicedTrack(true), now:window.__nf.voicedTrack(false) })); fs.writeFileSync(`${G}/${name}.voiced.json`, JSON.stringify(d)); }
  if (process.env.BGTEST) { await pg.click('[data-tab="look"]'); await pg.waitForSelector('#vmBg');
    const fc = pg.waitForEvent('filechooser'); await pg.selectOption('#vmBg', '+add'); const ch = await fc; await ch.setFiles(process.env.BGTEST);
    await pg.waitForSelector('#bgAdd'); await pg.screenshot({ path:`${G}/bgtest1.png` }); await pg.fill('#bgName', 'Test room'); await pg.uncheck('#bgShare'); await pg.click('#bgAdd'); await pg.waitForTimeout(800);
    console.log('BGTEST', JSON.stringify(await pg.evaluate(() => ({ bg:window.__vm.bg, sel:document.getElementById('vmBg') && document.getElementById('vmBg').value, opts:[...document.querySelectorAll('#vmBg option')].map(o => o.value).slice(-3) }))));
    await pg.screenshot({ path:`${G}/bgtest2.png` }); }
  if (process.env.SHOT) {   // (the editor as it looks: People, then Timing with the second row picked)
    const sh = async n => { await pg.waitForTimeout(700); await pg.screenshot({ path:`${process.env.SHOT}_${name}_${n}.png` }); };
    await pg.evaluate(() => { const c = document.querySelector('.vm-card'); if (c) c.scrollTo(0, 0); }); await sh('people');
    await pg.evaluate(() => { const c = document.querySelector('.vm-card'); if (c) c.scrollTo(0, 2000); }); await sh('people2');
    await pg.click('.vm-tabs button[data-tab="timing"]'); await sh('timing');
    const hs = await pg.$$('.ed-head'); if (hs[1]) { await hs[1].click(); await sh('timing_pick'); } }
  if (process.env.RENDER) { await pg.waitForTimeout(2500); await pg.evaluate(() => { window.__mlog = []; }); await pg.click('#edMake'); await pg.waitForFunction(() => window.__vm.rendering, null, { timeout:120000 });
    await pg.waitForFunction(() => !window.__vm.rendering, null, { timeout:1200000 });
    // (the made video itself, saved as GEAUX gets it, for the review: tools/test/review.sh makes contact sheets of it)
    try { await pg.waitForSelector('video.vm-out', { timeout:20000 }); const b64 = await pg.evaluate(async () => { const v = document.querySelector('video.vm-out'), bl = await (await fetch(v.src)).blob(); return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(bl); }); });
      fs.writeFileSync(`${G}/${name}.made.webm`, Buffer.from(b64, 'base64')); } catch (e) { console.log('made video not saved', String(e).slice(0, 120)); }
    fs.writeFileSync(`${G}/${name}.mlog.json`, JSON.stringify(await pg.evaluate(() => ({ log:window.__mlog, cast:window.__vm.cast, lines:window.__vm.lines.map(l => [l.t0, l.t1, l.who]) })))); }
  const mouth = await pg.evaluate(() => window.__nf.voicedTrack ? { now:window.__nf.voicedTrack(false, true), off:window.__nf.voicedTrack(true, true) } : null).catch(() => null);
  if (process.env.PROG) { const pr = await pg.evaluate(() => window.__prog); const seq = []; for (const [w, m] of pr) { if (!seq.length || seq[seq.length - 1][0] !== w || seq[seq.length - 1][1] !== m) seq.push([w, m]); } console.log(JSON.stringify(seq.filter((x, i) => i % Math.max(1, Math.floor(seq.length / 40)) === 0 || i === seq.length - 1))); }
  if (process.env.SND) { const d = await pg.evaluate(() => { const E = window.__vm.env, T = E.vt; return { snd:window.__soundDbg, e:Array.from(T.e, x => +x.toFixed(5)), thr:T.thr, loud:T.loud, pitch:E.pitch ? Array.from(E.pitch) : null, nov:E.nov ? Array.from(E.nov) : null }; }); fs.writeFileSync(`${G}/${name}.env.json`, JSON.stringify(d)); }
  const r = await pg.evaluate(() => { const V = window.__vm; return { people:V.people.map(p => ({ fem:p.feat ? p.feat.fem : null, cast:V.cast[V.people.indexOf(p)], t0:+p.t0.toFixed(1), t1:+p.t1.toFixed(1), n:p.n, lipOk:p.lipOk, off:!!p.off, pts:(p.smp || []).filter((x, i, a) => i % Math.max(1, Math.floor(a.length / 5)) === 0).slice(0, 6).map(x => [+x.t.toFixed(2), +x.cx.toFixed(2)]) })),
    lines:V.lines.map(l => [+l.t0.toFixed(1), +l.t1.toFixed(1), l.who, l.show || 'solo']), back:(V.back || []).map(x => [x.t0, x.t1]), crowd:V.crowd && V.crowd.n, sing:V.sing, group:V.group, who:V.whoDbg, av:V.avDbg, err:V.err || null, found:(V.found || []).length, fr:!!V.frUsed, voice:V.voiceDbg || null, diar:V.diarDbg || null, tl:(() => { const T = V.timeline || [], R = []; T.forEach((w, k) => { const r = R[R.length - 1]; if (r && r[2] === w) r[1] = +((k + 1) * 0.05).toFixed(2); else R.push([+(k * 0.05).toFixed(2), +((k + 1) * 0.05).toFixed(2), w]); }); return R; })(), still:V.stillDbg || null, vmem:V.voiceMem, diag:V.diag ? { looks:V.diag.looks, same:V.diag.same, miss:V.diag.miss, mode:V.diag.mode, fill:V.diag.fill, rates:V.diag.rates, p:V.diag.p } : null }; });
  if (process.env.DBGT) { const [a, z] = process.env.DBGT.split(',').map(Number); r.dbgT = await pg.evaluate(([a, z]) => (window.__vm.dbgT || []).filter(x => x[0] >= a && x[0] <= z), [a, z]); }
  { const vo = await pg.evaluate(() => window.__T.voiceOut ? JSON.stringify(window.__T.voiceOut) : null); if (vo) fs.writeFileSync(`${G}/${name}.voice.json`, vo); }
  { const co = await pg.evaluate(() => window.__T.cuesOut && !window.__T.cuesIn ? JSON.stringify(window.__T.cuesOut) : null); if (co) fs.writeFileSync(`${G}/${name}.cues.json`, co); }
  const saved = await pg.evaluate(() => ({ scan:window.__T.scan && !window.__T.scanIn ? JSON.stringify(window.__T.scan) : null, follow:window.__T.follow ? JSON.stringify(window.__T.follow) : null }));
  if (saved.scan) fs.writeFileSync(sf, saved.scan); if (saved.follow) fs.writeFileSync(ff, saved.follow);
  await b.close();
  r.mouth = mouth ? (process.env.MOUTHOFF ? mouth.off : mouth.now) : null; r.mouthOff = mouth ? mouth.off : null;
  if (process.env.RENDER) { const ml = JSON.parse(fs.readFileSync(`${G}/${name}.mlog.json`)).log, n = ml.length; let op = 0, bad = 0, ah = 0;
    ml.forEach((x, i) => { if ([0, 1, 9].includes(x[2])) return; op++; if (x[2] === 3) ah++; let near = false; for (let j = Math.max(0, i - 6); j < Math.min(n, i + 7); j++) if (ml[j][6]) near = true; if (!near) bad++; });
    const teeth = ml.filter(x => x[2] === 4).length, early = ml.filter(x => x[0] < 1.3 && ![0, 1, 9].includes(x[2])).length;
    r.render = { open:op, noVoice:bad, ah, teeth, early }; }
  // (every clip: nobody is on screen for a flash, under 0.4 s, between two others: problems.md P6)
  const flash = (r.tl || []).filter((x, i, a) => i > 0 && i < a.length - 1 && x[1] - x[0] < 0.4);
  c.checks0 = c.checks0 || c.checks; c.checks = rr => [...c.checks0(rr), ['no one on screen for a flash (under 0.4 s)' + (flash.length ? ': ' + JSON.stringify(flash) : ''), !flash.length]];
  const res0 = c.checks(r), res = process.env.RENDER ? [...res0,
    ...(name === 'sitcom' ? [['made video: the full-teeth grin under 8% of open frames (' + r.render.teeth + '/' + r.render.open + ')', r.render.teeth <= 0.08 * r.render.open],
      ['made video: the opening music (0–1.3 s) moves no mouth (' + r.render.early + ' open frames)', r.render.early <= 3]] : []), ['made video: a mouth open with no voice near it: under 3% of open frames (' + r.render.noVoice + '/' + r.render.open + ')', r.render.noVoice <= 0.03 * r.render.open],
    ...(r.sing ? [] : [['made video: the wide AH is under 30% of open frames when talking, not shouting all the time (' + r.render.ah + ')', r.render.ah <= 0.3 * r.render.open]])] : res0;
  const secs = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(`${G}/${name}${process.env.NOAV ? ".noav" : ""}.result.json`, JSON.stringify(r));
  return { name, secs, res, r, cached:!!T.scanIn, refollowed:!!saved.follow && !!T.followIn, errs };
}
const HELD = ['office1', 'office2', 'sunny', 'final', 'frank'];   // (the held-out clips run only when named: they have their own reading set)
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPS).filter(n => !HELD.includes(n)), out = [];
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
