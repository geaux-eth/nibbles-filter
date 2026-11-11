// Nibble builder: turns a Nibble's picture and its three Gemini sheets into the filter's face layers.
// Everything runs on the holder's own device; nothing here talks to a server.
//
// Picture  -> its flat background cut away (the "base")
// Sheet 1  -> 6 panels (rest, M/B/P, slightly open, AH, EE, O)          3 columns x 2 rows
// Sheet 2  -> 4 panels (F/V, L, frown, OO)                              one row
// Eye sheet-> 5 panels (open, angry, surprised, half-closed, closed)   one row (optional)
//
// Each panel is lined up on the picture. Where the panels differ from the rest panel is the mouth (or the eyes);
// only that area is taken from the drawing, colour-matched to the picture, and set onto the original art.
// Every step is graded, and a panel that doesn't line up or doesn't change where it should is reported by name.

const N = 1000, W = 500;   // final size, working size for masks
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const g2 = c => c.getContext('2d', { willReadFrequently:true });
const pixels = (c, w = c.width, h = c.height) => { if (c.width !== w || c.height !== h) { const t = cv(w, h); g2(t).drawImage(c, 0, 0, w, h); c = t; } return g2(c).getImageData(0, 0, w, h).data; };
const tick = () => new Promise(r => setTimeout(r, 0));

export async function loadImage(file) {
  const url = URL.createObjectURL(file);
  const im = new Image(); im.src = url;
  try { await im.decode(); } catch (e) { await new Promise((res, rej) => { im.onload = res; im.onerror = () => rej(new Error('image')); }); }
  return im;
}

// ---------- the picture: cut away its flat (or gently shaded) background, flooding in from the top and sides
export function cutOriginal(img) {
  const c = cv(N, N), g = g2(c); g.drawImage(img, 0, 0, N, N);
  const id = g.getImageData(0, 0, N, N), d = id.data;
  const at = (x, y) => { const i = (y * N + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const corners = [at(2, 2), at(N - 3, 2), at(2, N / 2), at(N - 3, N / 2), at(N / 2, 2)];
  let seed = corners[0], best = -1;
  for (const a of corners) { const n = corners.filter(b => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 30).length; if (n > best) { best = n; seed = a; } }
  const ds = i => Math.abs(d[i * 4] - seed[0]) + Math.abs(d[i * 4 + 1] - seed[1]) + Math.abs(d[i * 4 + 2] - seed[2]);
  const rem = new Uint8Array(N * N), q = new Int32Array(N * N); let qh = 0, qt = 0;
  const push = i => { rem[i] = 1; q[qt++] = i; };
  for (let x = 0; x < N; x++) if (ds(x) < 40) push(x);
  for (let y = 0; y < N; y++) for (const x of [0, N - 1]) { const i = y * N + x; if (!rem[i] && ds(i) < 40) push(i); }
  while (qh < qt) {
    const i = q[qh++], x = i % N, y = (i / N) | 0;
    const nb = [x > 0 ? i - 1 : -1, x < N - 1 ? i + 1 : -1, y > 0 ? i - N : -1, y < N - 1 ? i + N : -1];
    for (const j of nb) {
      if (j < 0 || rem[j]) continue;
      const dn = Math.abs(d[j * 4] - d[i * 4]) + Math.abs(d[j * 4 + 1] - d[i * 4 + 1]) + Math.abs(d[j * 4 + 2] - d[i * 4 + 2]);
      if (dn < 30 && ds(j) < 90) push(j);
    }
  }
  let kept = 0;
  for (let i = 0; i < N * N; i++) {
    if (rem[i]) { d[i * 4 + 3] = 0; continue; }
    kept++;
    const x = i % N, y = (i / N) | 0;
    if (((x > 0 && rem[i - 1]) || (x < N - 1 && rem[i + 1]) || (y > 0 && rem[i - N]) || (y < N - 1 && rem[i + N])) && ds(i) < 200) d[i * 4 + 3] = 120;
  }
  g.putImageData(id, 0, 0);
  return { canvas:c, bg:'#' + seed.map(v => v.toString(16).padStart(2, '0')).join(''), share:kept / (N * N) };
}

// ---------- a sheet: split into panels at its green gutters (or evenly if they touch), green keyed out
// how many panels sit side by side in a one-row sheet (counted from its green gutters)
export function countPanels(img) {
  const w = img.naturalWidth, h = img.naturalHeight, c = cv(w, h); g2(c).drawImage(img, 0, 0);
  const d = g2(c).getImageData(0, 0, w, h).data, col = new Float32Array(w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (d[i + 1] > 170 && d[i + 1] - Math.max(d[i], d[i + 2]) > 60) col[x]++; }
  let n = 0, run = false;
  for (let x = Math.round(w * 0.06); x < w * 0.94; x++) { const g = col[x] / h > 0.97; if (g && !run) n++; run = g; }
  return n + 1;
}
export function splitSheet(img, cols, rows) {
  const w = img.naturalWidth, h = img.naturalHeight, c = cv(w, h); g2(c).drawImage(img, 0, 0);
  const d = g2(c).getImageData(0, 0, w, h).data;
  const colG = new Float32Array(w), rowG = new Float32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, r = d[i], gg = d[i + 1], b = d[i + 2];
    if (gg > 170 && gg - Math.max(r, b) > 60) { colG[x]++; rowG[y]++; }
  }
  const edges = (arr, len, n, other) => {
    const gut = []; let run = null;
    for (let i = 0; i < len; i++) { const isG = arr[i] / other > 0.97; if (isG && !run) run = [i, i]; else if (isG) run[1] = i; else if (run) { gut.push(run); run = null; } }
    if (run) gut.push(run);
    const inner = gut.filter(r => r[0] > len * 0.08 && r[1] < len * 0.92)
      .map(r => ({ m:(r[0] + r[1]) / 2, w:r[1] - r[0] }));
    // the n-1 gutters closest to an even split
    const picks = [];
    for (let k = 1; k < n; k++) { const want = len * k / n; let b = null; for (const g of inner) if (!picks.includes(g) && Math.abs(g.m - want) < len / n * 0.35 && (!b || Math.abs(g.m - want) < Math.abs(b.m - want))) b = g; picks.push(b); }
    return [0, ...picks.map((p, k) => p ? p.m : len * (k + 1) / n), len].map(Math.round);
  };
  const xs = edges(colG, w, cols, h), ys = edges(rowG, h, rows, w), out = [];
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const x0 = xs[k], x1 = xs[k + 1], y0 = ys[r], y1 = ys[r + 1], p = cv(x1 - x0, y1 - y0), pg = g2(p);
    pg.drawImage(c, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
    const id = pg.getImageData(0, 0, p.width, p.height), q = id.data;
    for (let i = 0; i < q.length; i += 4) {
      const r_ = q[i], gg = q[i + 1], b = q[i + 2], gn = gg - Math.max(r_, b);
      const a = 1 - Math.min(1, Math.max(0, (gn - 30) / 90)) * Math.min(1, Math.max(0, (gg - 90) / 90));
      q[i + 1] = Math.min(gg, Math.max(r_, b) + 10); q[i + 3] = Math.round(a * 255);
    }
    pg.putImageData(id, 0, 0); out.push(p);
  }
  return out;
}

// ---------- masks
const MW = W * W;
function boxMax(m, r, w = W) {   // dilate by a square of radius r
  if (r <= 0) return m.slice();
  const t = new Uint8Array(m.length), o = new Uint8Array(m.length), h = m.length / w;
  for (let y = 0; y < h; y++) { let c = 0; const row = y * w;
    for (let x = 0; x < Math.min(r, w); x++) c += m[row + x];
    for (let x = 0; x < w; x++) { if (x + r < w) c += m[row + x + r]; if (x - r - 1 >= 0) c -= m[row + x - r - 1]; t[row + x] = c > 0 ? 1 : 0; } }
  for (let x = 0; x < w; x++) { let c = 0;
    for (let y = 0; y < Math.min(r, h); y++) c += t[y * w + x];
    for (let y = 0; y < h; y++) { if (y + r < h) c += t[(y + r) * w + x]; if (y - r - 1 >= 0) c -= t[(y - r - 1) * w + x]; o[y * w + x] = c > 0 ? 1 : 0; } }
  return o;
}
const inv = m => m.map(v => v ? 0 : 1);
const dilate = (m, r) => boxMax(m, r);
const erode = (m, r) => inv(boxMax(inv(m), r));
const close_ = (m, r) => erode(dilate(m, r), r);
const open_ = (m, r) => dilate(erode(m, r), r);
const and = (a, b) => a.map((v, i) => v & b[i]);
const or = (a, b) => a.map((v, i) => v | b[i]);
const count = m => { let n = 0; for (const v of m) n += v; return n; };
function labels(m) {
  const lab = new Int32Array(MW), comps = []; const q = new Int32Array(MW);
  for (let s = 0; s < MW; s++) {
    if (!m[s] || lab[s]) continue;
    const id = comps.length + 1; let qh = 0, qt = 0; q[qt++] = s; lab[s] = id; let n = 0, sx = 0, sy = 0, x0 = W, y0 = W, x1 = 0, y1 = 0;
    while (qh < qt) { const i = q[qh++], x = i % W, y = (i / W) | 0; n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < W - 1 ? i + W : -1]) if (j >= 0 && m[j] && !lab[j]) { lab[j] = id; q[qt++] = j; } }
    comps.push({ id, n, cx:sx / n, cy:sy / n, box:[x0, y0, x1, y1] });
  }
  return { lab, comps };
}
function fillHoles(m) {
  const out = new Uint8Array(MW), seen = new Uint8Array(MW), q = new Int32Array(MW); let qh = 0, qt = 0;
  const push = i => { if (!m[i] && !seen[i]) { seen[i] = 1; q[qt++] = i; } };
  for (let x = 0; x < W; x++) { push(x); push((W - 1) * W + x); } for (let y = 0; y < W; y++) { push(y * W); push(y * W + W - 1); }
  while (qh < qt) { const i = q[qh++], x = i % W, y = (i / W) | 0; if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (y > 0) push(i - W); if (y < W - 1) push(i + W); }
  for (let i = 0; i < MW; i++) out[i] = m[i] || !seen[i] ? 1 : 0;
  return out;
}

// ---------- lining a panel up on the picture: a scale and a shift (panel pixels -> picture pixels)
function render(p, T, R) { const c = cv(R, R), g = g2(c), k = R / N; g.setTransform(T.s * k, 0, 0, T.s * k, T.x * k, T.y * k); g.drawImage(p, 0, 0); return c; }
function silOf(d, R) { const m = new Uint8Array(R * R); for (let i = 0; i < R * R; i++) m[i] = d[i * 4 + 3] > 128 ? 1 : 0; return m; }
function inkOf(d, R) { const m = new Uint8Array(R * R); for (let i = 0; i < R * R; i++) m[i] = d[i * 4 + 3] > 128 && d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] < 200 ? 1 : 0; return m; }
function bboxOf(m, R) { let x0 = R, y0 = R, x1 = 0, y1 = 0; for (let i = 0; i < R * R; i++) if (m[i]) { const x = i % R, y = (i / R) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; }
function headX(m, R, box) { const lim = box[1] + (box[3] - box[1]) * 0.3; let s = 0, n = 0; for (let y = box[1]; y < lim; y++) for (let x = 0; x < R; x++) if (m[y * R + x]) { s += x; n++; } return n ? s / n : (box[0] + box[2]) / 2; }
function shiftScore(A, B, R, dx, dy) {   // overlap of A with B shifted by (dx, dy)
  let o = 0;
  const ys = Math.max(0, dy), ye = Math.min(R, R + dy), xs = Math.max(0, dx), xe = Math.min(R, R + dx);
  for (let y = ys; y < ye; y++) { const ra = y * R, rb = (y - dy) * R - dx; for (let x = xs; x < xe; x++) o += A[ra + x] & B[rb + x]; }
  return o;
}
export function align(panel, orig) {
  // first guess from the outlines: same top, same height to the bottom edge, same head centre
  const R1 = 160, od = pixels(orig, R1, R1), os = silOf(od, R1), ob = bboxOf(os, R1);
  const pc = cv(R1, Math.round(R1 * panel.height / panel.width)), pk = R1 / panel.width;   // panel at the same working scale
  g2(pc).drawImage(panel, 0, 0, pc.width, pc.height);
  const pd = g2(pc).getImageData(0, 0, pc.width, pc.height).data, ps = new Uint8Array(pc.width * pc.height);
  for (let i = 0; i < ps.length; i++) ps[i] = pd[i * 4 + 3] > 128 ? 1 : 0;
  let px0 = pc.width, py0 = pc.height, py1 = 0;
  for (let i = 0; i < ps.length; i++) if (ps[i]) { const x = i % pc.width, y = (i / pc.width) | 0; if (x < px0) px0 = x; if (y < py0) py0 = y; if (y > py1) py1 = y; }
  let hs = 0, hn = 0; for (let y = py0; y < py0 + (py1 - py0) * 0.3; y++) for (let x = 0; x < pc.width; x++) if (ps[y * pc.width + x]) { hs += x; hn++; }
  const phx = hn ? hs / hn : pc.width / 2, ohx = headX(os, R1, ob);
  const s0 = ((ob[3] - ob[1]) / Math.max(1, py1 - py0)) * pk;   // picture px per panel px (in 1000 space below)
  const toN = N / R1;
  let T = { s:s0 * toN / 1, x:(ohx - phx * (ob[3] - ob[1]) / Math.max(1, py1 - py0)) * toN, y:(ob[1] - py0 * (ob[3] - ob[1]) / Math.max(1, py1 - py0)) * toN };
  // coarse: scale and shift by silhouette overlap at 160 px
  let best = { sc:-1 };
  for (let ds = -0.12; ds <= 0.1201; ds += 0.02) {
    const s = T.s * (1 + ds), cx = 500, cy = 500;   // scale about the picture centre
    const Tc = { s, x:(T.x - cx) * (1 + ds) + cx, y:(T.y - cy) * (1 + ds) + cy };
    const m = silOf(pixels(render(panel, Tc, R1)), R1), mn = count(m), on = count(os);
    for (let dy = -14; dy <= 14; dy++) for (let dx = -14; dx <= 14; dx++) {
      const o = shiftScore(os, m, R1, dx, dy), sc = o / (on + mn - o);
      if (sc > best.sc) best = { sc, T:{ s, x:Tc.x + dx * toN, y:Tc.y + dy * toN } };
    }
  }
  T = best.T;
  // fine: the ink lines at 400 px, small scale steps and pixel shifts
  const R2 = 400, k2 = N / R2, oi = dilate400(inkOf(pixels(orig, R2, R2), R2), R2), osil = silOf(pixels(orig, R2, R2), R2);
  let fine = { sc:-1, T };
  for (let ds = -0.02; ds <= 0.0201; ds += 0.005) {
    const Tc = { s:T.s * (1 + ds), x:(T.x - 500) * (1 + ds) + 500, y:(T.y - 500) * (1 + ds) + 500 };
    const pi = inkOf(pixels(render(panel, Tc, R2)), R2), pn = count(pi), on = count(oi);
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const o = shiftScore(oi, pi, R2, dx, dy), sc = 2 * o / (on + pn);
      if (sc > fine.sc) fine = { sc, T:{ s:Tc.s, x:Tc.x + dx * k2, y:Tc.y + dy * k2 } };
    }
  }
  // grade: how well the outlines match after lining up
  const fs = silOf(pixels(render(panel, fine.T, R2)), R2); const o = shiftScore(osil, fs, R2, 0, 0);
  return { T:fine.T, iou:o / (count(osil) + count(fs) - o), ink:fine.sc };
}
function dilate400(m, R) { return boxMax(m, 1, R); }

// ---------- building
function placed(panel, T) { return render(panel, T, N); }
function diffMask(a, b) {   // where two lined-up pictures (working size) differ
  const m = new Uint8Array(MW);
  for (let i = 0; i < MW; i++) {
    const j = i * 4, aa = a[j + 3] > 128, bb = b[j + 3] > 128;
    if (!aa && !bb) continue;
    m[i] = (aa !== bb) || Math.abs(a[j] - b[j]) + Math.abs(a[j + 1] - b[j + 1]) + Math.abs(a[j + 2] - b[j + 2]) > 95 ? 1 : 0;
  }
  return m;
}
// the shared core: the biggest area that changes across panels (plus pieces right next to it), holes filled
function mainCore(m, reach = 70) {
  const { lab, comps } = labels(close_(m, 6)); if (!comps.length) return m;
  const big = comps.reduce((a, b) => b.n > a.n ? b : a), keep = new Set(comps.filter(c => c.n > 20 && Math.hypot(c.cx - big.cx, c.cy - big.cy) < reach).map(c => c.id));
  const o = new Uint8Array(MW); for (let i = 0; i < MW; i++) if (keep.has(lab[i])) o[i] = 1;
  return fillHoles(o);
}
function nearCore(D, core, grow = 28) {   // the changed areas that touch the shared core (Gemini's stray redraws elsewhere are ignored)
  const near = dilate(core, grow), m = and(open_(D, 1), near);   // only changes close to the core count
  const { lab, comps } = labels(m), o = new Uint8Array(MW);
  for (let i = 0; i < MW; i++) if (lab[i] && comps[lab[i] - 1].n > 25) o[i] = 1;
  return and(dilate(fillHoles(close_(o, 4)), 3), near);
}
function gains(orig, pic, ring) {   // colour match: the panel's colours scaled to the picture's, measured just outside the zone
  const s = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < MW; i++) { if (!ring[i]) continue; const j = i * 4; if (orig[j + 3] < 200 || pic[j + 3] < 200) continue;
    if (orig[j] + orig[j + 1] + orig[j + 2] < 150) continue; for (let c = 0; c < 3; c++) { s[c] += orig[j + c]; s[c + 3] += pic[j + c]; } }
  return [0, 1, 2].map(c => s[c + 3] > 0 ? Math.min(1.25, Math.max(0.8, s[c] / s[c + 3])) : 1);
}
function softMask(m) {   // working-size mask -> full-size soft alpha (Float32)
  const c = cv(W, W), g = g2(c), id = g.createImageData(W, W);
  for (let i = 0; i < MW; i++) { id.data[i * 4 + 3] = m[i] ? 255 : 0; }
  g.putImageData(id, 0, 0);
  const b = cv(N, N), bg = g2(b); bg.filter = 'blur(1.5px)'; bg.drawImage(c, 0, 0, N, N);
  const d = bg.getImageData(0, 0, N, N).data, a = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) a[i] = d[i * 4 + 3] / 255;
  return a;
}
function compose(base, pic, alpha, gain, layerOnly) {
  const out = cv(N, N), og = g2(out), bd = pixels(base), pd = pixels(pic), id = og.createImageData(N, N), o = id.data;
  for (let i = 0; i < N * N; i++) {
    const j = i * 4, a = alpha[i];
    if (layerOnly) {
      if (a <= 0) continue;
      for (let c = 0; c < 3; c++) o[j + c] = Math.min(255, pd[j + c] * gain[c]);
      o[j + 3] = Math.round(a * pd[j + 3]);
      continue;
    }
    for (let c = 0; c < 3; c++) o[j + c] = Math.round(bd[j + c] * (1 - a) + Math.min(255, pd[j + c] * gain[c]) * a);
    o[j + 3] = Math.round(bd[j + 3] * (1 - a) + pd[j + 3] * a);
  }
  og.putImageData(id, 0, 0); return out;
}
function boxOf(m) { const b = bboxOf(m, W); return b[2] < b[0] ? null : b.map(v => v * N / W); }

// sheets: { s1:[6 canvases], s2:[4], eyes:[5] | null }. onStep(text) reports progress.
export async function build(orig, sheets, onStep = () => {}) {
  const problems = [], names1 = ['rest', 'M/B/P', 'slightly open', 'AH', 'EE', 'O'], names2 = ['F/V', 'L', 'frown', 'OO'], namesE = ['open', 'angry', 'surprised', 'half-closed', 'closed'];
  const all = [...sheets.s1.map((p, i) => ({ p, sheet:1, i, name:names1[i] })), ...sheets.s2.map((p, i) => ({ p, sheet:2, i, name:names2[i] })),
    ...(sheets.eyes || []).map((p, i) => ({ p, sheet:3, i, name:(sheets.eyes.length === 3 ? ['open', 'half-closed', 'closed'] : namesE)[i] }))];
  let worst = 1;
  for (const x of all) {
    onStep(`Lining up sheet ${x.sheet}, ${x.name}…`); await tick();
    const a = align(x.p, orig); x.T = a.T; x.iou = a.iou; worst = Math.min(worst, a.iou);
    if (a.iou < 0.86) problems.push(`Sheet ${x.sheet === 3 ? 'of eyes' : x.sheet}, the ${x.name} panel doesn't match your picture (it's bigger, smaller or moved). Run that sheet again.`);
    x.full = placed(x.p, x.T); x.small = pixels(x.full, W, W);
  }
  const od = pixels(orig, W, W), osil = silOf(od, W);
  onStep('Finding the mouth…'); await tick();
  const s1 = all.filter(x => x.sheet === 1), s2 = all.filter(x => x.sheet === 2), ref = s1[0];
  // the mouth is what changes in most of sheet 1's panels
  const heat = new Uint8Array(MW); const D1 = s1.slice(1).map(x => diffMask(x.small, ref.small));
  for (const D of D1) for (let i = 0; i < MW; i++) heat[i] += D[i];
  let core = mainCore(and(open_(Uint8Array.from(heat, v => v >= 3 ? 1 : 0), 1), osil));
  if (count(core) < 30) { problems.push('The mouth couldn\'t be found: sheet 1\'s panels don\'t differ around the mouth. Run sheet 1 again.'); }
  const M = {}; let zone = new Uint8Array(MW);
  s1.slice(1).forEach((x, k) => { M['1' + x.i] = nearCore(D1[k], core); });
  for (const x of s2) M['2' + x.i] = nearCore(diffMask(x.small, ref.small), core);
  for (const k in M) zone = or(zone, M[k]);
  zone = dilate(zone, 3);
  const silN = count(osil), zN = count(zone);
  for (const x of [...s1.slice(1), ...s2]) {
    const n = count(M[String(x.sheet) + x.i]);
    if (n < 40) problems.push(`Sheet ${x.sheet}, the ${x.name} panel looks the same as the rest. Run sheet ${x.sheet} again.`);
  }
  if (zN > silN * 0.35) problems.push('Too much of the face changes between the mouth panels (Gemini redrew more than the mouth). Run sheets 1 and 2 again.');
  // mouth frames: the original picture, with the mouth area taken from each panel (colour-matched)
  const ring = and(and(dilate(zone, 8), inv(zone)), osil), alpha = softMask(zone);
  const order = [null, ['1', 1], ['1', 2], ['1', 3], ['1', 4], ['1', 5], ['2', 3], ['2', 0], ['2', 1], ['2', 2]], frames = [orig];
  for (let k = 1; k < 10; k++) {
    onStep(`Building mouth ${k + 1} of 10…`); await tick();
    const [sh, i] = order[k], x = all.find(y => y.sheet === +sh && y.i === i);
    frames.push(compose(orig, x.full, alpha, gains(od, x.small, ring)));
  }
  // eyes
  let eyes = null, ezone = null;
  if (sheets.eyes && (sheets.eyes.length === 5 || sheets.eyes.length === 3)) {
    onStep('Building the blink…'); await tick();
    const e = all.filter(x => x.sheet === 3), eh = new Uint8Array(MW), DE = e.slice(1).map(x => diffMask(x.small, e[0].small));
    for (const D of DE) for (let i = 0; i < MW; i++) eh[i] += D[i];
    const need = DE.length >= 4 ? 2 : 1;
    const notMouth = inv(dilate(core, 8));   // the mouth itself (the mouth area may reach the eyes; the eye layers sit on top)
    const ecore = mainCore(and(and(open_(Uint8Array.from(eh, v => v >= need ? 1 : 0), 1), osil), notMouth), 150);   // two eyes: both count
    if (count(ecore) < 30) problems.push('The eyes couldn\'t be found: the eye sheet\'s panels don\'t differ around the eyes. Run the eye sheet again.');
    ezone = new Uint8Array(MW);
    const EM = DE.map(D => and(nearCore(D, ecore, 36), notMouth));
    // each eye layer covers the whole eye area (closed eyes must hide the open ones completely)
    const eall = fillHoles(close_(EM.reduce(or, new Uint8Array(MW)), 6)); EM.forEach((m, k) => EM[k] = and(dilate(eall, 7), notMouth));
    for (const m of EM) ezone = or(ezone, m);
    e.slice(1).forEach((x, k) => { if (count(EM[k]) < 30) problems.push(`The eye sheet's ${x.name} panel looks the same as the open eyes. Run the eye sheet again.`); });
    const ering = and(and(dilate(ezone, 8), inv(ezone)), osil), ea = softMask(ezone);
    const layers = e.slice(1).map(x => compose(orig, x.full, ea, gains(od, x.small, ering), true));
    eyes = layers.length === 4 ? [null, ...layers] : [null, null, null, ...layers];   // filter slots: 1 angry, 2 surprised, 3 half, 4 closed
  }
  // where the face is, for the picker's thumbnail
  const fz = ezone ? or(zone, ezone) : zone, fb = bboxOf(fz, W);
  const face = fb[2] >= fb[0] ? [Math.round((fb[0] + fb[2]) / 2 * N / W), Math.round((fb[1] + fb[3]) / 2 * N / W), 1.35] : [500, 500, 1.35];
  return { ok:problems.length === 0, problems, score:+worst.toFixed(3), frames, eyes, face, mouthBox:boxOf(zone), eyeBox:ezone ? boxOf(ezone) : null,
    grades:all.map(x => ({ sheet:x.sheet, name:x.name, iou:+x.iou.toFixed(3) })) };
}

// pictures to upload: the base whole, each mouth as just its changed box (re-assembled in the filter), each eye layer as its box
export async function exportFiles(res, origCanvas) {
  const webp = await new Promise(r => cv(2, 2).toBlob(b => r(b && b.type === 'image/webp'), 'image/webp', 0.9));
  const ext = webp ? 'webp' : 'png', type = 'image/' + ext;
  const blob = c => new Promise(r => c.toBlob(r, type, 0.9));
  const crop = (c, b) => { const [x0, y0, x1, y1] = b.map(Math.round), o = cv(Math.max(1, x1 - x0 + 1), Math.max(1, y1 - y0 + 1)); g2(o).drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height); return o; };
  const mb = res.mouthBox || [0, 0, 0, 0], eb = res.eyeBox || [0, 0, 0, 0], files = { base:await blob(origCanvas) };
  for (let k = 0; k < 10; k++) files['m' + k] = await blob(crop(res.frames[k], mb));
  for (let k = 0; k < 5; k++) files['e' + k] = await blob(res.eyes && res.eyes[k] ? crop(res.eyes[k], eb) : cv(1, 1));
  return { files, ext, layout:{ at:res.face, mb:mb.map(Math.round), eb:eb.map(Math.round) } };
}
