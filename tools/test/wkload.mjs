// The debug site as on github.io (in a folder) in WebKit (Safari's engine): a kit Nibble gets ready and the voice net loads.
// (On the old code both failed on GEAUX's iPhone: import() of beta/kit.js and the voice model one folder too high.)
// PREFIX=/nibbles-filter node ch/wkload.mjs [page]
import { server } from './wkserve.mjs'; import { webkit } from './wd.mjs';
const P = process.env.PREFIX || '', page = process.argv[2] || 'beta/index.html', id = +(process.env.ID || 310);
server.listen(8770); const w = await webkit();
try {
  await w.timeouts({ script:120000 });
  await w.go(`http://127.0.0.1:8770${P}/${page}`);
  for (let i = 0; i < 120 && !(await w.js('return !!(window.__nf && window.__nf.ready)')); i++) await new Promise(r => setTimeout(r, 500));
  const kit = await w.jsAsync(`const done = arguments[arguments.length - 1]; window.__nf.prepare(${id}).then(r => done(String(r)), e => done('error ' + e))`);
  const voice = await w.jsAsync(`const done = arguments[arguments.length - 1]; window.__nf.voiceNet().then(r => done(String(r)), e => done('error ' + e))`);
  console.log((kit === 'true' ? 'PASS' : 'FAIL') + ' kit Nibble #' + id + ' gets ready (' + kit + ')');
  console.log((voice === 'true' ? 'PASS' : 'FAIL') + ' the voice net loads (' + voice + ')');
} finally { await w.quit(); server.close(); }
