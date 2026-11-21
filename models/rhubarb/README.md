# Lip sync from the sound

`rhubarb.js` / `rhubarb.wasm` / `rhubarb.data`: Rhubarb Lip Sync by Daniel S. Wolf
(https://github.com/DanielSWolf/rhubarb-lip-sync, MIT License), as built for the browser by the
`rhubarb-lip-sync-wasm` package 0.1.8 (https://www.npmjs.com/package/rhubarb-lip-sync-wasm, MIT License,
see LICENSE-wasm-port). `rhubarb.data` holds CMU Sphinx's US English acoustic model, pronouncing dictionary
and language model (CMU Sphinx, BSD-style licence).

It hears the speech sounds and gives a mouth shape for each moment, from the nine cartoon mouths
(Preston Blair's): the filter maps them onto each Nibble's own nine mouths. Run on the phone, in a worker
(beta/lipsync-worker.js), while the video is being read; nothing leaves the device.
