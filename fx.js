// fx.js — traits that move on their own, worked out from the Nibble's own picture and its traits:
//   bees buzz around a bee-hive bear, coins fountain out of slot-machine eyes, light-magic rays pulse and stream,
//   steam puffs out of steaming ears, propeller hats spin, dizzy (spiral) eyes spin,
//   robot lights blink and anatomy hearts beat (hand-placed for the built-in robots and dissections).
// prepareFx(base, traits, hand) reads the 1000px picture once and returns the effects plus the pixels they own
// (eraseMask: those get cleared from the still picture, so a moving piece never leaves a copy behind).
// drawFx(ctx, fx, t, x, y, size) draws them every frame.

const N = 1000;
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// hand-placed parts for the built-in specials (1000px art): robot lights [x, y, radius, colour] and dissection hearts
export const FX_HAND = {
  546:  { lights:[[560, 505, 150, '#ff4f8b']] },                                       // the pink visor
  2775: { lights:[[402, 128, 34, '#ffffff'], [548, 88, 34, '#ffffff'], [600, 420, 250, '#3cff5a']] },   // antenna bulbs, the screen face
  3113: { lights:[[480, 430, 90, '#ffd23f'], [705, 405, 70, '#ffd23f']] },              // yellow eyes
  3159: { lights:[[572, 150, 30, '#ffffff'], [570, 480, 130, '#3cff5a']] },              // antenna ball, green visor
  3295: { lights:[[540, 450, 130, '#ffd23f'], [560, 330, 45, '#a24bff']] },              // yellow eyes, purple gem
  3543: { lights:[[560, 330, 150, '#3cff5a']] },                                        // green visor
  5900: { lights:[[500, 215, 45, '#ff3b30'], [150, 240, 26, '#ffffff'], [560, 400, 150, '#ffd23f']] },   // red antenna light, eyes
  8482: { lights:[[602, 168, 30, '#ffffff'], [560, 440, 120, '#3cff5a'], [470, 900, 110, '#3cff5a']] },  // antenna, visor, chest screen
  794:  { heart:true }, 1998:{ heart:true }, 3538:{ heart:true }, 5807:{ heart:true },
  7192: { heart:true }, 7813:{ heart:true }, 8617:{ heart:true }, 8637:{ heart:true },
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
  // steam: little angry puffs out of each ear, in turn
  if (/Steam/i.test(acc) && STEAM[kind]) fx.push({ type:'steam', ears:STEAM[kind], puffs:[], next:0, side:0 });
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
    const spins = ps.map(p => { const [x0, y0, x1, y1] = p.box; return { c:[(x0 + x1) / 2, (y0 + y1) / 2], r:Math.max(x1 - x0, y1 - y0) / 2 + 2 }; });
    if (spins.length) { for (const s of spins) { const r = Math.ceil(s.r), m = new Uint8Array(N * N), bx = [Math.round(s.c[0] - r), Math.round(s.c[1] - r), Math.round(s.c[0] + r), Math.round(s.c[1] + r)].map(v => Math.max(0, Math.min(N - 1, v)));
        for (let y = bx[1]; y <= bx[3]; y++) for (let x = bx[0]; x <= bx[2]; x++) if (Math.hypot(x - s.c[0], y - s.c[1]) <= s.r) m[y * N + x] = 1;
        s.img = sprite(d, m, bx); s.box = bx; }
      fx.push({ type:'spin', spins }); }
  }
  // the built-in specials: robot lights blink, anatomy hearts beat
  if (hand && hand.lights) fx.push({ type:'lights', lights:hand.lights.map(([x, y, r, col], k) => {
    const [cr, cg, cb] = hexRGB(col), m = new Uint8Array(N * N);   // the light's own pixels: close to its colour, inside its circle
    for (let yy = Math.max(0, y - r); yy < Math.min(N, y + r); yy++) for (let xx = Math.max(0, x - r); xx < Math.min(N, x + r); xx++) { const i = yy * N + xx;
      if (A(i) > 200 && Math.hypot(xx - x, yy - y) < r && Math.abs(d[i * 4] - cr) + Math.abs(d[i * 4 + 1] - cg) + Math.abs(d[i * 4 + 2] - cb) < 170) m[i] = 1; }
    const bx = [Math.max(0, x - r), Math.max(0, y - r), Math.min(N - 1, x + r), Math.min(N - 1, y + r)];
    return { x, y, r, col, img:sprite(d, m.map(v => v), bx), box:bx, ph:k * 1.7 }; }) });
  if (hand && hand.heart) {
    const red = new Uint8Array(N * N); for (let y = 520; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x, r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; if (A(i) > 200 && r > 165 && g < 95 && b < 105) red[i] = 1; }
    const ps = parts(red, 400).sort((a, b) => b.n - a.n);
    if (ps.length) { const p = ps[0], m = new Uint8Array(N * N); for (const i of p.px) m[i] = 1;
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
    else if (f.type === 'steam') {   // a short burst of 2–3 puffs from one ear, then the other
      if (t >= f.next) { const [ex, ey, dx, dy] = f.ears[f.side]; f.side = (f.side + 1) % f.ears.length;
        for (let j = 0; j < 3; j++) f.puffs.push({ x:ex, y:ey, dx, dy, t0:t + j * 110, r:24 + Math.random() * 9, wob:Math.random() * 6 });
        f.next = t + 650 + Math.random() * 250; }
      f.puffs = f.puffs.filter(p => t - p.t0 < 900);
      for (const p of f.puffs) { const a = (t - p.t0) / 900; if (a < 0) continue;
        const dist = 30 + 170 * Math.sqrt(a), px = p.x + p.dx * dist + Math.sin(a * 6 + p.wob) * 6, py = p.y + p.dy * dist - a * 30, s = 0.35 + 0.85 * Math.min(1, a * 2.2);
        ctx.save(); ctx.globalAlpha = a < 0.6 ? 1 : 1 - (a - 0.6) / 0.4; ctx.translate(px, py); ctx.scale(s, s);
        const blobs = [[0, 0, p.r], [p.r * 0.9, -p.r * 0.3, p.r * 0.75], [-p.r * 0.8, -p.r * 0.2, p.r * 0.7], [p.r * 0.1, -p.r * 0.85, p.r * 0.65]];
        ctx.beginPath(); for (const [bx, by, br] of blobs) { ctx.moveTo(bx + br, by); ctx.arc(bx, by, br, 0, 6.283); }
        ctx.lineWidth = 9; ctx.strokeStyle = '#1c1c1c'; ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore(); }
    }
    else if (f.type === 'prop') {   // the blades turn: seen side-on, they narrow and widen and flip
      const [x0, y0, x1, y1] = f.box, s = Math.cos(t / 1000 * 2 * Math.PI * 2.2), w = x1 - x0 + 1;
      ctx.save(); ctx.translate(f.cx, 0); ctx.scale(Math.abs(s) < 0.08 ? 0.08 * Math.sign(s || 1) : s, 1); ctx.drawImage(f.img, x0 - f.cx, y0); ctx.restore();
    }
    else if (f.type === 'spin') for (const s of f.spins) {   // round and round
      const [x0, y0] = s.box; ctx.save(); ctx.beginPath(); ctx.arc(s.c[0], s.c[1], s.r, 0, 6.283); ctx.clip();
      ctx.translate(s.c[0], s.c[1]); ctx.rotate(t / 1000 * 3.2); ctx.drawImage(s.img, x0 - s.c[0], y0 - s.c[1]); ctx.restore();
    }
    else if (f.type === 'lights') for (const l of f.lights) {   // each light blinks on its own beat: brightens and glows, then rests
      const on = Math.max(0, Math.sin(t / 1000 * 3.1 + l.ph)) ** 3;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 * on; ctx.drawImage(l.img, l.box[0], l.box[1]);
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 1.25); g.addColorStop(0, l.col + 'aa'); g.addColorStop(1, l.col + '00');
      ctx.globalAlpha = 0.6 * on; ctx.fillStyle = g; ctx.fillRect(l.x - l.r * 1.3, l.y - l.r * 1.3, l.r * 2.6, l.r * 2.6); ctx.restore();
    }
    else if (f.type === 'heart') {   // lub-dub: the heart swells behind the ribs
      const s = 1 + 0.09 * beat(t), [x0, y0] = f.box;
      ctx.save(); ctx.translate(f.c[0], f.c[1]); ctx.scale(s, s); ctx.drawImage(f.img, x0 - f.c[0], y0 - f.c[1]); ctx.restore();
      ctx.drawImage(f.front, x0, y0);
    }
  }
  ctx.restore();
}
