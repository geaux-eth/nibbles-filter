// Lip sync from the sound (Rhubarb Lip Sync, models/rhubarb): given the clip's sound (16 kHz mono, 16-bit), the mouth
// shape for each moment: [start s, end s, 'A'…'H' or 'X']. Runs off the page, so the page stays free while it works.
// message in: { base: the site's own address, pcm: ArrayBuffer }; out: { cues } or { err }
self.onmessage = async e => {
  const { base, pcm } = e.data, t0 = performance.now();
  try {
    const M = await (await import(base + 'models/rhubarb/rhubarb.js')).default({
      locateFile:p => base + 'models/rhubarb/' + p, print:() => {}, printErr:() => {} });   // (its own [DEBUG] lines: not wanted)
    const r = M.getLipSync(new Uint8Array(pcm), '');
    const cues = []; for (const c of r.mouthCues) cues.push([+c.start.toFixed(3), +c.end.toFixed(3), c.value]);
    self.postMessage({ cues, ms:Math.round(performance.now() - t0) });
  } catch (err) { self.postMessage({ err:String(err && err.message || err).slice(0, 200), ms:Math.round(performance.now() - t0) }); }
};
