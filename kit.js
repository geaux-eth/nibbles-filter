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
function colourMap(R, T, where) {
  // per reference colour: the median of this Nibble's colours at the same spots, kept only when they agree
  const lists = new Map();
  for (let p = 0; p < N * N; p++) { if (!where[p]) continue; const i = p * 4;
    if (R[i + 3] < 220 || T[i + 3] < 220 || lum(R, i) < 75 || lum(T, i) < 75) continue;   // skip ink and see-through
    const k = bin(R[i], R[i + 1], R[i + 2]); let l = lists.get(k); if (!l) lists.set(k, l = []);
    if (l.length < 4000) l.push(p); }
  const known = [];
  const med = a => { a.sort((x, y) => x - y); return a[a.length >> 1]; };
  for (const [k, ps] of lists) { if (ps.length < 12) continue;
    const tr = med(ps.map(p => T[p * 4])), tg = med(ps.map(p => T[p * 4 + 1])), tb = med(ps.map(p => T[p * 4 + 2]));
    let agree = 0; for (const p of ps) { const i = p * 4; if (Math.abs(T[i] - tr) + Math.abs(T[i + 1] - tg) + Math.abs(T[i + 2] - tb) < 60) agree++; }
    if (agree < ps.length * 0.6) continue;   // this colour lands on different things in this Nibble (clothes, glasses): not skin to copy
    const r = med(ps.map(p => R[p * 4])), g = med(ps.map(p => R[p * 4 + 1])), b = med(ps.map(p => R[p * 4 + 2]));
    known.push({ r, g, b, tr, tg, tb, n:ps.length }); }
  const cache = new Map();
  return (r, g, b) => {
    const k = bin(r, g, b); let m = cache.get(k);
    if (m === undefined) { m = null; let best = 46;
      for (const c of known) { const d = Math.abs(c.r - r) + Math.abs(c.g - g) + Math.abs(c.b - b); if (d < best) { best = d; m = c; } }
      cache.set(k, m); }
    // a darker shade of a main skin colour (Gemini often draws the fur darker, and outlines fade into it): the same
    // shade of this Nibble's colour. Checked first for anything that isn't ink, since a dark detail colour can look alike.
    let bd = null, bs = 0, be = r + g + b >= 80 ? 22 : 40;
    for (const c of known) { if (c.r + c.g + c.b < 150) continue; const s0 = (r + g + b) / Math.max(1, c.r + c.g + c.b); if (s0 < 0.12 || s0 > 1.05) continue;
      const e = Math.abs(r - s0 * c.r) + Math.abs(g - s0 * c.g) + Math.abs(b - s0 * c.b); if (e < be) { be = e; bd = c; bs = s0; } }
    const shade = bd ? [bd.tr * bs, bd.tg * bs, bd.tb * bs].map(v => Math.max(0, Math.min(255, Math.round(v)))) : null;
    if (m && (!shade || Math.abs(m.r - r) + Math.abs(m.g - g) + Math.abs(m.b - b) < 12)) return [m.tr + (r - m.r), m.tg + (g - m.g), m.tb + (b - m.b)].map(v => Math.max(0, Math.min(255, Math.round(v))));
    return shade || (m ? [m.tr + (r - m.r), m.tg + (g - m.g), m.tb + (b - m.b)].map(v => Math.max(0, Math.min(255, Math.round(v)))) : null);
  };
}

// T: this Nibble's picture (background cut, 1000 px). ref: { base, mouths[10], eyes[5] } of the kind's reference.
// Returns { frames[10], eyes[5], mouthBox, eyeBox } in the builder's format.
export function fromKit(Timg, ref, { blink = true } = {}) {
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
    return [...cnt].filter(([, n]) => n > tot * 0.02).map(([k]) => k); };
  const skin = [...new Set([...skinOf(ring, true), ...(eyeRing ? skinOf(eyeRing, false) : [])])];
  const isSkinC = (r0, g0, b0) => { for (const k of skin) { const r = (k >> 10) << 3, g = ((k >> 5) & 31) << 3, b = (k & 31) << 3; if (Math.abs(r0 - r - 4) + Math.abs(g0 - g - 4) + Math.abs(b0 - b - 4) < 42) return true; } return false; };
  const isSkin = (S, i) => { for (const k of skin) { const r = (k >> 10) << 3, g = ((k >> 5) & 31) << 3, b = (k & 31) << 3; if (Math.abs(S[i] - r - 4) + Math.abs(S[i + 1] - g - 4) + Math.abs(S[i + 2] - b - 4) < 42) return true; } return false; };
  // only fur / skin colours are recoloured; ink, teeth, tongue and the inside of the mouth stay as drawn
  const skinRing = new Uint8Array(N * N); for (let p = 0; p < N * N; p++) if (((ring[p] && ((p / N) | 0) < zy + 25) || (eyeRing && eyeRing[p])) && isSkin(R, p * 4)) skinRing[p] = 1;
  const map = colourMap(R, T, skinRing);
  const mapped = (S, i) => { if (S[i + 3] < 8) return null; const m = isSkinC(S[i], S[i + 1], S[i + 2]) || lum(S, i) < 260 ? map(S[i], S[i + 1], S[i + 2]) : null; return m || [S[i], S[i + 1], S[i + 2]]; };
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
    const r = T[i], g = T[i + 1], b = T[i + 2], pink = r > 190 && g < 150 && b > 70 && b < 190 && r - g > 70, drool = b > 180 && g > 150 && r < 170 && b - r > 50;
    if (!(pink || drool)) continue; const R0 = R[i], G0 = R[i + 1], B0 = R[i + 2];
    if (Math.abs(R0 - r) + Math.abs(G0 - g) + Math.abs(B0 - b) < 60) continue;   // the reference has the same thing here: not this Nibble's own
    st0[p] = 1; }
  const stick = new Uint8Array(N * N);   // a hanging tongue or drool stays (filling where it was smeared); the talking mouth draws over it
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
      const r = D[i], g = D[i + 1], b = D[i + 2], red = r > 25 && r >= g * 1.45 && r >= b * 1.3, white = r + g + b > 680, dark = r + g + b < 200;
      if (!red && !white && !dark) other[p] = 1; }   // the mouth is dark, red, pink or white teeth; clothes are anything else
    const wide = grow(shrink(other, 4), 4); for (let p = 0; p < N * N; p++) if (other[p] && wide[p]) hole[p] = 1;
    for (let p = 0; p < N * N; p++) if (stick[p]) { hole[p] = 1; useG[p] = 1; }
    const fill = inpaint(T, grow(hole, 1), useG);
    const a = soft(useG), c = cv(), g = c.getContext('2d'), id = g.createImageData(N, N), o = id.data;
    for (let p = 0; p < N * N; p++) { const i = p * 4, w = a[p];
      if (w <= 0) { o[i] = T[i]; o[i + 1] = T[i + 1]; o[i + 2] = T[i + 2]; o[i + 3] = T[i + 3]; continue; }
      const f = fill.get(p);
      const m = f ? f : (mapped(D, i) || [T[i], T[i + 1], T[i + 2]]), da = f ? 255 : D[i + 3];
      for (let ch = 0; ch < 3; ch++) o[i + ch] = Math.round(T[i + ch] * (1 - w) + m[ch] * w);
      o[i + 3] = Math.round(T[i + 3] * (1 - w) + da * w);
      if (useG[p]) { const x = p % N, y = (p / N) | 0; if (x < mb[0]) mb[0] = x; if (y < mb[1]) mb[1] = y; if (x > mb[2]) mb[2] = x; if (y > mb[3]) mb[3] = y; }
    }
    g.putImageData(id, 0, 0); frames.push(c);
  }
  if (mb[2] < mb[0]) mb = [0, 0, 0, 0];
  // the blink: the reference's half-closed and closed eye layers, recoloured
  let eyes = [null, null, null, null, null], eb = [0, 0, 0, 0];
  if (blink && ref.eyes && ref.eyes[4]) {
    eb = [N, N, 0, 0];
    eyes = [null, null, null, ...[3, 4].map(k => { const E = ref._E[k]; unfleck(E); const  c = cv(), g = c.getContext('2d'), id = g.createImageData(N, N), o = id.data;
      for (let p = 0; p < N * N; p++) { const i = p * 4; if (E[i + 3] < 8) continue; const m = mapped(E, i);
        o[i] = m[0]; o[i + 1] = m[1]; o[i + 2] = m[2]; o[i + 3] = E[i + 3];
        const x = p % N, y = (p / N) | 0; if (x < eb[0]) eb[0] = x; if (y < eb[1]) eb[1] = y; if (x > eb[2]) eb[2] = x; if (y > eb[3]) eb[3] = y; }
      g.putImageData(id, 0, 0); return c; })];
    if (eb[2] < eb[0]) { eb = [0, 0, 0, 0]; eyes = [null, null, null, null, null]; }
  }
  // the face: everything the talking mouths and the blink touch, plus where this Nibble differs from the reference
  // (its own eyes, mouth, laser beams...). A trait loop is cut away here, so the face always shows through it.
  const face2 = new Uint8Array(N * N);
  let zb = 0; for (let p = 0; p < N * N; p++) if (Zd[p]) zb = Math.max(zb, (p / N) | 0);   // the bottom of the mouth area: nothing below it is face
  for (let p = 0; p < N * N; p++) { const i = p * 4; if (Zd[p] || EZ[p] || ((p / N) < zb + 20 && T[i + 3] > 128 && (R[i + 3] < 128 || dist(T, i, R, i) > 90))) face2[p] = 1; }
  const faceMask = soft(fillHoles(grow(blobs(face2, 60), 4)), 14);   // a wide soft edge, so the still face melts into the moving body
  const fm = cv(), fg = fm.getContext('2d'), fid = fg.createImageData(N, N);
  for (let p = 0; p < N * N; p++) fid.data[p * 4 + 3] = Math.round(faceMask[p] * 255);
  fg.putImageData(fid, 0, 0);
  return { frames, eyes, mouthBox:mb, eyeBox:eb, faceMask:fm };
}
