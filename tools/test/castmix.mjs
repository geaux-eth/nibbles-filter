// The automatic picks for a sitcom's four people (three men, one woman): how often two get the same kind, and how often
// a pick has a big mouth of its own (not a smile or frown). 8 rounds.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import { serve } from '../serve2.mjs';
const b = await chromium.launch(); const pg = await b.newPage(); await serve(pg);
await pg.route('https://d24r2edyfve7yo.cloudfront.net/**', r => r.fulfill({ path:'/tmp/claude-0/-home-claude/983647b0-485b-5cec-a0d0-3276a7c1b795/scratchpad/research/full/553.png', contentType:'image/png', headers:{ 'access-control-allow-origin':'*' } }));
await pg.route(/supabase|jsdelivr|googleapis/, r => r.fulfill({ json:[] }));
await pg.goto('http://127.0.0.1:8765/' + (process.env.PAGE || 'beta/index.html')); await pg.waitForFunction(() => window.__nf && window.__nf.ready, null, { timeout:120000 });
const t = JSON.parse(fs.readFileSync('/home/claude/nibbles-filter/data/traits.json'));
let dup = 0, big = 0, n = 0, girlBad = 0;
const men = { skin:0.5, glass:false, hat:false, fem:0.15 }, woman = { skin:0.5, glass:false, hat:false, fem:0.63 };
for (let r = 0; r < 8; r++) {
  const like = await pg.evaluate(fs => window.__nf.lookalikes(fs), [men, men, woman, men]);
  const ids = Object.values(like), kinds = ids.map(id => t[id].a.Character), mouths = ids.map(id => t[id].a.Mouth);
  if (new Set(kinds).size < kinds.length) dup++; big += mouths.filter(m => !['Smile', 'Frown'].includes(m)).length; n += ids.length;
  console.log(ids.map((id, i) => `${kinds[i]}/${mouths[i]}`).join('  '));
}
console.log(`rounds with two of one kind: ${dup}/8; picks with a big mouth of their own: ${big}/${n}`);
await b.close();
