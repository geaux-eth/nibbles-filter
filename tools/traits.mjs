// Builds data/traits.json: every Nibble's traits from its on-chain tokenURI (Franky's metadata server).
// Run by .github/workflows/traits.yml (GitHub's runners can reach the server; nothing secret is used).
import fs from 'fs';
const BASE = 'https://frankymetadataserver-production.up.railway.app/nibble/metadata/';
const ids = (process.env.IDS || '').trim() ? process.env.IDS.split(',').map(Number) : Array.from({ length:8888 }, (_, i) => i + 1);
const out = {}, fails = []; let sample = null;
async function get(id) {
  for (let k = 0; k < 4; k++) {
    try { const r = await fetch(BASE + id, { headers:{ accept:'application/json' } }); if (r.ok) return await r.json(); if (r.status === 404) return null; }
    catch (e) {}
    await new Promise(r => setTimeout(r, 800 * (k + 1)));
  }
  throw new Error('failed ' + id);
}
let next = 0;
async function worker() {
  while (next < ids.length) {
    const id = ids[next++];
    try { const j = await get(id); if (!j) { fails.push(id); continue; } if (!sample) sample = j;
      const a = {}; for (const t of j.attributes || []) { const k = t.trait_type ?? t.type ?? 'trait'; a[k] = a[k] ? [].concat(a[k], t.value) : t.value; }
      out[id] = { n:j.name || '', a }; }
    catch (e) { fails.push(id); }
  }
}
await Promise.all(Array.from({ length:12 }, worker));
const sorted = Object.fromEntries(Object.keys(out).map(Number).sort((a, b) => a - b).map(k => [k, out[k]]));
fs.mkdirSync('data', { recursive:true });
fs.writeFileSync('data/traits.json', JSON.stringify(sorted));
fs.writeFileSync('data/traits-sample.json', JSON.stringify(sample, null, 2));
// a count of every trait value, to see the vocabulary at a glance
const tally = {}; for (const v of Object.values(sorted)) for (const [k, x] of Object.entries(v.a)) for (const y of [].concat(x)) { tally[k] ??= {}; tally[k][y] = (tally[k][y] || 0) + 1; }
fs.writeFileSync('data/traits-tally.json', JSON.stringify(tally, null, 1));
console.log('got', Object.keys(sorted).length, 'failed', fails.length, fails.slice(0, 40).join(','));
