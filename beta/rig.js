// Drawn mouths (GEAUX, 21 Nov: "draw them fresh"): a Nibble's talking mouths made on its own picture, nothing copied from
// another Nibble. The lower jaw, cut from this Nibble's own picture (its colours, its outline, its fang), swings down
// from the corner of the mouth; the opening behind it is drawn: the dark inside, the tongue, teeth, outlined in ink.
// Everything else stays this Nibble's own pixels, so no smudge, ghost or other Nibble's colour can show.
// Every Nibble of a kind is drawn in the same pose, so one set of points per kind (1000 px picture) fits them all.

const N = 1000;
const INK = '#1d1818', DARK = '#5c161e', DEEP = '#3e0c14', TONGUE = '#e26a7a', TONGUE_LINE = '#b84658', TEETH = '#fcfaf2';

// the kinds. corner: the hinge; lip: the top of the lower jaw (the mouth line), corner to front; tip: the jaw's front;
// chin: under the jaw, back to the hinge (nothing behind the hinge: that's cheek); keep: boxes of the upper face that hang
// over the opening (fangs) and stay in front; line: outline width
export const RIGS = {
  Wolf:{ corner:[446, 609], lip:[[446, 609], [480, 633], [525, 664], [575, 683], [625, 692], [665, 691], [697, 685]],
    tip:[[697, 685], [703, 700], [697, 715], [683, 722]], chin:[[683, 722], [640, 735], [600, 750], [565, 770], [520, 782], [478, 770], [456, 700]],
    keep:[[700, 660, 760, 745], [795, 650, 860, 735]], line:8, seed:[575, 708] },
};
// each talking mouth: how far the jaw swings (degrees) and what's drawn in the opening
//   1 M B P   2 small open   3 wide AH   4 teeth (EE)   5 O   6 OO   7 F V   8 L   9 frown (the rest face)
const SHAPES = [null, [0, null], [6, 'open'], [20, 'open'], [6, 'teeth'], [14, 'open'], [9, 'open'], [4, 'teeth'], [11, 'L'], [0, null]];

const cv = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
const path = (g, pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); };
const line = (g, pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.stroke(); };
const rot = (pts, a, c) => { const t = a * Math.PI / 180, s = Math.sin(t), co = Math.cos(t); return pts.map(([x, y]) => [c[0] + (x - c[0]) * co - (y - c[1]) * s, c[1] + (x - c[0]) * s + (y - c[1]) * co]); };

// T: this Nibble's picture (a canvas, 1000 px, background cut; with a big mouth of its own, its plain-mouthed twin's
// face already under it). Returns frames[1..9] (frames[0] is left out: the rest face is the Nibble's own picture).
export function rigFrames(T, rig) {
  const g0 = T.getContext('2d', { willReadFrequently:true }), A = g0.getImageData(0, 0, N, N).data;
  const jawPts = [...rig.lip, ...rig.tip.slice(1), ...rig.chin.slice(1)];
  // the jaw's area, and inside it only the face (the muzzle colour, its ink, the fang): not a shirt or neck under it
  const jc = cv(), jg = jc.getContext('2d', { willReadFrequently:true }); jg.fillStyle = '#000'; path(jg, jawPts); jg.fill();
  const J = jg.getImageData(0, 0, N, N).data, jm = new Float32Array(N * N); for (let p = 0; p < N * N; p++) jm[p] = J[p * 4 + 3] / 255;
  const sum = i => A[i] + A[i + 1] + A[i + 2];
  const cr = [], cg = [], cb = []; for (let p = 0; p < N * N; p++) { const i = p * 4; if (jm[p] > 0.99 && A[i + 3] > 200 && sum(i) > 450) { cr.push(A[i]); cg.push(A[i + 1]); cb.push(A[i + 2]); } }
  const med = a => { a.sort((x, y) => x - y); return a[a.length >> 1] || 0; }, cream = [med(cr), med(cg), med(cb)];
  const isFace = p => { const i = p * 4; if (A[i + 3] < 100) return false; const s = sum(i);
    return Math.abs(A[i] - cream[0]) + Math.abs(A[i + 1] - cream[1]) + Math.abs(A[i + 2] - cream[2]) < 70 || s < 200 || Math.min(A[i], A[i + 1], A[i + 2]) > 225; };
  const face = new Uint8Array(N * N), q = new Int32Array(N * N); let h = 0, t = 0; const s0 = rig.seed[1] * N + rig.seed[0];
  if (isFace(s0)) { face[s0] = 1; q[t++] = s0;
    while (h < t) { const p = q[h++], x = p % N; for (const o of [x > 0 ? p - 1 : -1, x < N - 1 ? p + 1 : -1, p - N, p + N]) if (o >= 0 && o < N * N && !face[o] && jm[o] > 0.02 && isFace(o)) { face[o] = 1; q[t++] = o; } } }
  const fd = face.slice(); for (let p = 0; p < N * N; p++) if (face[p]) { const x = p % N; if (x > 0) fd[p - 1] = 1; if (x < N - 1) fd[p + 1] = 1; if (p >= N) fd[p - N] = 1; if (p < N * N - N) fd[p + N] = 1; }
  // the jaw layer: its own pixels; and the picture with the jaw's place filled with its muzzle colour
  const jl = cv(), jlg = jl.getContext('2d'), JL = jlg.createImageData(N, N), base = cv(), bg = base.getContext('2d'), BA = bg.createImageData(N, N);
  for (let p = 0; p < N * N; p++) { const i = p * 4, w = fd[p] ? jm[p] : 0;
    for (let c = 0; c < 4; c++) BA.data[i + c] = A[i + c];
    if (w > 0) { JL.data[i] = A[i]; JL.data[i + 1] = A[i + 1]; JL.data[i + 2] = A[i + 2]; JL.data[i + 3] = Math.round(A[i + 3] * w); }
    if (w > 0.5) { BA.data[i] = cream[0]; BA.data[i + 1] = cream[1]; BA.data[i + 2] = cream[2]; BA.data[i + 3] = 255; } }
  jlg.putImageData(JL, 0, 0); bg.putImageData(BA, 0, 0);
  // what stays in front: the upper face's fangs (white and their ink) in the keep boxes
  const fr = cv(), fg = fr.getContext('2d'), FR = fg.createImageData(N, N);
  for (const [x0, y0, x1, y1] of rig.keep || []) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const p = y * N + x, i = p * 4;
    if (A[i + 3] > 100 && (sum(i) > 600 || sum(i) < 150) && !fd[p]) for (let c = 0; c < 4; c++) FR.data[i + c] = A[i + c]; }
  fg.putImageData(FR, 0, 0);
  const frames = [null];
  for (let k = 1; k < 10; k++) {
    const [ang, kind] = SHAPES[k];
    if (!kind) { const c = cv(); c.getContext('2d').drawImage(T, 0, 0); frames.push(c); continue; }
    const c = cv(), g = c.getContext('2d'); g.drawImage(base, 0, 0);
    const lip2 = rot(rig.lip, ang, rig.corner), tip2 = rot(rig.tip, ang, rig.corner), hole = [...rig.lip, tip2[0], ...lip2.slice().reverse()];
    // the opening: dark inside, darker at the back, the tongue on its floor, teeth along its top
    g.save(); path(g, hole); g.clip();
    g.fillStyle = DARK; g.fill();
    g.fillStyle = DEEP; path(g, [rig.lip[0], rig.lip[2], lip2[2]]); g.fill();
    if (kind === 'open' && ang >= 9) { const [cx, cy] = lip2[4], w = 70 + ang * 2.5, hh = 18 + ang * 0.9;
      g.fillStyle = TONGUE; g.beginPath(); g.ellipse(cx - w * 0.1, cy - 6, w * 0.9, hh, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = TONGUE_LINE; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - w * 0.2, cy - hh * 0.2 - 6); g.lineTo(cx + w * 0.3, cy - 4); g.stroke(); }
    if (kind === 'L') { const [tx, ty] = rig.lip[5]; g.fillStyle = TONGUE; g.beginPath(); g.ellipse(tx - 6, ty + 13, 20, 17, 0, 0, Math.PI * 2); g.fill(); }
    if (kind === 'teeth') { const top = rig.lip.slice(1); g.fillStyle = TEETH; path(g, [...top.map(([x, y]) => [x, y + 1]), ...top.slice().reverse().map(([x, y]) => [x, y + 22])]); g.fill(); }
    g.restore();
    // the jaw, swung down
    g.save(); g.translate(rig.corner[0], rig.corner[1]); g.rotate(ang * Math.PI / 180); g.translate(-rig.corner[0], -rig.corner[1]); g.drawImage(jl, 0, 0); g.restore();
    // ink: the swung jaw's top edge and the front of the opening (the line above is this Nibble's own)
    g.strokeStyle = INK; g.lineWidth = rig.line; g.lineCap = 'round'; g.lineJoin = 'round';
    line(g, lip2); line(g, [rig.lip[rig.lip.length - 1], tip2[0]]);
    // where the jaw was and isn't any more (behind and under it as it swings): muzzle colour, with an ink edge where it
    // meets the clothes or the background, so it never ends in a bare cream patch (and no old chin line shows twice)
    { const m = cv(), mg = m.getContext('2d', { willReadFrequently:true });
      mg.translate(rig.corner[0], rig.corner[1]); mg.rotate(ang * Math.PI / 180); mg.translate(-rig.corner[0], -rig.corner[1]); mg.drawImage(jl, 0, 0); mg.setTransform(1, 0, 0, 1, 0, 0);
      mg.fillStyle = '#000'; path(mg, hole); mg.fill();
      const M = mg.getImageData(0, 0, N, N).data, F = g.getImageData(0, 0, N, N), D = F.data;
      let x0 = N, y0 = N, x1 = 0, y1 = 0; for (let p = 0; p < N * N; p++) if ((fd[p] && jm[p] > 0.5) || M[p * 4 + 3] >= 128) { const x = p % N, y = (p / N) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      // (the swung jaw's own back edge too, where it now lies over the clothes: it had no outline there, being cheek before)
      const hm = cv(), hg = hm.getContext('2d', { willReadFrequently:true }); hg.fillStyle = '#000'; path(hg, hole); hg.fill(); const H = hg.getImageData(0, 0, N, N).data;
      const R = Math.round(rig.line * 0.75), vac = p => (fd[p] && jm[p] > 0.5 && M[p * 4 + 3] < 128) || (M[p * 4 + 3] >= 128 && H[p * 4 + 3] < 128);
      const other = p => !fd[p] && !isFace(p) && M[p * 4 + 3] < 128;   // not face (the cheek beside the jaw is face), not the swung jaw, not the opening: clothes or background
      for (let y = Math.max(R, y0); y <= Math.min(N - 1 - R, y1); y++) for (let x = Math.max(R, x0); x <= Math.min(N - 1 - R, x1); x++) { const p = y * N + x; if (!vac(p)) continue;
        let near = false; for (let dy = -R; dy <= R && !near; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= R * R && other(p + dy * N + dx)) { near = true; break; }
        if (near) { const i = p * 4; D[i] = 29; D[i + 1] = 24; D[i + 2] = 24; D[i + 3] = 255; } }
      g.putImageData(F, 0, 0); }
    g.drawImage(fr, 0, 0);
    frames.push(c);
  }
  return frames;
}
