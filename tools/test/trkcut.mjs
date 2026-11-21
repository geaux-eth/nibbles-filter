// The tracking device, a run cut short: start a read, reload the page half way (as Safari does when it runs out of
// memory), and check the next load sends the unfinished record (with what had happened up to the reload).
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import { serve } from '../serve2.mjs';
const S = '/tmp/claude-0/-home-claude/983647b0-485b-5cec-a0d0-3276a7c1b795/scratchpad', PAGE = process.env.PAGE || 'beta/index.html';
const b = await chromium.launch(), pg = await b.newPage(), sent = [];
await serve(pg);
await pg.route('https://jmiesqhrpcmrthrquqpq.supabase.co/**', r => { const q = r.request(); if (q.method() === 'POST' && /nf_reports/.test(q.url())) sent.push(JSON.parse(q.postData())); r.fulfill({ json:[] }); });
await pg.route(/cdn\.jsdelivr\.net|storage\.googleapis|cloudfront/, r => {});   // (models never arrive: the read stays busy, like a phone part way through)
await pg.goto('http://127.0.0.1:8765/' + PAGE); await pg.waitForFunction(() => window.__nf);
await pg.click('#vidBtn'); await pg.setInputFiles('#vmFile', `${S}/wk/r10.mp4`);
await pg.waitForTimeout(6000);
const mid = await pg.evaluate(() => { try { return localStorage.getItem('nfTrace'); } catch (e) { return 'err ' + e; } });
await pg.reload(); await pg.waitForFunction(() => window.__nf); await pg.waitForTimeout(1500);
const cut = sent.find(s => /cut short/.test(s.note));
const ok = [
  ['kept on the phone while reading', !!mid && /"state":"unfinished"/.test(mid)],
  ['sent on the next load, marked cut short', !!cut],
  ['the record holds what happened before the reload (the start and a message)', !!cut && cut.data.ev.some(e => e[1] === 'start') && cut.data.ev.some(e => e[1] === 'msg')],
  ['for the debug site', !!cut && cut.page === 'beta'],
  ['sent once, then cleared', sent.filter(s => /cut short/.test(s.note)).length === 1 && !(await pg.evaluate(() => localStorage.getItem('nfTrace')))]];
for (const [k, v] of ok) console.log(v ? 'PASS' : 'FAIL', k);
if (cut) console.log('events kept:', cut.data.ev.length, JSON.stringify(cut.data.ev.slice(0, 8)));
await b.close();
