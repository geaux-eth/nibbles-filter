// Downloads every Nibble picture from the collection's image server and writes:
//  thumbs/<id>.webp     160 px, for the filter's collection browser (main branch)
//  research/...         384 px samples of every kind x skin / mouth / eyes / accessory, plus every special (research branch)
import fs from 'fs';
import sharp from 'sharp';
const T = JSON.parse(fs.readFileSync('data/traits.json', 'utf8'));
const IMG = id => `https://d24r2edyfve7yo.cloudfront.net/nibbles/images/${id}.png`;
const ONLY = (process.env.IDS || '').trim() ? process.env.IDS.split(',').map(Number) : null;
const SPECIAL = new Set(['Red', 'Wrestler', 'Plush', 'Seawoman', 'Werewolf', 'Mage', 'Alien', 'Human', 'Metal', 'Dissection', 'Slime', 'Dragon', 'Fire', 'Mummy']);
// pick research samples: first 2 tokens of each kind x skin, first of each kind x mouth / eyes / accessory / outfit, every special
const want = new Map(), seen = new Map(), slug = s => String(s).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
const pick = (key, id, n = 1) => { const c = seen.get(key) || 0; if (c < n) { seen.set(key, c + 1); if (!want.has(id)) want.set(id, []); want.get(id).push(key); } };
for (const [id, v] of Object.entries(T)) { const a = v.a, k = a.Character;
  if (SPECIAL.has(a.Skin)) { pick(`${k}/special_${slug(a.Skin)}_${id}`, id); continue; }
  pick(`${k}/skin_${slug(a.Skin)}`, id, 2); pick(`${k}/mouth_${slug(a.Mouth)}`, id); pick(`${k}/eyes_${slug(a.Eyes)}`, id);
  pick(`${k}/acc_${slug(a.Accessory)}`, id); pick(`${k}/outfit_${slug(a.Outfit)}`, id); }
fs.mkdirSync('thumbs', { recursive:true });
const ids = ONLY || Object.keys(T).map(Number);
let next = 0, done = 0, bytes = 0, fails = [], size = null;
async function worker() {
  while (next < ids.length) { const id = ids[next++];
    for (let k = 0; k < 4; k++) {
      try { const r = await fetch(IMG(id)); if (!r.ok) throw new Error(r.status); const buf = Buffer.from(await r.arrayBuffer()); bytes += buf.length;
        const img = sharp(buf); if (!size) size = await img.metadata();
        await img.clone().resize(160, 160).webp({ quality:72 }).toFile(`thumbs/${id}.webp`);
        for (const key of want.get(String(id)) || []) { const f = `research/${key}_${id}.webp`.replace(/_(\d+)_\1\.webp$/, '_$1.webp'); fs.mkdirSync(f.slice(0, f.lastIndexOf('/')), { recursive:true }); await img.clone().resize(384, 384).webp({ quality:82 }).toFile(f); }
        done++; break;
      } catch (e) { if (k === 3) fails.push(id); await new Promise(r => setTimeout(r, 600 * (k + 1))); }
    }
  }
}
await Promise.all(Array.from({ length:16 }, worker));
console.log('done', done, 'failed', fails.length, fails.slice(0, 30).join(','), 'source MB', (bytes / 1e6).toFixed(0), 'size', size && `${size.width}x${size.height} ${size.format}`);
