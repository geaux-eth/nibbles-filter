// Kit engine: makes any Nibble talk from its own picture plus its kind's talking kit.
// Every Nibble of a kind is drawn in the same pose at the same spot, so a reference Nibble's 10 mouths and blink
// line up on all of them. The kit is recoloured to this Nibble's skin by comparing the two pictures at the same
// spots (outside the mouth), and only the pixels that really change are taken from the kit.

const N = 1000;
const cv = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
const data = img => { const c = cv(), g = c.getContext('2d', { willReadFrequently:true }); g.drawImage(img, 0, 0, N, N); return g.getImageData(0, 0, N, N).data; };
const bin = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
const dist = (a, i, b, j) => Math.abs(a[i] - b[j]) + Math.abs(a[i + 1] - b[j + 1]) + Math.abs(a[i + 2] - b[j + 2]);
const lum = (d, i) => d[i] + d[i + 1] + d[i + 2];

// colour palettes as a 32x32x32 grid of 5-bit colours, widened by r steps so near shades count too
function palette(count, min, r) {
  const o = new Uint8Array(32768);
  for (let k = 0; k < 32768; k++) { if (count[k] < min) continue; const R = k >> 10, G = (k >> 5) & 31, B = k & 31;
    for (let a = Math.max(0, R - r); a <= Math.min(31, R + r); a++) for (let b = Math.max(0, G - r); b <= Math.min(31, G + r); b++) for (let c = Math.max(0, B - r); c <= Math.min(31, B + r); c++) o[(a << 10) | (b << 5) | c] = 1; }
  return o;
}
const inPal = (P, r, g, b) => P[bin(Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b)))] === 1;

function grow(m, r) {   // square dilate
  const t = new Uint8Array(N * N), o = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) { let c = 0; const row = y * N; for (let x = 0; x < Math.min(r, N); x++) c += m[row + x];
    for (let x = 0; x < N; x++) { if (x + r < N) c += m[row + x + r]; if (x - r - 1 >= 0) c -= m[row + x - r - 1]; t[row + x] = c > 0 ? 1 : 0; } }
  for (let x = 0; x < N; x++) { let c = 0; for (let y = 0; y < Math.min(r, N); y++) c += t[y * N + x];
    for (let y = 0; y < N; y++) { if (y + r < N) c += t[(y + r) * N + x]; if (y - r - 1 >= 0) c -= t[(y - r - 1) * N + x]; o[y * N + x] = c > 0 ? 1 : 0; } }
  return o;
}
function soft(m, px = 1.5) {   // mask -> blurred alpha 0..1
  const c = cv(), g = c.getContext('2d', { willReadFrequently:true }), id = g.createImageData(N, N);
  for (let i = 0; i < N * N; i++) id.data[i * 4 + 3] = m[i] ? 255 : 0;
  g.putImageData(id, 0, 0); const b = cv(), bg = b.getContext('2d', { willReadFrequently:true }); bg.filter = `blur(${px}px)`; bg.drawImage(c, 0, 0);
  const d = bg.getImageData(0, 0, N, N).data, a = new Float32Array(N * N); for (let i = 0; i < N * N; i++) a[i] = Math.min(m[i] ? 1 : 0.999, d[i * 4 + 3] / 255); return a;
}

function unfleck(D) {
  const dk = new Uint8Array(N * N); for (let p = 0; p < N * N; p++) { const i = p * 4; if (D[i + 3] > 128 && D[i] + D[i + 1] + D[i + 2] < 140) dk[p] = 1; }
  const big = blobs(dk, 40);
  for (let p = 0; p < N * N; p++) { if (!dk[p] || big[p]) continue; const x = p % N, y = (p / N) | 0; let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const q = yy * N + xx; if (dk[q]) continue; const j = q * 4; r += D[j]; g += D[j + 1]; b += D[j + 2]; n++; }
    if (n) { const i = p * 4; D[i] = r / n; D[i + 1] = g / n; D[i + 2] = b / n; } }
}
// pixels set in m, minus specks smaller than min
function blobs(m, min) {
  const lab = new Int32Array(N * N), q = new Int32Array(N * N), out = new Uint8Array(N * N); let id = 0;
  for (let s = 0; s < N * N; s++) { if (!m[s] || lab[s]) continue; id++; let h = 0, t = 0; q[t++] = s; lab[s] = id;
    while (h < t) { const p = q[h++], x = p % N; for (const r of [x > 0 ? p - 1 : -1, x < N - 1 ? p + 1 : -1, p - N, p + N]) if (r >= 0 && r < N * N && m[r] && !lab[r]) { lab[r] = id; q[t++] = r; } }
    if (t >= min) for (let k = 0; k < t; k++) out[q[k]] = 1; }
  return out;
}
function fillHoles(m) {
  const seen = new Uint8Array(N * N), q = new Int32Array(N * N); let h = 0, t = 0;
  const push = p => { if (!m[p] && !seen[p]) { seen[p] = 1; q[t++] = p; } };
  for (let x = 0; x < N; x++) { push(x); push((N - 1) * N + x); } for (let y = 0; y < N; y++) { push(y * N); push(y * N + N - 1); }
  while (h < t) { const p = q[h++], x = p % N; if (x > 0) push(p - 1); if (x < N - 1) push(p + 1); if (p >= N) push(p - N); if (p < N * N - N) push(p + N); }
  return m.map((v, p) => v || !seen[p] ? 1 : 0);
}
function shrink(m, r) { const inv = m.map(v => v ? 0 : 1), g = grow(inv, r); return g.map(v => v ? 0 : 1); }

// fill the hole from the picture's own pixels around it, ring by ring (only from pixels this mouth leaves alone);
// ink lines barely count, so a fill takes the colour of the clothes, not of their outlines
function inpaint(T, hole, busy) {
  const out = new Map(), F = new Float32Array(N * N * 4), st = new Uint8Array(N * N);   // st: 0 unknown, 1 known source, 2 filled
  let front = [];
  for (let p = 0; p < N * N; p++) { if (hole[p]) { front.push(p); continue; } if (busy[p] || T[p * 4 + 3] <= 200) continue;
    const i = p * 4, w = T[i] + T[i + 1] + T[i + 2] < 200 ? 0.08 : 1; F[i] = T[i]; F[i + 1] = T[i + 1]; F[i + 2] = T[i + 2]; F[i + 3] = w; st[p] = 1; }
  if (!front.length) return out;
  for (let pass = 0; pass < 500 && front.length; pass++) {
    const next = [], add = [];
    for (const p of front) { const x = p % N; let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const xx = x + dx, q = p + dy * N + dx;
        if (xx < 0 || xx >= N || q < 0 || q >= N * N || !st[q]) continue; const j = q * 4, w = F[j + 3]; r += F[j] * w; g += F[j + 1] * w; b += F[j + 2] * w; n += w; }
      if (n >= 0.9) add.push(p, r / n, g / n, b / n, Math.min(1, n / 3)); else next.push(p); }
    if (!add.length) break;
    for (let k = 0; k < add.length; k += 5) { const p = add[k], j = p * 4; F[j] = add[k + 1]; F[j + 1] = add[k + 2]; F[j + 2] = add[k + 3]; F[j + 3] = add[k + 4]; st[p] = 2; }
    front = next;
  }
  for (let p = 0; p < N * N; p++) if (st[p] === 2) { const j = p * 4; out.set(p, [Math.round(F[j]), Math.round(F[j + 1]), Math.round(F[j + 2])]); }
  return out;
}

// colour map from the reference's colours to this Nibble's, learned where both show the same body part
function colourMap(R, T, where, okT) {
  // per reference colour: the median of this Nibble's colours at the same spots, kept only when they agree
  const lists = new Map();
  for (let p = 0; p < N * N; p++) { if (!where[p]) continue; const i = p * 4;
    if (R[i + 3] < 220 || T[i + 3] < 220 || lum(R, i) < 75 || lum(T, i) < 75) continue;   // skip ink and see-through
    const k = bin(R[i], R[i + 1], R[i + 2]); let l = lists.get(k); if (!l) lists.set(k, l = []);
    l.push(p); }
  const known = [], rejected = [];
  const med = a => { a.sort((x, y) => x - y); return a[a.length >> 1]; };
  for (let [k, ps] of lists) { if (ps.length < 12) continue;
    if (ps.length > 4000) { const st = ps.length / 4000; ps = Array.from({ length:4000 }, (_, j) => ps[Math.floor(j * st)]); }   // spread over the whole area, not just its top
    const tr = med(ps.map(p => T[p * 4])), tg = med(ps.map(p => T[p * 4 + 1])), tb = med(ps.map(p => T[p * 4 + 2]));
    let agree = 0; for (const p of ps) { const i = p * 4; if (Math.abs(T[i] - tr) + Math.abs(T[i + 1] - tg) + Math.abs(T[i + 2] - tb) < 60) agree++; }
    if (agree < ps.length * 0.6) continue;   // this colour lands on different things in this Nibble (clothes, glasses): not skin to copy
    if (okT && !okT(tr, tg, tb, R[ps[0] * 4], R[ps[0] * 4 + 1], R[ps[0] * 4 + 2])) { rejected.push([tr, tg, tb, ps.length]); continue; }   // it lands on this Nibble's hat, clothes or background, not its skin
    const r = med(ps.map(p => R[p * 4])), g = med(ps.map(p => R[p * 4 + 1])), b = med(ps.map(p => R[p * 4 + 2]));
    known.push({ r, g, b, tr, tg, tb, n:ps.length, at:ps[ps.length >> 1] }); }
  colourMap.last = { known, rejected };
  const cache = new Map();
  return (r, g, b) => {
    const k = bin(r, g, b); let m = cache.get(k);
    if (m === undefined) { m = null; let best = 46;
      // the nearest known colour, with its shift blended with the other near ones, so neighbouring shades don't jump
      for (const c of known) { const d = Math.abs(c.r - r) + Math.abs(c.g - g) + Math.abs(c.b - b); if (d < best) { best = d; m = c; } }
      if (m) { let w = 0, dr = 0, dg = 0, db = 0; const r0 = ((r >> 3) << 3) + 4, g0 = ((g >> 3) << 3) + 4, b0 = ((b >> 3) << 3) + 4;
        for (const c of known) { const d = Math.abs(c.r - r0) + Math.abs(c.g - g0) + Math.abs(c.b - b0); if (d > best + 30) continue; const q = 1 / ((d + 6) * (d + 6));
          w += q; dr += (c.tr - c.r) * q; dg += (c.tg - c.g) * q; db += (c.tb - c.b) * q; }
        m = { r:0, g:0, b:0, tr:dr / w, tg:dg / w, tb:db / w, d:best }; }
      cache.set(k, m); }
    // a darker shade of a main skin colour (Gemini often draws the fur darker, and outlines fade into it): the same
    // shade of this Nibble's colour. Checked first for anything that isn't ink, since a dark detail colour can look alike.
    let bd = null, bs = 0, be = r + g + b >= 80 ? 22 : 40;
    for (const c of known) { if (c.r + c.g + c.b < 150) continue; const s0 = (r + g + b) / Math.max(1, c.r + c.g + c.b); if (s0 < 0.12 || s0 > 1.05) continue;
      const e = Math.abs(r - s0 * c.r) + Math.abs(g - s0 * c.g) + Math.abs(b - s0 * c.b); if (e < be) { be = e; bd = c; bs = s0; } }
    const shade = bd ? [bd.tr * bs, bd.tg * bs, bd.tb * bs].map(v => Math.max(0, Math.min(255, Math.round(v)))) : null;
    if (m && (!shade || m.d < 12)) return [m.tr + (r - m.r), m.tg + (g - m.g), m.tb + (b - m.b)].map(v => Math.max(0, Math.min(255, Math.round(v))));
    return shade || (m ? [m.tr + (r - m.r), m.tg + (g - m.g), m.tb + (b - m.b)].map(v => Math.max(0, Math.min(255, Math.round(v)))) : null);
  };
}

// T: this Nibble's picture (background cut, 1000 px). ref: { base, mouths[10], eyes[5] } of the kind's reference.
// Returns { frames[10], eyes[5], mouthBox, eyeBox } in the builder's format.
export function fromKit(Timg, ref, { blink = true, dbg = null, wideFace = false, loopBody = false, front = false } = {}) {
  const T = data(Timg), R = data(ref.base), K = ref.mouths.map(data);
  // Gemini's panels have small dark flecks in the fur: a dark spot too small to be part of a line takes the colour around it
  for (let k = 1; k < 10; k++) unfleck(K[k]);
  if (ref.eyes) ref._E = ref.eyes.map(e => e ? data(e) : null);
  // the mouth zone: where any reference mouth differs from the reference picture
  // (changed in at least 2 of the 9 mouths, so stray specks don't count)
  const hits = new Uint8Array(N * N), Z = new Uint8Array(N * N);
  for (let k = 1; k < 10; k++) { const D = K[k]; for (let p = 0; p < N * N; p++) { const i = p * 4; if (Math.abs(D[i + 3] - R[i + 3]) > 60 || dist(D, i, R, i) > 60) hits[p]++; } }
  { const keep = blobs(hits, 60); for (let p = 0; p < N * N; p++) Z[p] = keep[p]; }
  const Zd = grow(Z, 8), ring = grow(Zd, 46);
  for (let p = 0; p < N * N; p++) if (Zd[p]) ring[p] = 0;
  // and around the eyes (the blink layers): the fur there can differ from the snout's
  const EZ = new Uint8Array(N * N); let eyeRing = null;
  if (ref.eyes && ref.eyes[4]) { for (const k of [3, 4]) { const E = data(ref.eyes[k]); for (let p = 0; p < N * N; p++) if (E[p * 4 + 3] > 20) EZ[p] = 1; }
    eyeRing = grow(EZ, 34); for (let p = 0; p < N * N; p++) if (EZ[p] || Zd[p]) eyeRing[p] = 0; }
  // the reference's face colours (fur, snout, cheeks): the commonest colours just above the mouth
  let zy = 0, zn = 0; for (let p = 0; p < N * N; p++) if (Z[p]) { zy += (p / N) | 0; zn++; } zy = zn ? zy / zn : N / 2;
  const skinOf = (where, above) => { const cnt = new Map(); let tot = 0;
    for (let p = 0; p < N * N; p++) { if (!where[p] || (above && ((p / N) | 0) > zy)) continue; const i = p * 4; if (R[i + 3] < 220 || lum(R, i) < 75) continue; const k = bin(R[i], R[i + 1], R[i + 2]); cnt.set(k, (cnt.get(k) || 0) + 1); tot++; }
    return [...cnt].filter(([, n]) => n > tot * 0.02).sort((a, b) => b[1] - a[1]).map(([k]) => k); };   // commonest first
  const snout = skinOf(ring, true), eyeSkin = eyeRing ? skinOf(eyeRing, false) : [];
  const nearK = (list, r0, g0, b0) => { for (const k of list) { const r = (k >> 10) << 3, g = ((k >> 5) & 31) << 3, b = (k & 31) << 3; if (Math.abs(r0 - r - 4) + Math.abs(g0 - g - 4) + Math.abs(b0 - b - 4) < 42) return true; } return false; };
  // the mouth's own colours (inside, tongue, teeth): what the kit draws where the reference shows snout skin
  const mc = new Uint32Array(32768), body = new Uint32Array(32768);   // body: the reference's own colours at its mouth (chin, lips)
  for (let p = 0; p < N * N; p++) { if (!Zd[p] && !ring[p]) continue; const i = p * 4; if (R[i + 3] > 200 && lum(R, i) >= 75) body[bin(R[i], R[i + 1], R[i + 2])]++; }
  const bodyP = palette(body, 150, 1);
  for (let k = 1; k < 10; k++) { const D = K[k]; for (let p = 0; p < N * N; p++) { if (!Zd[p]) continue; const i = p * 4;
    if (R[i + 3] < 200 || D[i + 3] < 200 || !Z[p] || dist(D, i, R, i) < 60) continue; if (!inPal(bodyP, D[i], D[i + 1], D[i + 2])) mc[bin(D[i], D[i + 1], D[i + 2])]++; } }
  const mouthP = palette(mc, 15, 1);
  const mouthHue = (r, g, b) => r + g + b < 160 || (r + g + b < 300 && r > g * 1.5 && r > b * 1.3) || (r + g + b > 660 && Math.max(r, g, b) - Math.min(r, g, b) < 40) || (r > 60 && g < r * 0.45 && b < r * 0.75 && b > g * 0.6) || (r > 170 && b >= g * 0.95 && g < r * 0.78) || (r > 200 && r - g > 70 && r - b > 70 && b > g * 0.7 && r + g + b < 560);   // salmon tongues
  const isDrip = (r, g, b) => b > 180 && g > 150 && r < 170 && b - r > 50;   // drool: never a chin colour
  const isMouthC = (r, g, b) => r + g + b < 160 || (inPal(mouthP, r, g, b) && mouthHue(r, g, b));
  // fur around the eyes counts as skin too, but not a colour the mouth uses (white horns next to the eyes vs white teeth)
  // the jaw's own colours (a lighter chin, lips): the reference's colours inside the mouth zone
  const jaw = (() => { const cnt = new Map(); let tot = 0;
    for (let p = 0; p < N * N; p++) { if (!Z[p]) continue; const i = p * 4; if (R[i + 3] < 220 || lum(R, i) < 75 || isMouthC(R[i], R[i + 1], R[i + 2])) continue; const k = bin(R[i], R[i + 1], R[i + 2]); cnt.set(k, (cnt.get(k) || 0) + 1); tot++; }
    // a chin stays by the mouth; clothes the jaw moves over (a hoodie, a scarf) spread over the body too
    const nearZ = grow(Zd, 60), all = new Map(), by = new Map();
    for (let p = 0; p < N * N; p++) { const i = p * 4; if (R[i + 3] < 220) continue; const k = bin(R[i], R[i + 1], R[i + 2]); if (!cnt.has(k)) continue; all.set(k, (all.get(k) || 0) + 1); if (nearZ[p]) by.set(k, (by.get(k) || 0) + 1); }
    return [...cnt].filter(([k, n]) => n > tot * 0.03 && (by.get(k) || 0) >= (all.get(k) || 1) * 0.6).map(([k]) => k); })();
  const notMouth = k => !isMouthC(((k >> 10) << 3) + 4, (((k >> 5) & 31) << 3) + 4, ((k & 31) << 3) + 4);
  const skin = [...new Set([...snout, ...jaw.filter(notMouth), ...(eyeRing ? eyeSkin.filter(k => !snout.includes(k) && notMouth(k)) : [])])];
  const lumSkin = snout.length ? ((snout[0] >> 10) << 3) + (((snout[0] >> 5) & 31) << 3) + ((snout[0] & 31) << 3) + 12 : 600;
  const isSkinC = (r0, g0, b0) => { for (const k of skin) { const r = (k >> 10) << 3, g = ((k >> 5) & 31) << 3, b = (k & 31) << 3; if (Math.abs(r0 - r - 4) + Math.abs(g0 - g - 4) + Math.abs(b0 - b - 4) < 42) return true; } return false; };
  const isSkin = (S, i) => { for (const k of skin) { const r = (k >> 10) << 3, g = ((k >> 5) & 31) << 3, b = (k & 31) << 3; if (Math.abs(S[i] - r - 4) + Math.abs(S[i + 1] - g - 4) + Math.abs(S[i + 2] - b - 4) < 42) return true; } return false; };
  // only fur / skin colours are recoloured; ink, teeth, tongue and the inside of the mouth stay as drawn
  const skinRing = new Uint8Array(N * N); for (let p = 0; p < N * N; p++) if (((ring[p] && ((p / N) | 0) < zy + 25) || (eyeRing && eyeRing[p])) && isSkin(R, p * 4)) skinRing[p] = 1;
  // a colour this Nibble shows mostly where the reference shows skin or ink is this Nibble's skin; a hat, clothes
  // or the background mostly sit where the reference has something else
  // (a hat or hair sticks out past the reference's outline somewhere: skin never does, every Nibble of a kind has the same head)
  const tTot = new Uint32Array(32768), tOut = new Uint32Array(32768), rIn = new Uint8Array(N * N);
  for (let p = 0; p < N * N; p++) if (R[p * 4 + 3] >= 60) rIn[p] = 1;
  const rNear = grow(rIn, 14);   // a sticker rim or a slightly wider head is not sticking out
  for (let p = 0; p < N * N; p++) { const i = p * 4; if (T[i + 3] < 200) continue; const k = bin(T[i], T[i + 1], T[i + 2]); tTot[k]++;
    if (!rNear[p]) tOut[k]++; }
  // a colour only the eye area gives (not the snout): this Nibble must show it below its eyes too, where hats don't reach
  let belowP = null, lidC = null;
  if (eyeRing) { let ey = 0, en = 0; for (let p = 0; p < N * N; p++) if (EZ[p]) { ey += (p / N) | 0; en++; } ey = en ? ey / en : 0;
    const bc = new Uint32Array(32768); for (let p = 0; p < N * N; p++) { if (!eyeRing[p] || ((p / N) | 0) < ey) continue; const i = p * 4; if (T[i + 3] > 200 && lum(T, i) >= 75) bc[bin(T[i], T[i + 1], T[i + 2])]++; }
    belowP = palette(bc, 30, 1);
    let bk = -1, bn = 0; for (let k = 0; k < 32768; k++) { const r = ((k >> 10) << 3) + 4, g = (((k >> 5) & 31) << 3) + 4, b = ((k & 31) << 3) + 4; if (bc[k] > bn && r + g + b >= 160 && !(inPal(mouthP, r, g, b) && mouthHue(r, g, b))) { bn = bc[k]; bk = k; } }
    if (bk >= 0) { let r = 0, g = 0, b = 0, n = 0; for (let p = 0; p < N * N; p++) { if (!eyeRing[p] || ((p / N) | 0) < ey) continue; const i = p * 4; if (T[i + 3] > 200 && bin(T[i], T[i + 1], T[i + 2]) === bk) { r += T[i]; g += T[i + 1]; b += T[i + 2]; n++; } }
      lidC = [r / n, g / n, b / n]; } }
  const okT = (r, g, b, sr, sg, sb) => { if (belowP && sr !== undefined && !nearK(snout, sr, sg, sb) && !nearK(jaw, sr, sg, sb) && !inPal(belowP, r, g, b)) return false; let t = 0, s = 0; const R0 = r >> 3, G0 = g >> 3, B0 = b >> 3;
    for (let a = Math.max(0, R0 - 1); a <= Math.min(31, R0 + 1); a++) for (let c = Math.max(0, G0 - 1); c <= Math.min(31, G0 + 1); c++) for (let d = Math.max(0, B0 - 1); d <= Math.min(31, B0 + 1); d++) { const k = (a << 10) | (c << 5) | d; t += tTot[k]; s += tOut[k]; }
    return s < Math.max(40, t * 0.08); };
  // the jaw too (a lighter chin): learned just below the mouth area, where the chin and neck go on but no
  // Nibble's own mouth ever is (the colour must be the reference's jaw colour there, so its clothes don't count)
  { const jawK = new Set(jaw), below = grow(Zd, 40), tj = new Uint32Array(32768);
    // only colours this Nibble also shows on its own jaw (its chin), not a collar or shirt just below it
    for (let p = 0; p < N * N; p++) { if (!Z[p]) continue; const i = p * 4; if (T[i + 3] > 200 && lum(T, i) >= 160 && R[i + 3] > 200 && isSkin(R, i) && !mouthHue(T[i], T[i + 1], T[i + 2]) && !isDrip(T[i], T[i + 1], T[i + 2])) tj[bin(T[i], T[i + 1], T[i + 2])]++; }
    // minus this Nibble's clothes: colours it shows where the reference wears clothes
    const tcl = new Uint32Array(32768);
    for (let p = 0; p < N * N; p++) { const i = p * 4; if (R[i + 3] > 220 && T[i + 3] > 200 && lum(R, i) >= 75 && !isSkin(R, i) && !isMouthC(R[i], R[i + 1], R[i + 2])) tcl[bin(T[i], T[i + 1], T[i + 2])]++; }
    for (let k = 0; k < 32768; k++) if (tcl[k] > 300 && tcl[k] > tj[k]) tj[k] = 0;
    const tjP = palette(tj, 30, 1);
    for (let p = 0; p < N * N; p++) { if (!Z[p] || ((p / N) | 0) < zy) continue; const i = p * 4; if (R[i + 3] < 220 || T[i + 3] < 200 || lum(T, i) < 160 || mouthHue(T[i], T[i + 1], T[i + 2]) || !inPal(tjP, T[i], T[i + 1], T[i + 2])) continue;
      if (jawK.has(bin(R[i], R[i + 1], R[i + 2])) || (isSkin(R, i) && !nearK(snout, R[i], R[i + 1], R[i + 2]))) skinRing[p] = 1; } }
  const map = colourMap(R, T, skinRing, okT);
  { const sm = snout.length ? map(((snout[0] >> 10) << 3) + 4, (((snout[0] >> 5) & 31) << 3) + 4, ((snout[0] & 31) << 3) + 4) : null; if (sm) lidC = sm; }   // lids: this Nibble's main face colour
  // better: the lid is the reference's own skin there, so this Nibble's colour where the reference shows that same skin
  // beside and below its eyes (not above, where hats sit). One colour for the whole lid, shaded like the kit's.
  let lidLum = 0, faceOwn = null;
  if (ref._E && ref._E[4]) { const E = ref._E[4], lc = new Uint32Array(32768);
    for (let p = 0; p < N * N; p++) { const i = p * 4; if (E[i + 3] > 200 && lum(E, i) >= 75 && isSkin(E, i)) lc[bin(E[i], E[i + 1], E[i + 2])]++; }
    let rk = -1, rn = 0; for (let k = 0; k < 32768; k++) if (lc[k] > rn) { rn = lc[k]; rk = k; }
    if (rk >= 0) { const rr = ((rk >> 10) << 3) + 4, rg = (((rk >> 5) & 31) << 3) + 4, rb = ((rk & 31) << 3) + 4; lidLum = rr + rg + rb;
      let ey = 0, en = 0; for (let p = 0; p < N * N; p++) if (EZ[p]) { ey += (p / N) | 0; en++; } ey = en ? ey / en : 0;
      const around = grow(EZ, 70), tc = new Uint32Array(32768); let tot = 0;
      for (let p = 0; p < N * N; p++) { if (!around[p] || EZ[p] || Zd[p] || ((p / N) | 0) < ey) continue; const i = p * 4;
        if (R[i + 3] < 220 || T[i + 3] < 220 || Math.abs(R[i] - rr) + Math.abs(R[i + 1] - rg) + Math.abs(R[i + 2] - rb) > 45) continue;
        tc[bin(T[i], T[i + 1], T[i + 2])]++; tot++; }
      // it must be a colour this Nibble also shows around its mouth (its face), not goggles, a monocle or glasses
      const rc2 = new Uint32Array(32768); for (let p = 0; p < N * N; p++) { if (!ring[p] || Zd[p]) continue; const i = p * 4; if (T[i + 3] > 220) rc2[bin(T[i], T[i + 1], T[i + 2])]++; }
      const nearRing = k => { let t = 0; const a = k >> 10, b = (k >> 5) & 31, c = k & 31; for (let x = Math.max(0, a - 1); x <= Math.min(31, a + 1); x++) for (let y = Math.max(0, b - 1); y <= Math.min(31, b + 1); y++) for (let z = Math.max(0, c - 1); z <= Math.min(31, c + 1); z++) t += rc2[(x << 10) | (y << 5) | z]; return t; };
      let bk = -1, bn = 0; for (let k = 0; k < 32768; k++) if (tc[k] > bn && nearRing(k) >= 150) { bn = tc[k]; bk = k; }
      // the usual lid (the map's match for the reference's face colour) is kept when this Nibble really shows it there
      const oldK = lidC ? bin(lidC[0], lidC[1], lidC[2]) : -1; let oldN = 0;
      if (oldK >= 0) { const a = oldK >> 10, b = (oldK >> 5) & 31, c = oldK & 31; for (let x = Math.max(0, a - 1); x <= Math.min(31, a + 1); x++) for (let y = Math.max(0, b - 1); y <= Math.min(31, b + 1); y++) for (let z = Math.max(0, c - 1); z <= Math.min(31, c + 1); z++) oldN += tc[(x << 10) | (y << 5) | z]; }
      if (oldN >= tot * 0.15) { bk = -1; faceOwn = { ref:[rr, rg, rb], c:lidC, lum:rr + rg + rb }; }   // still this Nibble's face colour
      if (bk >= 0 && bn > 200 && bn > tot * 0.25) { let r = 0, g = 0, b = 0, n = 0;
        for (let p = 0; p < N * N; p++) { if (!around[p] || EZ[p] || Zd[p] || ((p / N) | 0) < ey) continue; const i = p * 4; if (T[i + 3] > 220 && bin(T[i], T[i + 1], T[i + 2]) === bk) { r += T[i]; g += T[i + 1]; b += T[i + 2]; n++; } }
        lidC = [r / n, g / n, b / n]; faceOwn = { ref:[rr, rg, rb], c:lidC, lum:lidLum }; } else lidLum = 0; } }
  if (dbg) Object.assign(dbg, { faceOwn, lidC, lumSkin, known: colourMap.last, map, okT, skin, snout, isMouthC, mouthP });
  // the reference's jaw skin, once this Nibble's own chin is known: the chin colour (shaded like the reference) when the
  // colour map says something far from it (a scarf or collar learned as the jaw)
  let chinOwn = null;
  const jawFix = (r, g, b, m) => { if (!chinOwn || !inPal(chinOwn.P, r, g, b) || inPal(mouthP, r, g, b)) return m; const sc = Math.min(1.1, (r + g + b) / chinOwn.lum), c = chinOwn.c.map(v => Math.max(0, Math.min(255, Math.round(v * sc))));
    return !m || Math.abs(m[0] - c[0]) + Math.abs(m[1] - c[1]) + Math.abs(m[2] - c[2]) > 90 ? c : m; };
  // the same for the reference's main face skin (the colour of its lids): this Nibble's own face colour from around its
  // eyes, when the map learned something far off (a hat or monocle where the reference shows its head)
  const faceFix = (r, g, b, m) => { if (!faceOwn || Math.abs(r - faceOwn.ref[0]) + Math.abs(g - faceOwn.ref[1]) + Math.abs(b - faceOwn.ref[2]) > 60) return m;
    const sc = Math.max(0.55, Math.min(1.04, (r + g + b) / faceOwn.lum)), c = faceOwn.c.map(v => Math.max(0, Math.min(255, Math.round(v * sc))));
    return !m || Math.abs(m[0] - c[0]) + Math.abs(m[1] - c[1]) + Math.abs(m[2] - c[2]) > 80 ? c : m; };
  const mapped = (S, i) => { if (S[i + 3] < 8) return null; if (lum(S, i) >= 160 && !isSkinC(S[i], S[i + 1], S[i + 2]) && inPal(mouthP, S[i], S[i + 1], S[i + 2]) && mouthHue(S[i], S[i + 1], S[i + 2])) return [S[i], S[i + 1], S[i + 2]]; const m = faceFix(S[i], S[i + 1], S[i + 2], jawFix(S[i], S[i + 1], S[i + 2], isSkinC(S[i], S[i + 1], S[i + 2]) || lum(S, i) < 260 ? map(S[i], S[i + 1], S[i + 2]) : null)); return m || [S[i], S[i + 1], S[i + 2]]; };
  // the reference's own clothes near the mouth: when a closing jaw shows them, this Nibble's clothes are filled in instead
  const cloth = new Set(); { const cc = new Map(); let ct = 0;
    for (let p = 0; p < N * N; p++) { if (!ring[p] || ((p / N) | 0) < zy) continue; const i = p * 4; if (R[i + 3] < 220 || lum(R, i) < 75 || isSkin(R, i)) continue; const k = bin(R[i], R[i + 1], R[i + 2]); cc.set(k, (cc.get(k) || 0) + 1); ct++; }
    for (const [k, n] of cc) if (n > ct * 0.01) cloth.add(k); }
  // the face, in the reference: skin, the ink drawn on it, and the mouth itself
  const face0 = new Uint8Array(N * N);
  for (let p = 0; p < N * N; p++) { if (!Zd[p]) continue; const i = p * 4; if (R[i + 3] > 128 && (isSkin(R, i) || hits[p] >= 2)) face0[p] = 1; }
  const face = grow(face0, 3), face0core = new Uint8Array(N * N);
  for (let p = 0; p < N * N; p++) if (face0[p] && isSkin(R, p * 4)) face0core[p] = 1;   // where the reference shows skin, the kit's dark is the new mouth, not clothes
  // where this Nibble's own mouth area differs from the reference (its own mouth trait): talking replaces it.
  // Only on the face: a different outfit or collar near the jaw stays this Nibble's own.
  const own = new Uint8Array(N * N);
  for (let p = 0; p < N * N; p++) { if (!Zd[p] || !face[p]) continue; const i = p * 4, m = mapped(R, i);
    if (Math.abs(T[i + 3] - R[i + 3]) > 60 || (m && Math.abs(m[0] - T[i]) + Math.abs(m[1] - T[i + 1]) + Math.abs(m[2] - T[i + 2]) > 70)) own[p] = 1; }
  const ownG = grow(own, 3);
  // a tongue or drool hanging out of this Nibble's mouth (Tongue Out, Drooling): gone while it talks
  const st0 = new Uint8Array(N * N), near = grow(Zd, 150);
  for (let p = 0; p < N * N; p++) { if (!near[p] || ((p / N) | 0) < zy - 20) continue; const i = p * 4; if (T[i + 3] < 200) continue;
    const r = T[i], g = T[i + 1], b = T[i + 2], pink = r > 190 && g < 150 && b > 70 && b < 215 && r - g > 70, drool = b > 180 && g > 150 && r < 170 && b - r > 50;
    if (!(pink || drool)) continue; const R0 = R[i], G0 = R[i + 1], B0 = R[i + 2];
    if (Math.abs(R0 - r) + Math.abs(G0 - g) + Math.abs(B0 - b) < 60) continue;   // the reference has the same thing here: not this Nibble's own
    st0[p] = 1; }
  const cc2 = new Uint32Array(32768), tc = new Uint32Array(32768);
  for (let p = 0; p < N * N; p++) { const i = p * 4;
    if (R[i + 3] > 220 && lum(R, i) >= 75 && !isSkin(R, i) && !isMouthC(R[i], R[i + 1], R[i + 2])) cc2[bin(R[i], R[i + 1], R[i + 2])]++;   // anywhere on the reference, around the mouth too (a scarf the jaw moves over)
    if (T[i + 3] > 200) tc[bin(T[i], T[i + 1], T[i + 2])]++; }
  const clothP = palette(cc2, 40, 1), ownP = palette(tc, 6, 2);
  const rc = new Uint32Array(32768); for (let p = 0; p < N * N; p++) { const i = p * 4; if (R[i + 3] > 220 && lum(R, i) >= 75 && !isMouthC(R[i], R[i + 1], R[i + 2])) rc[bin(R[i], R[i + 1], R[i + 2])]++; }
  const refP = palette(rc, 40, 1);   // every colour of the reference's own body
  // this Nibble's own face colours around the mouth (a jaw shade must be one of these, not e.g. a yellow logo elsewhere)
  const tf = new Uint32Array(32768); for (let p = 0; p < N * N; p++) { if (!ring[p] && !Zd[p]) continue; const i = p * 4; if (T[i + 3] > 200) tf[bin(T[i], T[i + 1], T[i + 2])]++; }
  const faceP = palette(tf, 40, 2);
  // the same colours as a list (mouth colours left out), to snap a recoloured skin pixel the map got wrong (a mauve chin on
  // a white raccoon) to the nearest colour this Nibble's face really has
  const faceList = []; { const sum = new Map();
    for (let p = 0; p < N * N; p++) { if (!ring[p] && !Zd[p]) continue; const i = p * 4; if (T[i + 3] < 200 || lum(T, i) < 160 || mouthHue(T[i], T[i + 1], T[i + 2])) continue; const k = bin(T[i], T[i + 1], T[i + 2]);
      let e = sum.get(k); if (!e) sum.set(k, e = [0, 0, 0, 0]); e[0] += T[i]; e[1] += T[i + 1]; e[2] += T[i + 2]; e[3]++; }
    for (const e of sum.values()) if (e[3] >= 60) faceList.push([e[0] / e[3], e[1] / e[3], e[2] / e[3], e[3]]); }
  const snapFace = m => { if (!faceList.length || inPal(faceP, m[0], m[1], m[2])) return m; let best = null, bd = 1e9;
    for (const c of faceList) { const d = Math.abs(c[0] - m[0]) + Math.abs(c[1] - m[1]) + Math.abs(c[2] - m[2]); if (d < bd) { bd = d; best = c; } }
    return best && bd < 160 ? [Math.round(best[0]), Math.round(best[1]), Math.round(best[2])] : m; };
  // this Nibble's own chin: its commonest light, non-mouth colour just below the mouth area (for skin the map can't match)
  // the reference's jaw skin: its light colours inside the mouth area that aren't snout, mouth, or its clothes (clothes reach the bottom of the picture)
  const jawC = new Uint32Array(32768), botC = new Uint32Array(32768);
  for (let p = 0; p < N * N; p++) { const i = p * 4; if (R[i + 3] < 220 || lum(R, i) < 300) continue; const k = bin(R[i], R[i + 1], R[i + 2]);
    if (((p / N) | 0) > N * 0.88) botC[k]++; if (Z[p] && !nearK(snout, R[i], R[i + 1], R[i + 2]) && !mouthHue(R[i], R[i + 1], R[i + 2])) jawC[k]++; }
  for (let k = 0; k < 32768; k++) if (botC[k] > 200) jawC[k] = 0;
  const botP = palette(botC, 200, 1);   // what the reference wears: its colours along the bottom of the picture
  const jawP = palette(jawC, 60, 1), onJawR = i => R[i + 3] > 200 && inPal(jawP, R[i], R[i + 1], R[i + 2]);
  let chinT = null, lumJaw = 600, chinLearned = false;
  { const cnt = new Uint32Array(32768), rowS = new Float64Array(32768), below = new Uint8Array(N * N); let bk = -1, bn = 0;
    // the reference's jaw skin, in the upper half of the jaw below the mouth: a collar, shirt or scarf further down isn't the chin
    let zmax = zy; for (let p = 0; p < N * N; p++) if (Z[p]) zmax = Math.max(zmax, (p / N) | 0);
    const yLim = zy + Math.max(40, (zmax - zy) * 0.45);
    for (const lim of [yLim, 1e9]) { below.fill(0); cnt.fill(0); rowS.fill(0);   // nothing there (a tongue hanging over it): the whole jaw
    for (let p = 0; p < N * N; p++) if (Zd[p] && ((p / N) | 0) <= lim && onJawR(p * 4)) below[p] = 1;
    for (let p = 0; p < N * N; p++) { if (!below[p] || ((p / N) | 0) < zy) continue; const i = p * 4; if (T[i + 3] < 200 || lum(T, i) < 300 || mouthHue(T[i], T[i + 1], T[i + 2]) || isDrip(T[i], T[i + 1], T[i + 2]) || st0[p]) continue; const k = bin(T[i], T[i + 1], T[i + 2]); cnt[k]++; rowS[k] += (p / N) | 0; }
    // of the colours that cover a fair part of it, the lightest (a chin is the light belly colour; a scarf, collar or the
    // inside of this Nibble's own open mouth is darker)
    { let top = 0; for (let k = 0; k < 32768; k++) top = Math.max(top, cnt[k]); let best = -1;
      for (let k = 0; k < 32768; k++) if (cnt[k] > 40 && cnt[k] >= top * 0.3) { const L = (k >> 10) + ((k >> 5) & 31) + (k & 31); if (L > best) { best = L; bk = k; bn = cnt[k]; } } }
      if (bn > 40) break; }
    if (dbg) { dbg.chinCands = []; for (let k = 0; k < 32768; k++) if (cnt[k] > 60) dbg.chinCands.push([((k >> 10) << 3) + 4, (((k >> 5) & 31) << 3) + 4, ((k & 31) << 3) + 4, cnt[k], Math.round(rowS[k] / cnt[k] - zy)]); dbg.chinCands.sort((a, b) => b[3] - a[3]); dbg.zy = zy; }
    if (bn > 40) { let r = 0, g = 0, b = 0, n = 0; for (let p = 0; p < N * N; p++) { if (!below[p] || ((p / N) | 0) < zy) continue; const i = p * 4; if (T[i + 3] > 200 && bin(T[i], T[i + 1], T[i + 2]) === bk) { r += T[i]; g += T[i + 1]; b += T[i + 2]; n++; } } chinT = [r / n, g / n, b / n]; chinLearned = true; }
    { let jk = -1, jn = 0; for (let k = 0; k < 32768; k++) if (jawC[k] > jn) { jn = jawC[k]; jk = k; } if (jk >= 0) { lumJaw = ((jk >> 10) << 3) + (((jk >> 5) & 31) << 3) + ((jk & 31) << 3) + 12;
      if (!chinT) chinT = map(((jk >> 10) << 3) + 4, (((jk >> 5) & 31) << 3) + 4, ((jk & 31) << 3) + 4); } } }   // too little chin showing: the learned match of the reference's jaw colour
  if (chinLearned) chinOwn = { c:chinT, P:jawP, lum:lumJaw };
  if (dbg) Object.assign(dbg, { chinT, lumJaw, jawN:jawC.reduce((a, v) => a + (v ? 1 : 0), 0) });
  // a hanging tongue or drool stays on a still body (the talking mouth draws over it); on a moving body (slime, fire)
  // only the resting face shows it, so the talking mouths paint out what's left of it below the jaw
  const stick = loopBody ? grow(st0, 5) : new Uint8Array(N * N);
  if (loopBody) for (let p = 0; p < N * N; p++) if (((p / N) | 0) <= zy) stick[p] = 0;
  const frames = [Timg];
  let mb = [N, N, 0, 0];
  for (let k = 1; k < 10; k++) {
    const D = K[k], use = new Uint8Array(N * N);
    for (let p = 0; p < N * N; p++) { if (!Zd[p]) continue; const i = p * 4;
      if (Math.abs(D[i + 3] - R[i + 3]) > 30 || dist(D, i, R, i) > 30) use[p] = 1; }
    // only solid changes count: scattered differences are Gemini redrawing the fur, and stay this Nibble's own
    const solid = fillHoles(grow(shrink(grow(blobs(use, 120), 3), 3), 0));
    const useG = grow(solid, 2); for (let p = 0; p < N * N; p++) { if (ownG[p] && face[p]) useG[p] = 1; useG[p] &= Zd[p]; }
    // pixels where this mouth shows the reference's clothes: filled from this Nibble's own picture around them
    // (a dark, wide, colourless area is clothing too: ink lines are thin and the mouth's inside is red)
    // anything here that isn't skin, the mouth (reds, pinks, teeth) or a thin ink line is the reference's clothes
    const hole = new Uint8Array(N * N), other = new Uint8Array(N * N);
    for (let p = 0; p < N * N; p++) { if (!useG[p]) continue; const i = p * 4; if (D[i + 3] < 200 || isSkin(D, i)) continue;
      if (!isMouthC(D[i], D[i + 1], D[i + 2]) && lum(D, i) >= 200) other[p] = 1; }   // the mouth is dark, red, pink or white teeth; clothes are anything else
    const wide = grow(shrink(other, 4), 4), subst0 = new Map();
    for (let p = 0; p < N * N; p++) if (other[p] && wide[p] && R[p * 4 + 3] > 200 && isSkin(R, p * 4)) { const i = p * 4;
      // the reference's clothes showing: filled from this Nibble's own; any other colour (a lighter lip Gemini drew) is its chin
      if (chinT && !inPal(clothP, D[i], D[i + 1], D[i + 2]) && !map(D[i], D[i + 1], D[i + 2])) { const sc = Math.min(1.1, lum(D, i) / lumJaw); subst0.set(p, chinT.map(v => Math.max(0, Math.min(255, Math.round(v * sc))))); }
      else hole[p] = 1; }
    for (let p = 0; p < N * N; p++) if (stick[p] && !useG[p]) { hole[p] = 1; useG[p] = 1; }
    // nothing of the reference's own body may come through: where this mouth leaves the reference's clothes or
    // accessories as they were, this Nibble keeps its own; where it shows them moved, or shows any colour this Nibble
    // doesn't have that isn't a mouth colour, it is filled from this Nibble's own picture
    const keepT = new Uint8Array(N * N), foreign = new Uint8Array(N * N), subst = subst0;
    for (let p = 0; p < N * N; p++) { if (!useG[p] || hole[p] || subst.has(p)) continue; const i = p * 4; if (D[i + 3] < 200) continue;
      const mouthy = isMouthC(D[i], D[i + 1], D[i + 2]);
      // unchanged by this mouth: this Nibble's own, except where its own mouth is being replaced
      if (dist(D, i, R, i) <= 30 && (!ownG[p] || (R[i + 3] > 200 && lum(R, i) >= 75 && !isSkin(R, i) && !isMouthC(R[i], R[i + 1], R[i + 2])))) { keepT[p] = 1; continue; }
      // skin: drawn in this Nibble's matching colour; a skin colour with no match here (a chin its hoodie hides) is filled from its own picture
      if (mouthy || isSkin(D, i)) { if (mouthy) continue; const mm = lum(D, i) >= 75 ? map(D[i], D[i + 1], D[i + 2]) : 1, m = mapped(D, i);
        const onJaw = onJawR(i);
        if (chinT && (!mm || (onJaw && !inPal(faceP, m[0], m[1], m[2])))) { const sc = Math.min(1.1, lum(D, i) / lumJaw); subst.set(p, chinT.map(v => Math.max(0, Math.min(255, Math.round(v * sc))))); continue; }
        if (!mm || !inPal(ownP, m[0], m[1], m[2])) foreign[p] = 1; continue; }
      if (dist(D, i, R, i) <= 30) continue;
      // another colour of the reference's body (a lighter lip) that this Nibble has no match for: its own chin colour
      if (chinT && inPal(refP, D[i], D[i + 1], D[i + 2]) && !inPal(clothP, D[i], D[i + 1], D[i + 2]) && !map(D[i], D[i + 1], D[i + 2])) { const sc = Math.min(1.1, lum(D, i) / lumJaw); subst.set(p, chinT.map(v => Math.max(0, Math.min(255, Math.round(v * sc))))); continue; }
      if (!(R[i + 3] > 200 && isSkin(R, i))) { keepT[p] = 1; continue; }
      if (chinT && !inPal(clothP, D[i], D[i + 1], D[i + 2]) && !map(D[i], D[i + 1], D[i + 2])) { const sc = Math.min(1.1, lum(D, i) / lumJaw); subst.set(p, chinT.map(v => Math.max(0, Math.min(255, Math.round(v * sc))))); continue; }   // over the reference's skin: a lip shade with no match here
      if (inPal(clothP, D[i], D[i + 1], D[i + 2]) || !inPal(ownP, D[i], D[i + 1], D[i + 2])) foreign[p] = 1; }
    { const f = blobs(foreign, 12); for (let p = 0; p < N * N; p++) if (f[p]) hole[p] = 1; }
    // a hole on the reference's jaw skin that isn't its clothes showing (a lip, a chin shade): this Nibble's own chin colour
    if (chinT) for (let p = 0; p < N * N; p++) { if (!hole[p] || stick[p]) continue; const i = p * 4;
      if ((onJawR(i) || (R[i + 3] > 200 && isSkin(R, i) && ((p / N) | 0) > zy)) && D[i + 3] > 200 && lum(D, i) >= 300 && !inPal(botP, D[i], D[i + 1], D[i + 2])) {
        hole[p] = 0; const sc = Math.min(1.1, lum(D, i) / lumJaw); subst.set(p, chinT.map(v => Math.max(0, Math.min(255, Math.round(v * sc))))); } }
    const fill = inpaint(T, grow(hole, 1), useG);
    if (dbg) { const c = new Uint8Array(N * N); for (let p = 0; p < N * N; p++) c[p] = !useG[p] ? 0 : hole[p] ? 3 : keepT[p] ? 2 : 1; (dbg.cls = dbg.cls || [])[k] = c; }
    const a = soft(useG), c = cv(), g = c.getContext('2d'), id = g.createImageData(N, N), o = id.data;
    for (let p = 0; p < N * N; p++) { const i = p * 4, w = a[p];
      if (w <= 0) { o[i] = T[i]; o[i + 1] = T[i + 1]; o[i + 2] = T[i + 2]; o[i + 3] = T[i + 3]; continue; }
      const f = fill.get(p);
      // teeth stay white: a white the mouth draws where the reference had no white there is teeth, never recoloured as skin
      const teeth = !f && !keepT[p] && D[i + 3] > 200 && D[i] + D[i + 1] + D[i + 2] > 630 && Math.max(D[i], D[i + 1], D[i + 2]) - Math.min(D[i], D[i + 1], D[i + 2]) < 40 && !(R[i + 3] > 200 && R[i] + R[i + 1] + R[i + 2] > 600);
      let m = f ? f : teeth ? [D[i], D[i + 1], D[i + 2]] : subst.has(p) ? subst.get(p) : keepT[p] ? [T[i], T[i + 1], T[i + 2]] : (mapped(D, i) || [T[i], T[i + 1], T[i + 2]]); const da = f ? 255 : keepT[p] ? T[i + 3] : D[i + 3];
      if (!f && !teeth && !keepT[p] && !subst.has(p) && D[i + 3] > 200 && lum(D, i) >= 160 && !isMouthC(D[i], D[i + 1], D[i + 2])) m = snapFace(m);   // a skin colour this face doesn't have
      for (let ch = 0; ch < 3; ch++) o[i + ch] = Math.round(T[i + ch] * (1 - w) + m[ch] * w);
      o[i + 3] = Math.round(T[i + 3] * (1 - w) + da * w);
      if (useG[p]) { const x = p % N, y = (p / N) | 0; if (x < mb[0]) mb[0] = x; if (y < mb[1]) mb[1] = y; if (x > mb[2]) mb[2] = x; if (y > mb[3]) mb[3] = y; }
    }
    g.putImageData(id, 0, 0); frames.push(c);
  }
  // This Nibble's own things where the mouth zone ends: the parts of it that differ from the reference (its own mouth
  // trait, a mustache, a straw, dark magic...) that reach out past the zone. Two kinds:
  //  - in front of the mouth (front: a mustache, straw, match, gum bubble, dark magic): drawn back over every talking
  //    mouth, whole, so they never get cut off where the zone ends
  //  - its own bigger mouth (a wide open beak, a big grin): the part past the zone is painted as the reference's face
  //    there, so the old mouth's outline doesn't hang around the new one
  { const zone = grow(Zd, 140), dif = new Uint8Array(N * N);
    for (let p = 0; p < N * N; p++) { if (!zone[p]) continue; const i = p * 4; if (T[i + 3] < 100 && R[i + 3] < 100) continue;
      if (Math.abs(T[i + 3] - R[i + 3]) > 80) { dif[p] = 1; continue; } const m = mapped(R, i); if (m && Math.abs(m[0] - T[i]) + Math.abs(m[1] - T[i + 1]) + Math.abs(m[2] - T[i + 2]) > 80) dif[p] = 1; }
    const lab = new Int32Array(N * N), q = new Int32Array(N * N), fr = new Uint8Array(N * N), bh = new Uint8Array(N * N); let id = 0;
    for (let s0 = 0; s0 < N * N; s0++) { if (!dif[s0] || lab[s0]) continue; id++; let h = 0, t = 0, inZ = 0; q[t++] = s0; lab[s0] = id;
      while (h < t) { const p = q[h++], x = p % N; if (Zd[p]) inZ++;
        for (const j of [x > 0 ? p - 1 : -1, x < N - 1 ? p + 1 : -1, p - N, p + N]) if (j >= 0 && j < N * N && dif[j] && !lab[j]) { lab[j] = id; q[t++] = j; } }
      const out = t - inZ; if (!inZ || out < 40) continue;
      if (front) { for (let k = 0; k < t; k++) fr[q[k]] = 1; continue; }
      if (inZ < t * 0.25 || t > 30000) continue;   // mostly outside the mouth: clothes, a collar, not the mouth
      for (let k = 0; k < t; k++) { const p = q[k], i = p * 4; if (Zd[p] || R[i + 3] < 200 || T[i + 3] < 100) continue; if (isSkin(R, i) || lum(R, i) < 160) bh[p] = 1; } }
    let any = false; for (let p = 0; p < N * N && !any; p++) if (fr[p] || bh[p]) any = true;
    if (any) {
      const frm = front ? fillHoles(fr) : fr, fa = front ? soft(grow(frm, 1), 1) : null;
      for (let k = 1; k < frames.length; k++) { const g = frames[k].getContext('2d', { willReadFrequently:true }), id2 = g.getImageData(0, 0, N, N), o = id2.data, D = K[k];
        // (a mustache lets the talking mouth show through it, outline and all: only what the mouth leaves as face is covered)
        const mo = front === 'mustache' ? (() => { const c = new Uint8Array(N * N); for (let p = 0; p < N * N; p++) { const i = p * 4; if (Zd[p] && D[i + 3] > 120 && dist(D, i, R, i) > 60 && (isMouthC(D[i], D[i + 1], D[i + 2]) || lum(D, i) < 200)) c[p] = 1; } return grow(blobs(c, 40), 2); })() : null;
        for (let p = 0; p < N * N; p++) { const i = p * 4;
          if (fa && fa[p] > 0 && !(mo && mo[p])) { const w = fa[p]; for (let ch = 0; ch < 4; ch++) o[i + ch] = Math.round(o[i + ch] * (1 - w) + T[i + ch] * w); continue; }
          if (bh[p]) { const m = mapped(R, i); if (m) { o[i] = m[0]; o[i + 1] = m[1]; o[i + 2] = m[2]; o[i + 3] = R[i + 3]; } } }
        g.putImageData(id2, 0, 0); }
      for (let p = 0; p < N * N; p++) if (frm[p] || bh[p]) { const x = p % N, y = (p / N) | 0; if (x < mb[0]) mb[0] = x; if (y < mb[1]) mb[1] = y; if (x > mb[2]) mb[2] = x; if (y > mb[3]) mb[3] = y; }
    } }
  if (mb[2] < mb[0]) mb = [0, 0, 0, 0];
  // the blink: the reference's half-closed and closed eye layers, recoloured
  let eyes = [null, null, null, null, null], eb = [0, 0, 0, 0];
  if (blink && ref.eyes && ref.eyes[4]) {
    eb = [N, N, 0, 0];
    // the frown and raised-brow layers (when the kit has them) are recoloured the same way
    const has = k => { const E = ref._E[k]; if (!E) return false; for (let i = 3; i < E.length; i += 4) if (E[i] > 20) return true; return false; };
    eyes = [null, ...[1, 2, 3, 4].map(k => { if (k < 3 && !has(k)) return null; const E = ref._E[k]; unfleck(E); const  c = cv(), g = c.getContext('2d'), id = g.createImageData(N, N), o = id.data;
      for (let p = 0; p < N * N; p++) { const i = p * 4; if (E[i + 3] < 8) continue; let m = mapped(E, i);
        // a lid colour this Nibble doesn't have: the skin just under its eyes, shaded like the kit's
        if (lidC && lidLum && E[i + 3] > 120 && lum(E, i) >= 75 && (isSkin(E, i) || !inPal(ownP, m[0], m[1], m[2]))) { const sc = Math.max(0.55, Math.min(1.04, lum(E, i) / lidLum)); m = lidC.map(v => Math.max(0, Math.min(255, Math.round(v * sc)))); }   // a lid shade this Nibble doesn't have: its lid colour too
        else if (lidC && E[i + 3] > 120 && lum(E, i) >= 75 && isSkin(E, i)) { const mm = map(E[i], E[i + 1], E[i + 2]);
          if (!mm || !inPal(ownP, mm[0], mm[1], mm[2]) || (belowP && !nearK(snout, E[i], E[i + 1], E[i + 2]) && !inPal(belowP, mm[0], mm[1], mm[2]))) {
            const sc = Math.min(1.1, lum(E, i) / Math.max(1, lumSkin)); m = lidC.map(v => Math.max(0, Math.min(255, Math.round(v * sc)))); } }
        o[i] = m[0]; o[i + 1] = m[1]; o[i + 2] = m[2]; o[i + 3] = E[i + 3];
        const x = p % N, y = (p / N) | 0; if (x < eb[0]) eb[0] = x; if (y < eb[1]) eb[1] = y; if (x > eb[2]) eb[2] = x; if (y > eb[3]) eb[3] = y; }
      g.putImageData(id, 0, 0); return c; })];
    if (eb[2] < eb[0]) { eb = [0, 0, 0, 0]; eyes = [null, null, null, null, null]; }
    // the half-closed layer shows the reference's own eyes under the lid: when this Nibble's eyes are different
    // (big, hearts, dollar signs...), it goes straight from open to closed instead
    else { let d = 0, n = 0; for (let p = 0; p < N * N; p++) { if (!EZ[p]) continue; const i = p * 4; n++; if (Math.abs(T[i + 3] - R[i + 3]) > 60 || dist(T, i, R, i) > 90) d++; }
      if (n && d > n * 0.2) { eyes[3] = eyes[4]; eyes[1] = eyes[2] = null; } }   // (and no frown or raised brows: they'd show the reference's eyes)
  }
  // the face: everything the talking mouths and the blink touch, plus where this Nibble differs from the reference
  // (its own eyes, mouth, laser beams...). A trait loop is cut away here, so the face always shows through it.
  const face2 = new Uint8Array(N * N);
  for (const k of [1, 2]) if (eyes[k] && ref._E[k]) { const E = ref._E[k]; for (let p = 0; p < N * N; p++) if (E[p * 4 + 3] > 20) face2[p] = 1; }
  let zb = 0; for (let p = 0; p < N * N; p++) if (Zd[p]) zb = Math.max(zb, (p / N) | 0);   // the bottom of the mouth area: nothing below it is face
  for (let p = 0; p < N * N; p++) { const i = p * 4; if (Zd[p] || EZ[p] || ((p / N) < zb + 20 && T[i + 3] > 128 && (R[i + 3] < 128 || dist(T, i, R, i) > 90))) face2[p] = 1; }
  const fm0 = fillHoles(grow(blobs(face2, 60), 4));
  // a loop body with no face of its own (slime): the still face reaches well past its features above the chin, so the
  // soft edge never fades through a brow or cheek line (the loop's inner mask still keeps it inside the body)
  if (wideFace) { const wide = grow(fm0, 30); for (let p = 0; p < N * N; p++) if (wide[p] && (p / N) < zb - 10) fm0[p] = 1; }
  const faceMask = soft(fm0, 14);   // a wide soft edge, so the still face melts into the moving body
  // where the still face fades into the moving body below the mouth, any line it draws there would show as a faint
  // broken stroke (its own drips, a chin): painted over with the body colour around it
  if (wideFace) { const band = new Uint8Array(N * N);
    for (let p = 0; p < N * N; p++) if (((p / N) | 0) > zy && faceMask[p] > 0.01 && faceMask[p] < 0.97) band[p] = 1;
    for (let k = 0; k < frames.length; k++) { let c = frames[k];
      if (k === 0) { c = cv(); c.getContext('2d').drawImage(Timg, 0, 0, N, N); frames[0] = c; }
      const g = c.getContext('2d', { willReadFrequently:true }), id = g.getImageData(0, 0, N, N), F = id.data, ink = new Uint8Array(N * N);
      for (let p = Math.ceil(zy) * N; p < N * N; p++) if (F[p * 4 + 3] > 100 && lum(F, p * 4) < 280) ink[p] = 1;
      // whole strokes: a line reaching into the fade goes entirely, not just its faded end
      const seen = new Uint8Array(N * N), q = new Int32Array(N * N), cut = new Uint8Array(N * N);
      for (let s0 = 0; s0 < N * N; s0++) { if (!ink[s0] || seen[s0]) continue; let h = 0, t = 0, hit = false; q[t++] = s0; seen[s0] = 1;
        while (h < t) { const p = q[h++], x = p % N; if (band[p]) hit = true;
          for (const j of [x > 0 ? p - 1 : -1, x < N - 1 ? p + 1 : -1, p - N, p + N]) if (j >= 0 && j < N * N && ink[j] && !seen[j]) { seen[j] = 1; q[t++] = j; } }
        if (hit && t < 6000) for (let k = 0; k < t; k++) cut[q[k]] = 1; }   // (not the mouth itself: a big shape)
      const hole = grow(cut, 2); for (let p = 0; p < N * N; p++) if (((p / N) | 0) <= zy) hole[p] = 0;
      for (const [p, m] of inpaint(F, hole, new Uint8Array(N * N))) { const i = p * 4; F[i] = m[0]; F[i + 1] = m[1]; F[i + 2] = m[2]; }
      g.putImageData(id, 0, 0); } }
  const fm = cv(), fg = fm.getContext('2d'), fid = fg.createImageData(N, N);
  for (let p = 0; p < N * N; p++) fid.data[p * 4 + 3] = Math.round(faceMask[p] * 255);
  fg.putImageData(fid, 0, 0);
  return { frames, eyes, mouthBox:mb, eyeBox:eb, faceMask:fm };
}
