// fx.js — traits that move on their own, worked out from the Nibble's own picture and its traits:
//   bees buzz around a bee-hive bear, coins fountain out of slot-machine eyes, light-magic rays pulse and stream,
//   steam puffs out of steaming ears, propeller hats spin, dizzy (spiral) eyes spin,
//   robot lights blink and anatomy hearts beat (hand-placed for the built-in robots and dissections).
// prepareFx(base, traits, hand) reads the 1000px picture once and returns the effects plus the pixels they own
// (eraseMask: those get cleared from the still picture, so a moving piece never leaves a copy behind).
// drawFx(ctx, fx, t, x, y, size) draws them every frame.

const N = 1000;
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// hand-placed parts for the built-in specials (1000px art): robot lights [x, y, radius, colour, how close to the colour (default 170)] and dissection hearts
export const FX_HAND = {
  546:  { lights:[[560, 505, 150, '#ff4f8b']] },                                       // the pink visor
  2775: { lights:[[402, 128, 34, '#ffffff'], [548, 88, 34, '#ffffff'], [600, 420, 250, '#3cff5a']] },   // antenna bulbs, the screen face
  3113: { lights:[[480, 430, 90, '#ffd23f'], [705, 405, 70, '#ffd23f']] },              // yellow eyes
  3159: { lights:[[572, 150, 30, '#ffffff'], [570, 480, 130, '#38f800', 80]] },         // antenna ball, the two green pupils (not the round shines on them)
  3295: { lights:[[540, 450, 130, '#ffd23f'], [560, 330, 45, '#a24bff']] },              // yellow eyes, purple gem
  3543: { lights:[[560, 330, 150, '#3cff5a']] },                                        // green visor
  5900: { lights:[[500, 215, 45, '#ff3b30'], [150, 240, 26, '#ffffff'], [560, 400, 150, '#ffd23f']] },   // red antenna light, eyes
  8482: { lights:[[602, 168, 30, '#ffffff'], [560, 440, 120, '#3cff5a'], [470, 900, 110, '#3cff5a']] },  // antenna, visor, chest screen
  794:  { heart:true }, 1998:{ heart:true }, 3538:{ heart:true }, 5807:{ heart:true },
  7192: { heart:true }, 7813:{ heart:true }, 8617:{ heart:true }, 8637:{ heart:{ x1:530 } },   // (8637: the wattle beside the heart is red too, and stays still)
};
// where steam comes out of the ears, by kind: [x, y, direction x, direction y]
const STEAM = {
  Bear:  [[230, 275, -0.8, -0.6], [700, 235, 0.8, -0.7]],
  Gnome: [[205, 545, -1, -0.15], [780, 440, 1, -0.2]],
  Wolf:  [[245, 300, -0.85, -0.5], [720, 265, 0.75, -0.8]],
};

function pixelsOf(img) {
  const c = cv(N, N), g = c.getContext('2d', { willReadFrequently:true }); g.drawImage(img, 0, 0, N, N);
  return g.getImageData(0, 0, N, N).data;
}
// connected parts of a mask (4-neighbour), each with its pixel list, box and size
function parts(mask, minN = 1) {
  const lab = new Int32Array(N * N), out = [], q = new Int32Array(N * N);
  for (let s = 0; s < N * N; s++) {
    if (!mask[s] || lab[s]) continue;
    const id = out.length + 1; let h = 0, t = 0; q[t++] = s; lab[s] = id;
    let x0 = N, y0 = N, x1 = 0, y1 = 0; const px = [];
    while (h < t) { const i = q[h++], x = i % N, y = (i / N) | 0; px.push(i);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const j of [x > 0 ? i - 1 : -1, x < N - 1 ? i + 1 : -1, y > 0 ? i - N : -1, y < N - 1 ? i + N : -1]) if (j >= 0 && mask[j] && !lab[j]) { lab[j] = id; q[t++] = j; } }
    if (px.length >= minN) out.push({ px, box:[x0, y0, x1, y1], n:px.length });
  }
  return out;
}
const grow = (mask, r) => { let m = mask; for (let k = 0; k < r; k++) { const o = m.slice(); for (let i = 0; i < N * N; i++) if (!m[i]) { const x = i % N;
  if ((x > 0 && m[i - 1]) || (x < N - 1 && m[i + 1]) || (i >= N && m[i - N]) || (i < N * N - N && m[i + N])) o[i] = 1; } m = o; } return m; };
// a sprite of the picture's pixels under a mask, cut to a box
function sprite(d, mask, [x0, y0, x1, y1]) {
  const w = x1 - x0 + 1, h = y1 - y0 + 1, c = cv(w, h), g = c.getContext('2d'), im = g.createImageData(w, h);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * N + x; if (!mask[i]) continue; const o = ((y - y0) * w + (x - x0)) * 4, s = i * 4;
    im.data[o] = d[s]; im.data[o + 1] = d[s + 1]; im.data[o + 2] = d[s + 2]; im.data[o + 3] = d[s + 3]; }
  g.putImageData(im, 0, 0); return c;
}
const lum = (d, i) => 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2];
const hexRGB = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));

const WANTS = /Bee Hive|Light Magic|Steam|Propeller/i, EYES_WANT = /Slot Machine|Dizzy/i;
export const wantsFx = (traits = {}, hand = null) => !!hand || WANTS.test(String(traits.Accessory || '')) || EYES_WANT.test(String(traits.Eyes || ''));
export function prepareFx(base, traits = {}, hand = null) {
  if (!wantsFx(traits, hand)) return { list:[], erase:null };
  const d = pixelsOf(base), A = i => d[i * 4 + 3], fx = [], erase = new Uint8Array(N * N);
  const acc = String(traits.Accessory || ''), eyes = String(traits.Eyes || ''), kind = traits.Character;
  const solid = Uint8Array.from({ length:N * N }, (_, i) => A(i) > 40 ? 1 : 0);
  let top = 0; while (top < N && !solid.subarray(top * N, top * N + N).some(v => v)) top++;

  // bees: the little islands floating around a bee-hive bear (yellow with dark stripes), each buzzing on its own path
  if (/Bee Hive/i.test(acc)) {
    const ps = parts(solid, 200).sort((a, b) => b.n - a.n), bees = [];
    for (const p of ps.slice(1)) { if (p.n > 20000 || p.box[1] > 820) continue;
      let yel = 0, dark = 0; for (const i of p.px) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; if (r > 200 && g > 160 && b < 110) yel++; if (r + g + b < 160) dark++; }
      if (yel < p.n * 0.02 || dark < p.n * 0.2) continue;   // a bee: a little yellow, a lot of ink (stripes and outline), white wings
      const m = new Uint8Array(N * N); for (const i of p.px) { m[i] = 1; erase[i] = 1; }
      bees.push({ img:sprite(d, m, p.box), box:p.box, ph:Math.random() * 6.28, sp:0.8 + Math.random() * 0.5 }); }
    if (bees.length) fx.push({ type:'bees', bees });
  }
  // slot machine eyes: coins fountain out from above the reels (found by the red sevens)
  if (/Slot Machine/i.test(eyes)) {
    let n = 0, sx = 0, sy = 0, x0 = N, x1 = 0, y0 = N;
    for (let y = top; y < 700; y++) for (let x = 0; x < N; x++) { const i = y * N + x, r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      if (A(i) > 200 && r > 185 && g < 95 && b < 95) { n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; } }
    if (n > 200) fx.push({ type:'coins', at:[sx / n, sy / n], w:Math.max(60, x1 - x0), coins:[], next:0 });   // out of the reels themselves
  }
  // light magic: the rays from the star on the hat glow and pulse, with light streaming out along them
  if (/Light Magic/i.test(acc)) {
    const ox = 540, oy = 185, m = new Uint8Array(N * N); let n = 0;
    for (let y = 0; y < 640; y++) for (let x = 0; x < N; x++) { const i = y * N + x; if (A(i) < 200) continue;
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], dist = Math.hypot(x - ox, y - oy);
      if (((x - 540) / 235) ** 2 + ((y - 310) / 150) ** 2 < 1) continue;   // not the hat itself, only the rays leaving it
      if (dist > 110 && ((r > 232 && g > 226 && b > 170) || (r > 235 && g > 200 && b < 120))) { m[i] = 1; n++; } }
    if (n > 3000) fx.push({ type:'rays', o:[ox, oy], mask:sprite(d, m, [0, 0, N - 1, 639]), glow:null });
  }
  // steam: the picture's own steam clouds (off-white, by the ears, open to the background) puff in and out and blow off
  // copies of themselves that drift away and fade; its little bubbles float off and come back
  if (/Steam/i.test(acc)) {
    const ears = STEAM[kind] || [[220, 300], [760, 280]], light = new Uint8Array(N * N);
    // the background: see-through, or (a picture that keeps its backdrop) the colour in its top corners
    const bgc = [0, N - 1].map(x => [d[x * 4], d[x * 4 + 1], d[x * 4 + 2], A(x)]), isBg = i => A(i) < 40 || bgc.some(c => c[3] > 200 && Math.abs(d[i * 4] - c[0]) + Math.abs(d[i * 4 + 1] - c[1]) + Math.abs(d[i * 4 + 2] - c[2]) < 40);
    for (let i = 0; i < N * N; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; if (A(i) > 200 && lum(d, i) > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 45) light[i] = 1; }
    const clouds = [], bubbles = [];
    for (const p of parts(light, 25)) {
      if (p.n > 30000) continue;
      let cx = 0, cy = 0; for (const i of p.px) { cx += i % N; cy += (i / N) | 0; } cx /= p.n; cy /= p.n;
      if (!ears.some(([ex, ey]) => Math.hypot(cx - ex, cy - ey) < 240)) continue;
      // its outline: the ink around it; steam sits against the background (an eye's white is closed in by the face)
      // distance out from the steam (in a box around it): its ink outline is within ~12px, the background just past that
      const P = 20, X0 = Math.max(0, p.box[0] - P), Y0 = Math.max(0, p.box[1] - P), X1 = Math.min(N - 1, p.box[2] + P), Y1 = Math.min(N - 1, p.box[3] + P), BW = X1 - X0 + 1, BH = Y1 - Y0 + 1;
      const dist = new Uint8Array(BW * BH).fill(255), q = []; for (const i of p.px) { const k = (((i / N) | 0) - Y0) * BW + i % N - X0; dist[k] = 0; q.push(k); }
      for (let h = 0; h < q.length; h++) { const k = q[h], x = k % BW, y = (k / BW) | 0, dv = dist[k] + 1; if (dv > 18) continue;
        for (const j of [x > 0 ? k - 1 : -1, x < BW - 1 ? k + 1 : -1, y > 0 ? k - BW : -1, y < BH - 1 ? k + BW : -1]) if (j >= 0 && dist[j] > dv) {
          dist[j] = dv; q.push(j); } }
      const m = new Uint8Array(N * N); for (const i of p.px) m[i] = 1; let ring = 0, open = 0;
      for (let k = 0; k < BW * BH; k++) { if (!dist[k] || dist[k] > 18) continue; const i = (((k / BW) | 0) + Y0) * N + k % BW + X0;
        if (dist[k] >= 12) { ring++; if (isBg(i)) open++; } if (dist[k] <= 12 && !isBg(i) && lum(d, i) < 120) m[i] = 1; }
      if (!ring || open / ring < 0.22) continue;
      let bx0 = N, by0 = N, bx1 = 0, by1 = 0; for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) if (m[y * N + x]) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
      const box = [bx0, by0, bx1, by1], img = sprite(d, m, box);
      if (Math.max(p.box[2] - p.box[0], p.box[3] - p.box[1]) < 70) { for (let i = 0; i < N * N; i++) if (m[i]) erase[i] = 1; bubbles.push({ img, box, c:[cx, cy], ph:Math.random() }); continue; }
      // where it leaves the head: its point nearest the middle of the face; it blows outward from there
      let best = 1e9, pv = [cx, cy]; for (const i of p.px) { const x = i % N, y = (i / N) | 0, dd = Math.hypot(x - 500, y - 520); if (dd < best) { best = dd; pv = [x, y]; } }
      const dl = Math.hypot(cx - pv[0], cy - pv[1]) || 1;
      // what blows off is the cloud's white alone, softened (an inked copy fading out looks like glass, not steam)
      const lm = new Uint8Array(N * N); for (const i of p.px) lm[i] = 1; const wisp = sprite(d, lm, box), wc = cv(wisp.width + 16, wisp.height + 16), wg = wc.getContext('2d');
      wg.filter = 'blur(3px)'; wg.drawImage(wisp, 8, 8); wg.filter = 'none';
      clouds.push({ img, wisp:wc, box, c:[cx, cy], pv, dir:[(cx - pv[0]) / dl, (cy - pv[1]) / dl - 0.25], ph:clouds.length * 1.7 });
    }
    for (const b of bubbles) { const near = clouds.reduce((a, c) => !a || Math.hypot(c.c[0] - b.c[0], c.c[1] - b.c[1]) < Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) ? c : a, null);
      const dx = near ? b.c[0] - near.pv[0] : b.c[0] - 500, dy = near ? b.c[1] - near.pv[1] : b.c[1] - 500, l = Math.hypot(dx, dy) || 1; b.dir = [dx / l, dy / l - 0.4]; }
    if (clouds.length || bubbles.length) fx.push({ type:'steam', clouds, bubbles, puffs:[], next:0, side:0 });
  }
  // propeller hat: the blades (blue, at the very top) spin
  if (/Propeller/i.test(acc)) {
    let yb = -1; for (let y = top; y < top + 200 && yb < 0; y++) for (let x = 0; x < N; x++) { const i = y * N + x, r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; if (A(i) > 200 && b > 140 && b > r + 50 && b > g + 10) { yb = y; break; } }
    if (yb >= 0) {
      const m = new Uint8Array(N * N);
      for (let y = Math.max(0, yb - 30); y < yb + 110; y++) for (let x = 0; x < N; x++) { const i = y * N + x, r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; if (A(i) > 120 && b > 200 && ((r > 100 && g < 178) || (g < 142 && r > 60))) m[i] = 1; }   // the blades' two blues (the hat's own blue is greener)
      // the blades only (the biggest blue piece at the top), with their ink outline
      // the blades: small blue pieces up there (the hat's own blue panel is one big piece reaching down)
      const ps = parts(m, 50).filter(p => p.n < 5000 && p.box[3] - p.box[1] < 80 && p.box[1] < yb + 60);
      if (ps.length) {
        const blade = new Uint8Array(N * N); for (const p of ps) for (const i of p.px) blade[i] = 1;
        const g4 = grow(blade, 5); for (let i = 0; i < N * N; i++) if (g4[i] && !blade[i] && A(i) > 60 && lum(d, i) < 90) blade[i] = 1;
        let x0 = N, x1 = 0, y0 = N, y1 = 0, n = 0, cx = 0; for (let i = 0; i < N * N; i++) if (blade[i]) { const x = i % N, y = (i / N) | 0; n++; cx += x; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (n > 300 && y1 - y0 < 120) { for (let i = 0; i < N * N; i++) if (blade[i]) erase[i] = 1;
          fx.push({ type:'prop', img:sprite(d, blade, [x0, y0, x1, y1]), box:[x0, y0, x1, y1], cx:(x0 + x1) / 2 }); }
      }
    }
  }
  // dizzy eyes: each spiral (a near-round white swirl in the upper face) turns round and round
  if (/Dizzy/i.test(eyes)) {
    const w = new Uint8Array(N * N); for (let y = top; y < 720; y++) for (let x = 0; x < N; x++) { const i = y * N + x; if (A(i) > 200 && lum(d, i) > 205) w[i] = 1; }
    const ps = parts(w, 1500).filter(p => { const bw = p.box[2] - p.box[0], bh = p.box[3] - p.box[1]; return bw > 50 && bh > 50 && bw < 260 && bh < 260 && bw / bh > 0.7 && bw / bh < 1.4 && p.n < bw * bh * 0.75 && (p.box[1] + p.box[3]) / 2 < 600; })
      .sort((a, b) => b.n - a.n).slice(0, 2).filter((p, k, arr) => k === 0 || p.n > arr[0].n * 0.15);   // the two eyes
    // Each eye's inside gets a fresh spiral drawn in it every frame, turning, the same thickness and number of turns as the
    // drawn one; the eye's own outline never moves, so nothing round spins inside an oval and leaves gaps. The inside: an
    // ellipse fitted to the white swirl, grown out to the eye's outline, keeping only the eye's own white and ink inside it
    // (an eye half hidden behind the face keeps the face in front of it).
    const spins = [];
    for (const p of ps) {
      let mx = 0, my = 0; for (const i of p.px) { mx += i % N; my += (i / N) | 0; } mx /= p.n; my /= p.n;
      let sxx = 0, syy = 0, sxy = 0; for (const i of p.px) { const dx = i % N - mx, dy = ((i / N) | 0) - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; } sxx /= p.n; syy /= p.n; sxy /= p.n;
      const tr2 = (sxx + syy) / 2, df = Math.sqrt(Math.max(0, ((sxx - syy) / 2) ** 2 + sxy * sxy)), l1 = tr2 + df, l2 = Math.max(1, tr2 - df), ang = Math.atan2(l1 - sxx, sxy || 1e-6);
      const A0 = 2 * Math.sqrt(l1), B0 = 2 * Math.sqrt(l2), ca = Math.cos(ang), sa = Math.sin(ang);
      const white = i => A(i) > 200 && lum(d, i) > 205, inkAt = i => A(i) > 200 && Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) < 90;
      const at = (s2, th) => { const u = Math.cos(th) * A0 * s2, v = Math.sin(th) * B0 * s2, x = Math.round(mx + u * ca - v * sa), y = Math.round(my + u * sa + v * ca); return x < 0 || y < 0 || x >= N || y >= N ? -1 : y * N + x; };
      // out from the middle until the ring is mostly not white any more: that's the eye's outline
      let sc = 0.9; for (let s2 = 0.9; s2 < 1.6; s2 += 0.02) { let wn = 0, tn = 0; for (let k = 0; k < 90; k++) { const i = at(s2, k / 90 * 6.283); if (i < 0) continue; tn++; if (white(i)) wn++; } if (tn && wn / tn > 0.3) sc = s2; else break; }
      const ea = A0 * (sc + 0.03), eb = B0 * (sc + 0.03), r = Math.ceil(Math.max(ea, eb)) + 2;
      const x0 = Math.max(0, Math.floor(mx - r)), y0 = Math.max(0, Math.floor(my - r)), x1 = Math.min(N - 1, Math.ceil(mx + r)), y1 = Math.min(N - 1, Math.ceil(my + r)), w = x1 - x0 + 1, h = y1 - y0 + 1;
      const inE = (x, y) => { const dx = x - mx, dy = y - my, u = dx * ca + dy * sa, v = -dx * sa + dy * ca; return (u / ea) ** 2 + (v / eb) ** 2 <= 1; };
      let lm = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y + y0) * N + x + x0; if (inE(x + x0, y + y0) && (white(i) || inkAt(i))) lm[y * w + x] = 1; }
      // close the hairline gaps (the soft grey edge between a line and the white) so no bit of the old spiral peeks through
      const morph = (m2, grow2) => { const o = m2.slice(); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const k = y * w + x; const nb = m2[k - 1] + m2[k + 1] + m2[k - w] + m2[k + w];
        if (grow2 ? !m2[k] && nb && inE(x + x0, y + y0) : m2[k] && nb < 4) o[k] = grow2 ? 1 : 0; } return o; };
      lm = morph(morph(morph(morph(lm, 1), 1), 0), 0);
      const m = new Uint8Array(N * N); let n = 0, ink = 0, wr = 0, wg = 0, wb = 0, wn = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (lm[y * w + x]) { const i = (y + y0) * N + x + x0; m[i] = 1; n++; if (inkAt(i)) ink++; else if (white(i)) { wr += d[i * 4]; wg += d[i * 4 + 1]; wb += d[i * 4 + 2]; wn++; } }
      if (n < 1500 || !wn) continue;
      // the drawn spiral's turns: ink lines crossed going out from the middle, averaged over four directions
      let runs = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { let inInk = false;
        for (let k = 0; k < 200; k++) { const x = Math.round(mx + dx * k), y = Math.round(my + dy * k), i = y * N + x; if (x < 0 || y < 0 || x >= N || y >= N || !inE(x, y)) break;
          const dk = inkAt(i); if (dk && !inInk) runs++; inInk = dk; } }
      const turns = Math.max(1.5, Math.min(5, runs / 4 + 0.5));
      let len = 0; { let px = 0, py = 0; for (let k = 1; k <= 400; k++) { const th = k / 400 * turns * 6.283, rr = k / 400, qx = rr * Math.cos(th) * ea, qy = rr * Math.sin(th) * eb; len += Math.hypot(qx - px, qy - py); px = qx; py = qy; } }
      const lw = Math.max(4, Math.min(18, ink / Math.max(1, len)));
      spins.push({ c:[mx, my], rx:ea, ry:eb, ang, turns, lw, white:`rgb(${Math.round(wr / wn)},${Math.round(wg / wn)},${Math.round(wb / wn)})`, mask:sprite(d.map((v, j) => j % 4 === 3 ? 255 : 0), m, [x0, y0, x1, y1]), box:[x0, y0, x1, y1] });
    }
    if (spins.length) fx.push({ type:'spin', spins });
  }
  // the built-in specials: robot lights blink, anatomy hearts beat
  if (hand && hand.lights) fx.push({ type:'lights', lights:hand.lights.map(([x, y, r, col, tol = 170], k) => {
    const [cr, cg, cb] = hexRGB(col), m = new Uint8Array(N * N);   // the light's own pixels: close to its colour, inside its circle
    for (let yy = Math.max(0, y - r); yy < Math.min(N, y + r); yy++) for (let xx = Math.max(0, x - r); xx < Math.min(N, x + r); xx++) { const i = yy * N + xx;
      if (A(i) > 200 && Math.hypot(xx - x, yy - y) < r && Math.abs(d[i * 4] - cr) + Math.abs(d[i * 4 + 1] - cg) + Math.abs(d[i * 4 + 2] - cb) < tol) m[i] = 1; }
    const bx = [Math.max(0, x - r), Math.max(0, y - r), Math.min(N - 1, x + r), Math.min(N - 1, y + r)];
    // its glow: the light's own shape in its colour, blurred (shrunk small, then drawn big and smooth), so only the light itself glows
    const pad = 28, w = bx[2] - bx[0] + 1 + pad * 2, h = bx[3] - bx[1] + 1 + pad * 2, sh = cv(w, h), sg = sh.getContext('2d');
    sg.drawImage(sprite(d, m, bx), pad, pad); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = col; sg.fillRect(0, 0, w, h);
    const sm = cv(Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(h / 10))), smg = sm.getContext('2d'); smg.imageSmoothingQuality = 'high'; smg.drawImage(sh, 0, 0, sm.width, sm.height);
    const glow = cv(w, h), gg = glow.getContext('2d'); gg.imageSmoothingQuality = 'high'; gg.drawImage(sm, 0, 0, w, h); gg.drawImage(sm, -3, -3, w + 6, h + 6);
    return { x, y, r, col, img:sprite(d, m, bx), glow, pad, box:bx, ph:k * 1.7 }; }) });
  if (hand && hand.heart) {
    const red = new Uint8Array(N * N); for (let y = 520; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x, r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; if (A(i) > 200 && r > 165 && g < 95 && b < 105 && !(hand.heart.x1 && x > hand.heart.x1)) red[i] = 1; }
    const ps = parts(red, 60).sort((a, b) => b.n - a.n);
    if (ps.length) {   // the heart shows in pieces between the ribs: the biggest red piece and every red piece close to it
      const [a0, b0, a1, b1] = ps[0].box, close = ps.filter(q => q.box[0] < a1 + 70 && q.box[2] > a0 - 70 && q.box[1] < b1 + 90 && q.box[3] > b0 - 90);
      const p = { px:close.flatMap(q => q.px), box:[Math.min(...close.map(q => q.box[0])), Math.min(...close.map(q => q.box[1])), Math.max(...close.map(q => q.box[2])), Math.max(...close.map(q => q.box[3]))] };
      const m = new Uint8Array(N * N); for (const i of p.px) m[i] = 1;
      const g3 = grow(m, 4); for (let i = 0; i < N * N; i++) if (g3[i] && !m[i] && A(i) > 60 && lum(d, i) < 110) m[i] = 1;   // its ink outline
      const [x0, y0, x1, y1] = p.box, pad = 22, bx = [Math.max(0, x0 - pad), Math.max(0, y0 - pad), Math.min(N - 1, x1 + pad), Math.min(N - 1, y1 + pad)];
      // the ribs in front of it: the pale bones and the ink lines around them (the swelling heart goes behind these)
      const bone = new Uint8Array(N * N); for (let y = bx[1]; y <= bx[3]; y++) for (let x = bx[0]; x <= bx[2]; x++) { const i = y * N + x;
        const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; if (!m[i] && A(i) > 40 && lum(d, i) > 165 && Math.max(r, g, b) - Math.min(r, g, b) < 70) bone[i] = 1; }
      const near = grow(bone, 5), front = new Uint8Array(N * N);
      for (let y = bx[1]; y <= bx[3]; y++) for (let x = bx[0]; x <= bx[2]; x++) { const i = y * N + x; if (bone[i] || (near[i] && !m[i] && A(i) > 40 && lum(d, i) < 100)) front[i] = 1; }
      fx.push({ type:'heart', img:sprite(d, m, bx), front:sprite(d, front, bx), box:bx, c:[(x0 + x1) / 2, (y0 + y1) / 2] }); }
  }
  return { list:fx, erase:erase.some(v => v) ? erase : null };
}

// clear a moving piece's pixels from a still frame (canvas), so only the moving copy shows
export function eraseFrom(c, erase) {
  const g = c.getContext('2d', { willReadFrequently:true }), im = g.getImageData(0, 0, N, N), s = c.width / N;
  if (s !== 1) return;
  for (let i = 0; i < N * N; i++) if (erase[i]) im.data[i * 4 + 3] = 0;
  g.putImageData(im, 0, 0);
}

const beat = t => { const p = (t / 1000) % 0.95; return Math.exp(-p * 14) + 0.6 * Math.exp(-Math.max(0, p - 0.2) * 14) * (p > 0.2 ? 1 : 0); };   // lub-dub
let rayC = null;
export function drawFx(ctx, fx, t, x, y, size) {
  if (!fx || !fx.list.length) return;
  const k = size / N, dt = Math.min(0.05, Math.max(0, (t - (fx.t || t)) / 1000)); fx.t = t;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  for (const f of fx.list) {
    if (f.type === 'bees') for (const b of f.bees) {   // each bee loops a little figure-eight, tilting as it goes
      const s = t / 1000 * b.sp, ox = Math.sin(s * 2.1 + b.ph) * 22 + Math.sin(s * 5.3 + b.ph) * 4, oy = Math.sin(s * 4.2 + b.ph * 1.3) * 13;
      const [x0, y0, x1, y1] = b.box, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      ctx.save(); ctx.translate(cx + ox, cy + oy); ctx.rotate(Math.cos(s * 2.1 + b.ph) * 0.18); ctx.drawImage(b.img, -(cx - x0), -(cy - y0)); ctx.restore();
    }
    else if (f.type === 'coins') {
      if (t >= f.next) { f.coins.push({ x:f.at[0] + (Math.random() - 0.5) * f.w * 0.7, y:f.at[1], vx:(Math.random() - 0.5) * 480, vy:-(600 + Math.random() * 320), r:19 + Math.random() * 7, sp:6 + Math.random() * 6, a:Math.random() * 6 }); f.next = t + 110 + Math.random() * 110; }
      for (const c of f.coins) { c.vy += 1500 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.a += c.sp * dt; }
      f.coins = f.coins.filter(c => c.y < N + 60 && f.coins.length < 60);
      for (const c of f.coins) { const sx = Math.max(0.15, Math.abs(Math.cos(c.a)));
        ctx.save(); ctx.translate(c.x, c.y); ctx.scale(sx, 1);
        ctx.beginPath(); ctx.arc(0, 0, c.r, 0, 6.283); ctx.fillStyle = '#ffc52e'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = '#1c1c1c'; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, c.r * 0.6, 0, 6.283); ctx.lineWidth = 2.5; ctx.strokeStyle = '#d88f12'; ctx.stroke();
        ctx.beginPath(); ctx.arc(-c.r * 0.3, -c.r * 0.35, c.r * 0.22, 0, 6.283); ctx.fillStyle = '#fff6c7'; ctx.fill();
        ctx.restore(); }
    }
    else if (f.type === 'rays') {   // a warm glow that breathes, and bands of light running out from the star along the rays
      const [ox, oy] = f.o;
      if (!f.glow) { const g = cv(N, 640), gg = g.getContext('2d'); gg.filter = 'blur(16px)'; gg.drawImage(f.mask, 0, 0); gg.filter = 'none';
        gg.globalCompositeOperation = 'source-in'; gg.fillStyle = '#ffe14d'; gg.fillRect(0, 0, N, 640); f.glow = g; }
      if (!rayC) rayC = cv(N, 640); const rg = rayC.getContext('2d');
      rg.globalCompositeOperation = 'source-over'; rg.clearRect(0, 0, N, 640); rg.drawImage(f.mask, 0, 0); rg.globalCompositeOperation = 'source-in';
      const period = 120, shift = (t * 0.3) % period;
      for (let r = shift; r < 1300; r += period) { const gr = rg.createRadialGradient(ox, oy, Math.max(0, r - 45), ox, oy, r + 45);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        rg.fillStyle = gr; rg.beginPath(); rg.arc(ox, oy, r + 45, 0, 6.283); rg.arc(ox, oy, Math.max(0, r - 45), 0, 6.283, true); rg.fill(); }
      const flick = 0.55 + 0.25 * Math.sin(t / 220) + 0.2 * Math.sin(t / 97 + 1.3);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.max(0, Math.min(1, 0.6 * flick)); ctx.drawImage(f.glow, 0, 0);
      ctx.globalAlpha = 0.45; ctx.drawImage(rayC, 0, 0);
      const sg = ctx.createRadialGradient(ox, oy, 0, ox, oy, 90 + 25 * flick); sg.addColorStop(0, `rgba(255,250,210,${0.75 * flick})`); sg.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = sg; ctx.fillRect(ox - 130, oy - 130, 260, 260); ctx.restore();
    }
    else if (f.type === 'steam') {
      // every so often a cloud blows off a copy of itself: it leaves from behind the cloud, drifts out and up, grows and fades
      const big = f.big || (f.big = f.clouds.filter(c => Math.max(c.box[2] - c.box[0], c.box[3] - c.box[1]) >= 110));   // (a little jet streak only swells)
      if (big.length && t >= f.next) { const c = big[f.side % big.length]; f.side++; f.puffs.push({ c, t0:t, wob:Math.random() * 6 }); f.next = t + 420 + Math.random() * 260; }
      f.puffs = f.puffs.filter(p => t - p.t0 < 1100);
      for (const p of f.puffs) { const a = (t - p.t0) / 1100, c = p.c, [x0, y0] = c.box, dist = 20 + 150 * Math.sqrt(a), s = 0.45 + 0.4 * a;
        ctx.save(); ctx.globalAlpha = a < 0.15 ? a / 0.15 : Math.max(0, 1 - (a - 0.15) / 0.85) ** 1.4;
        ctx.translate(c.c[0] + c.dir[0] * dist + Math.sin(a * 7 + p.wob) * 5, c.c[1] + c.dir[1] * dist - a * 25); ctx.scale(s, s); ctx.drawImage(c.wisp, x0 - 8 - c.c[0], y0 - 8 - c.c[1]); ctx.restore(); }
      for (const c of f.clouds) {   // the cloud itself swells and settles from where it leaves the head (never smaller than drawn, so it always covers itself)
        const k = 1 + 0.07 * (0.5 + 0.5 * Math.sin(t / 1000 * 8.5 + c.ph)), [x0, y0] = c.box;
        ctx.save(); ctx.translate(c.pv[0], c.pv[1]); ctx.rotate(0.035 * Math.sin(t / 1000 * 4.1 + c.ph)); ctx.scale(k, k); ctx.drawImage(c.img, x0 - c.pv[0], y0 - c.pv[1]); ctx.restore(); }
      for (const b of f.bubbles) {   // bubbles float off and pop back where they were drawn
        const a = (t / 1600 + b.ph) % 1, [x0, y0] = b.box;
        ctx.save(); ctx.globalAlpha = a < 0.12 ? a / 0.12 : a > 0.75 ? Math.max(0, 1 - (a - 0.75) / 0.25) : 1;
        ctx.translate(b.dir[0] * 45 * a, b.dir[1] * 45 * a); ctx.drawImage(b.img, x0, y0); ctx.restore(); }
    }
    else if (f.type === 'prop') {   // the blades turn: seen side-on, they narrow and widen and flip
      const [x0, y0, x1, y1] = f.box, s = Math.cos(t / 1000 * 2 * Math.PI * 2.2), w = x1 - x0 + 1;
      ctx.save(); ctx.translate(f.cx, 0); ctx.scale(Math.abs(s) < 0.08 ? 0.08 * Math.sign(s || 1) : s, 1); ctx.drawImage(f.img, x0 - f.cx, y0); ctx.restore();
    }
    else if (f.type === 'spin') for (const s of f.spins) {   // round and round: the eye's white, a turning spiral, kept inside the eye
      const [x0, y0, x1, y1] = s.box, w = x1 - x0 + 1, h = y1 - y0 + 1, c = s.can || (s.can = cv(w, h)), g = c.getContext('2d');
      g.globalCompositeOperation = 'source-over'; g.fillStyle = s.white; g.fillRect(0, 0, w, h);
      g.save(); g.translate(s.c[0] - x0, s.c[1] - y0); g.rotate(s.ang || 0); g.beginPath();
      const ph = -t / 1000 * 3.2, steps = Math.ceil(s.turns * 90);
      for (let k = 0; k <= steps; k++) { const r = k / steps * 1.12, th = k / steps * s.turns * 6.283 + ph; const px = r * Math.cos(th) * s.rx, py = r * Math.sin(th) * s.ry; k ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.lineWidth = s.lw; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1c1c1c'; g.stroke(); g.restore();
      g.globalCompositeOperation = 'destination-in'; g.drawImage(s.mask, 0, 0);
      ctx.drawImage(c, x0, y0);
    }
    else if (f.type === 'lights') for (const l of f.lights) {   // each light blinks on its own beat: brightens and glows, then rests
      const on = Math.max(0, Math.sin(t / 1000 * 3.1 + l.ph)) ** 3;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 * on; ctx.drawImage(l.img, l.box[0], l.box[1]);
      ctx.globalAlpha = on; ctx.drawImage(l.glow, l.box[0] - l.pad, l.box[1] - l.pad); ctx.globalAlpha = 0.5 * on; ctx.drawImage(l.glow, l.box[0] - l.pad, l.box[1] - l.pad); ctx.restore();
    }
    else if (f.type === 'heart') {   // lub-dub: the heart swells behind the ribs
      const s = 1 + 0.09 * beat(t), [x0, y0] = f.box;
      ctx.save(); ctx.translate(f.c[0], f.c[1]); ctx.scale(s, s); ctx.drawImage(f.img, x0 - f.c[0], y0 - f.c[1]); ctx.restore();
      ctx.drawImage(f.front, x0, y0);
    }
  }
  ctx.restore();
}
