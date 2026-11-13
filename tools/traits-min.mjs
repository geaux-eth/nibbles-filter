// data/traits.json -> data/traits-min.json, the small copy the filter loads:
// { k:[trait names], v:[[values of each trait]], t:[[value index per trait, -1 if none] for tokens 1..8888] }
import fs from 'fs';
const all = JSON.parse(fs.readFileSync('data/traits.json', 'utf8')), k = [], v = [], t = [];
for (const x of Object.values(all)) for (const key of Object.keys(x.a)) if (!k.includes(key)) k.push(key);
k.sort(); k.forEach(() => v.push([]));
for (let id = 1; id <= 8888; id++) {
  const x = all[id]; if (!x) { t.push(null); continue; }
  t.push(k.map((key, j) => { const val = x.a[key]; if (val == null) return -1; const s = [].concat(val).join(' + '); let i = v[j].indexOf(s); if (i < 0) { i = v[j].length; v[j].push(s); } return i; }));
}
fs.writeFileSync('data/traits-min.json', JSON.stringify({ k, v, t }));
console.log('traits-min', fs.statSync('data/traits-min.json').size, 'bytes');
