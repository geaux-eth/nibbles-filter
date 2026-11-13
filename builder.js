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
export function countPanels(img) { return gridOf(img).cols; }
// how a sheet is laid out: columns and rows of panels, counted from its green gutters
export function gridOf(img) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, c = cv(w, h); g2(c).drawImage(img, 0, 0);
  const d = g2(c).getImageData(0, 0, w, h).data, col = new Float32Array(w), row = new Float32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (isGreen(d, i)) { col[x]++; row[y]++; } }
  // gutters: green bands that start and end inside the sheet (a band running out to an edge is just margin)
  const runs = (a, len, other) => { let n = 0, st = -1; for (let x = 0; x <= len; x++) { const g = x < len && a[x] / other > 0.97;
    if (g && st < 0) st = x; else if (!g && st >= 0) { if (st > len * 0.06 && x - 1 < len * 0.94) n++; st = -1; } } return n + 1; };
  return { cols:runs(col, w, h), rows:runs(row, h, w) };
}
const isGreen = (d, i) => d[i + 1] > 150 && d[i + 1] - Math.max(d[i], d[i + 2]) > 60;
// Gemini sometimes boxes each panel in a black (or white) frame: anything outside a frame line is made green
function unframe(d, w, h) {
  const dark = i => d[i] + d[i + 1] + d[i + 2] < 160 || (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225);
  const lim = x => Math.round(x * 0.14);
  const colLine = x => { let n = 0; for (let y = 0; y < h; y++) if (dark((y * w + x) * 4)) n++; return n / h > 0.6; };
  const rowLine = y => { let n = 0; for (let x = 0; x < w; x++) if (dark((y * w + x) * 4)) n++; return n / w > 0.6; };
  const paint = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; d[i] = 0; d[i + 1] = 255; d[i + 2] = 0; } };
  // a frame is a line near the edge with green just inside it
  const colGreen = x => { let n = 0; for (let y = 0; y < h; y++) if (isGreen(d, (y * w + x) * 4)) n++; return n / h; };
  const rowGreen = y => { let n = 0; for (let x = 0; x < w; x++) if (isGreen(d, (y * w + x) * 4)) n++; return n / w; };
  // a thin line close to the edge, with mostly green just inside it
  const findIn = (len, line, green, from, step) => { let first = -1, last = -1;
    for (let k = 0; k < lim(len); k++) { const x = from + k * step;
      if (line(x)) { if (first < 0) first = x; last = x; }
      else if (last >= 0) return Math.abs(last - first) + 1 <= Math.max(14, len * 0.03) && green(x) > 0.3 ? last : -1; }
    return -1; };
  const L = findIn(w, colLine, colGreen, 0, 1), R = findIn(w, colLine, colGreen, w - 1, -1), T = findIn(h, rowLine, rowGreen, 0, 1), B = findIn(h, rowLine, rowGreen, h - 1, -1);
  if (L >= 0) paint(0, 0, L + 3, h); if (R >= 0) paint(R - 2, 0, w, h); if (T >= 0) paint(0, 0, w, T + 3); if (B >= 0) paint(0, B - 2, w, h);
}
export function splitSheet(img, cols, rows) {
  const w = img.naturalWidth, h = img.naturalHeight, c = cv(w, h); g2(c).drawImage(img, 0, 0);
  const d = g2(c).getImageData(0, 0, w, h).data;
  const colG = new Float32Array(w), rowG = new Float32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, r = d[i], gg = d[i + 1], b = d[i + 2];
    if (isGreen(d, i)) { colG[x]++; rowG[y]++; }
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
    unframe(q, p.width, p.height);
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

// where two lined-up pictures differ, forgiving outlines that sit a pixel or two apart (a pixel only counts as changed
// when nothing of the same colour is within r pixels in the other picture)
function tolDiff(a, b, r = 2) {
  const m = new Uint8Array(MW), same = (i, j) => { const p = i * 4, q = j * 4, ap = a[p + 3] > 128, bq = b[q + 3] > 128;
    return ap === bq && (!ap || Math.abs(a[p] - b[q]) + Math.abs(a[p + 1] - b[q + 1]) + Math.abs(a[p + 2] - b[q + 2]) <= 95); };
  const sameR = (i, j) => same(j, i);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (a[i * 4 + 3] <= 128 && b[i * 4 + 3] <= 128) continue;
    if (same(i, i)) continue;
    let fa = false, fb = false;
    for (let dy = -r; dy <= r && !(fa && fb); dy++) { const yy = y + dy; if (yy < 0 || yy >= W) continue;
      for (let dx = -r; dx <= r; dx++) { const xx = x + dx; if (xx < 0 || xx >= W) continue; const j = yy * W + xx;
        if (!fa && same(i, j)) fa = true; if (!fb && sameR(i, j)) fb = true; if (fa && fb) break; } }
    if (!fa || !fb) m[i] = 1;
  }
  return m;
}
// line a placed panel up again on just one part of the picture (the face), where Gemini may have nudged the head
function refine(x, od, win, range = 0.05) {
  const [x0, y0, x1, y1] = win, oi = boxMax(inkOf(od, W), 1, W);
  let on = 0; for (let y = y0; y <= y1; y++) for (let xx = x0; xx <= x1; xx++) on += oi[y * W + xx];
  const score = (pi, dx, dy) => { let o = 0, pn = 0;
    for (let y = y0; y <= y1; y++) { const sy = y - dy; if (sy < 0 || sy >= W) continue;
      for (let xx = x0; xx <= x1; xx++) { const sx = xx - dx; if (sx < 0 || sx >= W) continue; const v = pi[sy * W + sx]; pn += v; o += v & oi[y * W + xx]; } }
    return 2 * o / Math.max(1, on + pn); };
  const cx = (x0 + x1) / 2 * N / W, cy = (y0 + y1) / 2 * N / W, k = N / W;
  let best = { sc:-1 };
  for (let ds = -range; ds <= range + 0.0001; ds += range / 4) {
    const T = { s:x.T.s * (1 + ds), x:(x.T.x - cx) * (1 + ds) + cx, y:(x.T.y - cy) * (1 + ds) + cy }, pi = inkOf(pixels(render(x.p, T, W)), W);
    let b = { sc:-1 };
    for (let dy = -14; dy <= 14; dy += 2) for (let dx = -14; dx <= 14; dx += 2) { const sc = score(pi, dx, dy); if (sc > b.sc) b = { sc, dx, dy }; }
    for (let dy = b.dy - 1; dy <= b.dy + 1; dy++) for (let dx = b.dx - 1; dx <= b.dx + 1; dx++) { const sc = score(pi, dx, dy); if (sc > b.sc) b = { sc, dx, dy }; }
    if (b.sc > best.sc) best = { sc:b.sc, T:{ s:T.s, x:T.x + b.dx * k, y:T.y + b.dy * k } };
  }
  const before = score(inkOf(x.small, W), 0, 0);
  if (best.sc > before) { x.T = best.T; x.full = placed(x.p, x.T); x.small = pixels(x.full, W, W); x.cov = coverOf(x); }
  return Math.max(best.sc, before);
}
// where a placed panel has any drawing at all (outside its own edges nothing can be compared)
function coverOf(x) { const c = cv(W, W), g = g2(c), k = W / N; g.setTransform(x.T.s * k, 0, 0, x.T.s * k, x.T.x * k, x.T.y * k); g.fillRect(2, 2, x.p.width - 4, x.p.height - 4);
  const d = g.getImageData(0, 0, W, W).data, m = new Uint8Array(MW); for (let i = 0; i < MW; i++) m[i] = d[i * 4 + 3] > 200 ? 1 : 0; return boxMax(inv(m), 3, W).map(v => v ? 0 : 1); }
const pdiff = (x, r) => and(tolDiff(x.small, r.small), and(x.cov, r.cov));
function winOf(m, pad) { const b = bboxOf(m, W); if (b[2] < b[0]) return null; const w = b[2] - b[0], h = b[3] - b[1], p = Math.max(pad, 0.45 * Math.max(w, h));
  return [Math.max(0, Math.round(b[0] - p)), Math.max(0, Math.round(b[1] - p)), Math.min(W - 1, Math.round(b[2] + p)), Math.min(W - 1, Math.round(b[3] + p))]; }
// the shared core: the biggest area that changes across panels (plus pieces right next to it), holes filled
function mainCore(m, reach = 70, seed = null) {
  const { lab, comps } = labels(close_(m, 6)); if (!comps.length) return m;
  let big = comps.reduce((a, b) => b.n > a.n ? b : a);
  if (seed) { const sb = bboxOf(seed, W); if (sb[2] >= sb[0]) { const sx = (sb[0] + sb[2]) / 2, sy = (sb[1] + sb[3]) / 2, inS = new Map();
    for (let i = 0; i < MW; i++) if (lab[i] && seed[i]) inS.set(lab[i], (inS.get(lab[i]) || 0) + 1);
    const cand = comps.filter(c => c.n > 20 && inS.has(c.id)); if (cand.length) big = cand.reduce((a, b) => inS.get(b.id) > inS.get(a.id) ? b : a);
    else big = comps.filter(c => c.n > 20).reduce((a, b) => Math.hypot(b.cx - sx, b.cy - sy) < Math.hypot(a.cx - sx, a.cy - sy) ? b : a, big); } }
  const keep = new Set(comps.filter(c => c.n > 20 && Math.hypot(c.cx - big.cx, c.cy - big.cy) < reach).map(c => c.id));
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
// Gemini sometimes makes 6 eye panels (a 2x3 grid with the open eyes twice): keep the 5 that differ most
export function pickPanels(panels, want) {
  const sig = p => { const c = cv(48, 48); g2(c).drawImage(p, 0, 0, 48, 48); return g2(c).getImageData(0, 0, 48, 48).data; };
  const ps = panels.map(p => ({ p, s:sig(p) })), d = (a, b) => { let t = 0; for (let i = 0; i < a.length; i++) t += Math.abs(a[i] - b[i]); return t; };
  while (ps.length > want) { let k = 1, best = Infinity; for (let i = 1; i < ps.length; i++) { const v = d(ps[i].s, ps[0].s); if (v < best) { best = v; k = i; } } ps.splice(k, 1); }
  return ps.map(x => x.p);
}

// A mouth shape that's missing borrows the closest one that worked, so one bad panel never stops a build
const STAND_IN = { 'M/B/P':['F/V', 'frown'], 'slightly open':['AH', 'L', 'EE'], 'AH':['O', 'slightly open'], 'EE':['slightly open', 'AH'], 'O':['OO', 'AH'],
  'OO':['O', 'M/B/P'], 'F/V':['M/B/P', 'frown'], 'L':['slightly open', 'AH'], 'frown':['M/B/P', 'F/V'] };

// sheets: { s1:[6 canvases], s2:[4], eyes:[5|3] | null }. onStep(text) reports progress.
// Returns ok (all good), usable (can go live as it is, with stand-ins), problems [{ text, sheet, hard }].
export async function build(orig, sheets, onStep = () => {}) {
  const problems = [], P = (text, sheet, hard = false) => problems.push({ text, sheet, hard });
  const names1 = ['rest', 'M/B/P', 'slightly open', 'AH', 'EE', 'O'], names2 = ['F/V', 'L', 'frown', 'OO'], namesE = ['open', 'angry', 'surprised', 'half-closed', 'closed'];
  // Gemini sometimes adds a 6th eye face (the open eyes twice): drop the one that differs least from the open eyes, once lined up
  let eyesIn = sheets.eyes;
  if (eyesIn && eyesIn.length > 5) {
    onStep('Sorting the eye faces…'); await tick();
    const od0 = pixels(orig, W, W), sb = bboxOf(silOf(od0, W), W), head = [sb[0], sb[1], sb[2], Math.round(sb[1] + (sb[3] - sb[1]) * 0.6)];   // the head: top of the picture
    const xs = eyesIn.map(p => { const a = align(p, orig), x = { p, T:a.T }; x.full = placed(p, x.T); x.small = pixels(x.full, W, W); x.cov = coverOf(x); refine(x, od0, head, 0.12); refine(x, od0, head, 0.03); return x; });
    // (measured by its biggest solid change: a real new look changes one area a lot, a redraw only wobbles the lines)
    const hm = new Uint8Array(MW); for (let y = head[1]; y <= head[3]; y++) for (let x = head[0]; x <= head[2]; x++) hm[y * W + x] = 1;
    const solid = D => { const { comps } = labels(open_(and(D, hm), 1)); return comps.reduce((m, c) => Math.max(m, c.n), 0); };   // only the head counts
    while (xs.length > 5) { let k = 1, best = Infinity; for (let i = 1; i < xs.length; i++) { const n = solid(pdiff(xs[i], xs[0])); if (n < best) { best = n; k = i; } } xs.splice(k, 1); }
    eyesIn = xs.map(x => x.p);
  }
  const all = [...sheets.s1.map((p, i) => ({ p, sheet:1, i, name:names1[i] })), ...sheets.s2.map((p, i) => ({ p, sheet:2, i, name:names2[i] })),
    ...(eyesIn || []).map((p, i) => ({ p, sheet:3, i, name:(eyesIn.length === 3 ? ['open', 'half-closed', 'closed'] : namesE)[i] }))];
  let worst = 1;
  for (const x of all) {
    onStep(`Lining up sheet ${x.sheet}, ${x.name}…`); await tick();
    const a = align(x.p, orig); x.T = a.T; x.iou = a.iou; worst = Math.min(worst, a.iou);
    x.full = placed(x.p, x.T); x.small = pixels(x.full, W, W); x.cov = coverOf(x);
  }
  const od = pixels(orig, W, W), osil = silOf(od, W);
  onStep('Finding the mouth…'); await tick();
  const s1 = all.filter(x => x.sheet === 1), s2 = all.filter(x => x.sheet === 2), ref = s1[0], talk = [...s1.slice(1), ...s2];
  // the mouth is what changes in most of sheet 1's panels. First a rough find from the panels that lined up best
  // (Gemini often draws a row a little bigger or nudges the head), then every panel is lined up again on the face
  // around it, and the mouth is found again.
  const findCore = (xs, need, base) => { const h = new Uint8Array(MW); for (const x of xs) { const D = pdiff(x, base); for (let i = 0; i < MW; i++) h[i] += D[i]; }
    return mainCore(and(open_(Uint8Array.from(h, v => v >= need ? 1 : 0), 1), osil)); };
  const ranked = [...talk].sort((a, b) => b.iou - a.iou), top = ranked.filter(x => x.iou >= ranked[0].iou - 0.02).slice(0, 4);
  const rough = findCore(top.length >= 2 ? top : ranked.slice(0, 2), top.length >= 3 ? 2 : 1, ref), win = winOf(rough, 30);
  if (win) { onStep('Lining up the face…'); await tick(); for (const x of [ref, ...talk]) x.fit = refine(x, od, win); }
  if (ref.iou < 0.8 || (win && ref.fit < 0.45)) P('Sheet 1\'s first panel (the rest mouth) doesn\'t line up with your picture.', 1, true);
  const D1 = s1.slice(1).map(x => pdiff(x, ref)), heat = new Uint8Array(MW);
  for (const D of D1) for (let i = 0; i < MW; i++) heat[i] += D[i];
  const core = mainCore(and(open_(Uint8Array.from(heat, v => v >= 3 ? 1 : 0), 1), osil), 70, rough);
  if (count(core) < 30) P('The mouth couldn\'t be found: sheet 1\'s panels don\'t change around the mouth.', 1, true);
  const M = {};
  s1.slice(1).forEach((x, k) => { M[x.name] = nearCore(D1[k], core); });
  for (const x of s2) M[x.name] = nearCore(pdiff(x, ref), core);
  // a talking panel is bad if it doesn't line up on the face or doesn't change the mouth
  const bad = new Set();
  for (const x of talk) if (x.iou < 0.8 || (win && x.fit < 0.45) || count(M[x.name]) < 40) bad.add(x.name);
  let zone = new Uint8Array(MW);
  for (const k in M) if (!bad.has(k)) zone = or(zone, M[k]);
  zone = dilate(zone, 3);
  const silN = count(osil), zN = count(zone);
  if (sheets.debug) Object.assign(sheets.debug, { heat, core, zone, D1, osil, M, rough, win });
  if (zN > silN * 0.35) P('Too much of the face changes between the mouth panels (Gemini redrew more than the mouth).', 1, true);
  if (bad.size > 4) P(`${bad.size} of the 9 talking mouths didn't come out right.`, 1, true);
  // mouth frames: the original picture, with the mouth area taken from each panel (colour-matched); a bad one borrows a stand-in
  const ring = and(and(dilate(zone, 8), inv(zone)), osil), alpha = softMask(zone), swapped = [];
  const order = [null, 'M/B/P', 'slightly open', 'AH', 'EE', 'O', 'OO', 'F/V', 'L', 'frown'], frames = [orig];
  for (let k = 1; k < 10; k++) {
    onStep(`Building mouth ${k + 1} of 10…`); await tick();
    let name = order[k];
    if (bad.has(name)) { const sub = STAND_IN[name].find(n => !bad.has(n)); swapped.push({ name, sub:sub || 'rest', sheet:all.find(y => y.name === name).sheet }); name = sub; }
    const x = name ? all.find(y => y.sheet < 3 && y.name === name) : null;
    frames.push(x ? compose(orig, x.full, alpha, gains(od, x.small, ring)) : orig);
  }
  for (const w of swapped) P(`Sheet ${w.sheet}'s ${w.name} mouth didn't come out right, so it uses the ${w.sub} mouth for now.`, w.sheet);
  // eyes
  let eyes = null, ezone = null;
  if (eyesIn && (eyesIn.length === 5 || eyesIn.length === 3)) {
    onStep('Building the blink…'); await tick();
    const e = all.filter(x => x.sheet === 3), notMouth = inv(dilate(core, 8));   // the mouth area may reach the eyes; the eye layers sit on top
    const need = e.length >= 5 ? 2 : 1;
    // the eyes are in the head (the top 60% of the Nibble): line every face up there first, and look only there
    const sb = bboxOf(osil, W), head = [sb[0], sb[1], sb[2], Math.round(sb[1] + (sb[3] - sb[1]) * 0.6)], hm = new Uint8Array(MW);
    for (let y = head[1]; y <= head[3]; y++) for (let x = head[0]; x <= head[2]; x++) hm[y * W + x] = 1;
    for (const x of e) x.fit = refine(x, od, head, 0.06);
    const eyeCore = () => { const eh = new Uint8Array(MW), DE = e.slice(1).map(x => pdiff(x, e[0])); for (const D of DE) for (let i = 0; i < MW; i++) eh[i] += D[i];
      return { DE, ecore:mainCore(and(and(and(open_(Uint8Array.from(eh, v => v >= need ? 1 : 0), 1), osil), notMouth), hm), 150) }; };   // two eyes: both count
    let { DE, ecore } = eyeCore();
    const ewin = winOf(ecore, 30);
    if (ewin && count(ecore) >= 30) { for (const x of e) x.fit = refine(x, od, ewin); ({ DE, ecore } = eyeCore()); }
    if (count(ecore) < 30) P('The eyes couldn\'t be found on the eye sheet, so it goes live without the blink.', 3);
    else {
      const EM = DE.map(D => and(nearCore(D, ecore, 36), notMouth));
      const ebad = e.slice(1).map((x, k) => x.iou < 0.8 || (x.fit != null && x.fit < 0.4) || count(EM[k]) < 30);
      // each eye layer covers the whole eye area (closed eyes must hide the open ones completely)
      const eall = fillHoles(close_(EM.filter((m, k) => !ebad[k]).reduce(or, new Uint8Array(MW)), 6)), full = and(dilate(eall, 7), notMouth);
      ezone = full;
      const ering = and(and(dilate(ezone, 8), inv(ezone)), osil), ea = softMask(ezone);
      const layers = e.slice(1).map((x, k) => ebad[k] ? null : compose(orig, x.full, ea, gains(od, x.small, ering), true));
      const slots = layers.length === 4 ? [null, ...layers] : [null, null, null, ...layers];   // filter slots: 1 angry, 2 surprised, 3 half, 4 closed
      if (!slots[4]) { P('The closed eyes didn\'t come out right, so it goes live without the blink.', 3); ezone = null; }
      else { if (!slots[3]) slots[3] = slots[4];   // a blink can skip the half-closed step
        e.slice(1).forEach((x, k) => { if (ebad[k] && x.name !== 'closed') P(`The eye sheet's ${x.name} eyes didn't come out right, so ${x.name === 'half-closed' ? 'the blink skips that step' : 'that look is left out'}.`, 3); });
        eyes = slots; }
    }
  } else if (eyesIn) P('The eye sheet didn\'t have 5 faces in it, so it goes live without the blink.', 3);
  // where the face is, for the picker's thumbnail
  const fz = ezone ? or(zone, ezone) : zone, fb = bboxOf(fz, W);
  const face = fb[2] >= fb[0] ? [Math.round((fb[0] + fb[2]) / 2 * N / W), Math.round((fb[1] + fb[3]) / 2 * N / W), 1.35] : [500, 500, 1.35];
  const hard = problems.some(p => p.hard);
  return { ok:problems.length === 0, usable:!hard, problems, score:+worst.toFixed(3), frames, eyes, face, mouthBox:boxOf(zone), eyeBox:ezone ? boxOf(ezone) : null,
    grades:all.map(x => ({ sheet:x.sheet, name:x.name, iou:+x.iou.toFixed(3), fit:x.fit != null ? +x.fit.toFixed(3) : null })) };
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
  const layout = { at:res.face, mb:mb.map(Math.round), eb:eb.map(Math.round) }, tr = res.traits || {};
  if (tr.halo) { files.h0 = await blob(tr.halo.img); layout.halo = { box:tr.halo.box.map(Math.round), centre:tr.halo.centre.map(Math.round) }; }
  if (tr.fire) { files.fc = await blob(tr.fire.clip); layout.fire = { xf:tr.fire.xf.map(v => +v.toFixed(4)) }; }
  if (tr.jig) { for (let k = 0; k < tr.jig.length; k++) files['n' + k] = await blob(tr.jigImgs[k]); layout.jig = tr.jig; }
  return { files, ext, layout };
}

// ---------- traits that move on their own: a floating halo (springy wobble), fire eyes (flicker), a Cock's bare-chest
// nipples (springy bounce). Found in the picture, lifted onto their own layers, and the art underneath filled in.
// Works on the full-size canvases in place (the picture and every mouth frame) and returns what it found.
// hints (from the token's on-chain traits, when known): { halo:true|false, fire:true|false } skip a search the token can't need
export function findTraits(orig, res, kind, bgHex, hints = {}) {
  const d = pixels(orig), A = i => d[i * 4 + 3], R = i => d[i * 4], G = i => d[i * 4 + 1], B = i => d[i * 4 + 2];
  const out = {}, NN = N * N, lab = new Int32Array(NN), comps = [], q = new Int32Array(NN);
  // pieces of the picture that don't touch each other
  for (let s = 0; s < NN; s++) {
    if (A(s) < 128 || lab[s]) continue;
    const id = comps.length + 1; let qh = 0, qt = 0; q[qt++] = s; lab[s] = id; let n = 0, x0 = N, y0 = N, x1 = 0, y1 = 0, gold = 0;
    while (qh < qt) { const i = q[qh++], x = i % N, y = (i / N) | 0; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (R(i) > 200 && G(i) > 150 && B(i) < 120) gold++;
      for (const j of [x > 0 ? i - 1 : -1, x < N - 1 ? i + 1 : -1, y > 0 ? i - N : -1, y < N - 1 ? i + N : -1]) if (j >= 0 && !lab[j] && A(j) >= 128) { lab[j] = id; q[qt++] = j; } }
    comps.push({ id, n, box:[x0, y0, x1, y1], gold });
  }
  const body = comps.reduce((a, b) => b.n > a.n ? b : a, { n:0 });
  // halo: a separate, mostly gold piece floating above the head
  const halos = hints.halo === false ? [] : comps.filter(c => c !== body && c.n > 1500 && c.box[3] < body.box[1] + (body.box[3] - body.box[1]) * 0.45 && c.gold / c.n > 0.35);
  if (halos.length) {
    const ids = new Set(halos.map(c => c.id)), x0 = Math.min(...halos.map(c => c.box[0])) - 3, y0 = Math.min(...halos.map(c => c.box[1])) - 3,
      x1 = Math.max(...halos.map(c => c.box[2])) + 4, y1 = Math.max(...halos.map(c => c.box[3])) + 4;
    const bg = [1, 3, 5].map(k => parseInt(bgHex.slice(k, k + 2), 16));
    const img = cv(x1 - x0, y1 - y0), id = g2(img).createImageData(img.width, img.height);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * N + x, o = ((y - y0) * img.width + (x - x0)) * 4;
      // the halo's pixels, but not the sky showing through its ring
      const sky = Math.abs(R(i) - bg[0]) + Math.abs(G(i) - bg[1]) + Math.abs(B(i) - bg[2]) < 60;
      if ((ids.has(lab[i]) || (A(i) > 20 && lab[i] !== body.id)) && !sky) { for (let c = 0; c < 4; c++) id.data[o + c] = d[i * 4 + c]; }
    }
    g2(img).putImageData(id, 0, 0);
    out.halo = { img, box:[x0, y0, x1 - x0, y1 - y0], centre:[(x0 + x1) / 2, (y0 + y1) / 2] };
    for (const c of [orig, ...res.frames.slice(1)]) g2(c).clearRect(x0, y0, x1 - x0, y1 - y0);
  }
  // fire eyes: two flame shapes (yellow with an orange rim and a pale centre, no dark pupil) in the upper face
  const isFlame = i => A(i) > 200 && ((R(i) > 200 && G(i) > 140 && B(i) < 130) || (R(i) > 230 && G(i) > 210 && B(i) > 90 && B(i) < 200));
  const top = body.box[1], hgt = body.box[3] - body.box[1], fl = new Uint8Array(NN);
  if (hints.fire !== false) for (let y = top; y < top + hgt * 0.62; y++) for (let x = 0; x < N; x++) { const i = y * N + x; if (lab[i] === body.id && isFlame(i)) fl[i] = 1; }
  const fcomps = []; const seen = new Uint8Array(NN);
  for (let s = 0; s < NN; s++) {
    if (!fl[s] || seen[s]) continue; let qh = 0, qt = 0; q[qt++] = s; seen[s] = 1; let n = 0, x0 = N, y0 = N, x1 = 0, y1 = 0, pale = 0; const px = [];
    while (qh < qt) { const i = q[qh++], x = i % N, y = (i / N) | 0; n++; px.push(i); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (R(i) > 230 && G(i) > 215 && B(i) > 90) pale++;
      for (const j of [i - 1, i + 1, i - N, i + N]) if (j >= 0 && j < NN && fl[j] && !seen[j]) { seen[j] = 1; q[qt++] = j; } }
    if (n < 2500) continue;
    let dark = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * N + x; if (A(i) > 200 && R(i) + G(i) + B(i) < 150) dark++; }
    fcomps.push({ n, box:[x0, y0, x1, y1], pale:pale / n, dark:dark / ((x1 - x0 + 1) * (y1 - y0 + 1)), tall:(y1 - y0) / Math.max(1, x1 - x0), px });
  }
  const flames = fcomps.filter(c => c.pale > 0.08 && c.dark < 0.12 && c.tall > 0.95).sort((a, b) => b.n - a.n).slice(0, 2);
  if (flames.length === 2 && Math.abs(flames[0].box[1] - flames[1].box[1]) < 160) {
    const x0 = Math.min(flames[0].box[0], flames[1].box[0]), y0 = Math.min(flames[0].box[1], flames[1].box[1]), x1 = Math.max(flames[0].box[2], flames[1].box[2]), y1 = Math.max(flames[0].box[3], flames[1].box[3]);
    // the reference flames (Cock #8212's flicker frames) cover 351,313 to 746,611 of their picture
    const sx = (x1 - x0) / 395, sy = (y1 - y0) / 298;
    // the fur around the flames (what shows where a flicker pulls in)
    const m = new Uint8Array(NN); for (const f of flames) for (const i of f.px) m[i] = 1;
    const near = (i, r) => { const x = i % N, y = (i / N) | 0; for (let dy = -r; dy <= r; dy += 2) for (let dx = -r; dx <= r; dx += 2) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < N && yy < N && m[yy * N + xx]) return true; } return false; };
    const ring = []; for (let y = y0 - 16; y <= y1 + 16; y += 2) for (let x = x0 - 16; x <= x1 + 16; x += 2) { if (x < 0 || y < 0 || x >= N || y >= N) continue; const i = y * N + x;
      if (!m[i] && A(i) > 200 && R(i) + G(i) + B(i) > 120 && !isFlame(i) && near(i, 12)) ring.push([R(i), G(i), B(i)]); }
    const med = c => { const v = ring.map(p => p[c]).sort((a, b) => a - b); return v[v.length >> 1] || 0; }, fur = [med(0), med(1), med(2)];
    const furLike = i => Math.abs(R(i) - fur[0]) + Math.abs(G(i) - fur[1]) + Math.abs(B(i) - fur[2]) < 70;
    // the flicker shows over the flames and the fur right around them, never over what's in front (a beak, ink lines)
    const clip = cv(N, N), cid = g2(clip).createImageData(N, N), r = 7;
    for (let y = y0 - r; y <= y1 + r; y++) for (let x = x0 - r; x <= x1 + r; x++) { if (x < 0 || y < 0 || x >= N || y >= N) continue; const i = y * N + x;
      if (m[i] || (A(i) > 200 && (isFlame(i) || furLike(i)) && near(i, r))) cid.data[i * 4 + 3] = 255; }
    g2(clip).putImageData(cid, 0, 0);
    // under the flicker: the flames painted over with that fur (in the picture and every mouth frame), so a flame that
    // pulls in shows fur, not the still drawing behind it
    for (const c of [orig, ...res.frames.slice(1)]) {
      const cg = g2(c), w = x1 - x0 + 1, h = y1 - y0 + 1, cd = cg.getImageData(x0, y0, w, h), p = cd.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y + y0) * N + x + x0, k = (y * w + x) * 4;
        const fc = p[k + 3] > 200 && ((p[k] > 200 && p[k + 1] > 140 && p[k + 2] < 200) || (p[k] > 180 && p[k] - p[k + 2] > 90 && p[k + 1] > 70));   // still flame (yellow, orange rim) in this frame
        if ((m[i] || near(i, 9)) && fc) { p[k] = fur[0]; p[k + 1] = fur[1]; p[k + 2] = fur[2]; } }
      cg.putImageData(cd, x0, y0);
    }
    res.eyes = null;   // fire eyes don't blink
    out.fire = { xf:[sx, sy, x0 - 351 * sx, y0 - 313 * sy], clip };
  }
  // a Cock's nipples: two pink round shapes on the lower chest, each with its ink outline
  if (/cock/i.test(kind)) {
    const pk = new Uint8Array(NN);
    for (let y = top + hgt * 0.55; y < N; y++) for (let x = 0; x < N; x++) { const i = (y | 0) * N + x; if (A(i) > 200 && R(i) > 200 && G(i) > 110 && G(i) < 200 && B(i) > 140 && B(i) < 230 && R(i) - G(i) > 40) pk[i] = 1; }
    const blobs = []; const sn = new Uint8Array(NN);
    for (let s = 0; s < NN; s++) {
      if (!pk[s] || sn[s]) continue; let qh = 0, qt = 0; q[qt++] = s; sn[s] = 1; let n = 0, x0 = N, y0 = N, x1 = 0, y1 = 0;
      while (qh < qt) { const i = q[qh++], x = i % N, y = (i / N) | 0; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const j of [i - 1, i + 1, i - N, i + N]) if (j >= 0 && j < NN && pk[j] && !sn[j]) { sn[j] = 1; q[qt++] = j; } }
      const asp = (x1 - x0 + 1) / (y1 - y0 + 1);
      if (n > 700 && n < 9000 && asp > 0.6 && asp < 1.8) blobs.push({ n, box:[x0, y0, x1, y1], cy:(y0 + y1) / 2, cx:(x0 + x1) / 2 });
    }
    blobs.sort((a, b) => b.n - a.n);
    const pair = blobs.length >= 2 && Math.abs(blobs[0].cy - blobs[1].cy) < 80 && Math.abs(blobs[0].cx - blobs[1].cx) > 120 && blobs[1].n > blobs[0].n * 0.5 ? blobs.slice(0, 2).sort((a, b) => a.cx - b.cx) : null;
    if (pair) {
      out.jig = []; out.jigImgs = [];
      for (const b of pair) {
        // the nipple with its outline: pink plus the dark ink touching it, a few pixels around
        const pad = 14, x0 = Math.max(0, b.box[0] - pad), y0 = Math.max(0, b.box[1] - pad), x1 = Math.min(N - 1, b.box[2] + pad), y1 = Math.min(N - 1, b.box[3] + pad), w = x1 - x0 + 1, h = y1 - y0 + 1;
        const m = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y + y0) * N + x + x0; if (pk[i]) m[y * w + x] = 1; }
        // grow through dark ink next to the pink, then fill the shape and add 2 px
        for (let it = 0; it < 10; it++) { const nm = m.slice(); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const k = y * w + x; if (m[k]) continue; const i = (y + y0) * N + x + x0;
          if ((m[k - 1] || m[k + 1] || m[k - w] || m[k + w]) && (R(i) + G(i) + B(i) < 240 || pk[i])) nm[k] = 1; } m.set(nm); }
        const grow = r => { for (let it = 0; it < r; it++) { const nm = m.slice(); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const k = y * w + x; if (!m[k] && (m[k - 1] || m[k + 1] || m[k - w] || m[k + w])) nm[k] = 1; } m.set(nm); } };
        grow(2);
        const img = cv(w, h), id = g2(img).createImageData(w, h);
        for (let k = 0; k < w * h; k++) if (m[k]) { const i = ((k / w | 0) + y0) * N + (k % w) + x0; for (let c = 0; c < 4; c++) id.data[k * 4 + c] = d[i * 4 + c]; }
        g2(img).putImageData(id, 0, 0);
        out.jig.push([x0, y0, w, h]); out.jigImgs.push(img);
        // fill underneath (in the picture and every mouth frame) from the chest around it
        grow(3);
        for (const c of [orig, ...res.frames.slice(1)]) {
          const cg = g2(c), cd = cg.getImageData(x0, y0, w, h), p = cd.data, ring = [];
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = y * w + x; if (m[k]) continue;
            const near = (y > 0 && m[k - w]) || (y < h - 1 && m[k + w]) || (x > 0 && m[k - 1]) || (x < w - 1 && m[k + 1]);
            if (p[k * 4 + 3] > 200 && Math.max(p[k * 4], p[k * 4 + 1], p[k * 4 + 2]) > 55 && (near || (x % 3 === 0 && y % 3 === 0))) ring.push([x, y, p[k * 4], p[k * 4 + 1], p[k * 4 + 2]]); }
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = y * w + x; if (!m[k]) continue;
            let sr = 0, sg = 0, sb = 0, sw = 0; for (const [rx, ry, r0, g0, b0] of ring) { const dd = (rx - x) ** 2 + (ry - y) ** 2, wt = 1 / ((dd + 1) * (dd + 1)); sr += r0 * wt; sg += g0 * wt; sb += b0 * wt; sw += wt; }
            if (sw) { p[k * 4] = sr / sw; p[k * 4 + 1] = sg / sw; p[k * 4 + 2] = sb / sw; p[k * 4 + 3] = 255; } }
          cg.putImageData(cd, x0, y0);
        }
      }
    }
  }
  return out;
}
