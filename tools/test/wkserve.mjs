// a real http server for browsers that can't route (WebKit): the site, with the CDN files served from the saved copies
import http from 'http'; import fs from 'fs'; import path from 'path';
const S = '/tmp/claude-0/-home-claude/983647b0-485b-5cec-a0d0-3276a7c1b795/scratchpad', ROOT = process.env.ROOT || '/home/claude/nibbles-filter', PORT = +(process.env.PORT || 8770);
const T = { '.js':'text/javascript', '.mjs':'text/javascript', '.webp':'image/webp', '.png':'image/png', '.json':'application/json', '.html':'text/html', '.woff2':'font/woff2', '.mp3':'audio/mpeg', '.jpg':'image/jpeg', '.webm':'video/webm', '.mp4':'video/mp4', '.svg':'image/svg+xml', '.wasm':'application/wasm', '.bin':'application/octet-stream' };
const rw = s => s.replace(/https:\/\/cdn\.jsdelivr\.net\//g, '/cdn/').replace(/https:\/\/storage\.googleapis\.com\//g, '/gs/').replace(/https:\/\/jmiesqhrpcmrthrquqpq\.supabase\.co/g, '/sb')
  .replace(/https:\/\/d24r2edyfve7yo\.cloudfront\.net\//g, '/cf/').replace(/https:\/\/fonts\.(googleapis|gstatic)\.com[^'"]*/g, '/none');
export const posts = [];
const send = (res, f, rewrite) => { if (!fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  const ct = T[path.extname(f)] || 'application/octet-stream'; let b = fs.readFileSync(f); if (rewrite && /\.(html|js|mjs)$/.test(f)) b = rw(b.toString());
  res.writeHead(200, { 'content-type':ct, 'access-control-allow-origin':'*', 'cache-control':'no-store' }); res.end(b); };
export const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let m;
  if (u.startsWith('/sb')) { let body = ''; req.on('data', d => body += d); req.on('end', () => { if (req.method === 'POST') { posts.push({ path:u, body }); fs.appendFileSync(S + '/wk/posts.log', u + ' ' + body + '\n'); }
    res.writeHead(req.method === 'POST' ? 201 : 200, { 'content-type':'application/json', 'access-control-allow-origin':'*' }); res.end(req.method === 'POST' ? '' : '[]'); }); return; }
  if ((m = u.match(/^\/cdn\/npm\/@mediapipe\/tasks-vision@[^/]+\/(.*)/))) return send(res, `${S}/mp/package/${m[1]}`);
  if ((m = u.match(/^\/cdn\/npm\/@mediapipe\/tasks-audio@[^/]+\/(.*)/))) return send(res, `${S}/mpa/package/${m[1]}`);
  if ((m = u.match(/^\/cdn\/npm\/@vladmandic\/face-api@[^/]+\/(.*)/))) return send(res, `${S}/fa/package/${m[1]}`);
  if (/yamnet\.tflite$/.test(u)) return send(res, '/tmp/yam/package/src/model/yamnet.tflite');
  if (/face_landmarker\.task$/.test(u)) return send(res, `${S}/mp/pk/package/face_landmarker.task`);
  if ((m = u.match(/^\/cf\/.*?(\d+)\.png$/)) && fs.existsSync(`${S}/research/full/${m[1]}.png`)) return send(res, `${S}/research/full/${m[1]}.png`);
  if (process.env.PREFIX && !u.startsWith(process.env.PREFIX + '/') && !u.startsWith('/clips/')) { res.writeHead(404); return res.end(); }   // (the site lives in a folder, as on github.io: nothing above it)
  if (u.startsWith('/cdn/') || u.startsWith('/cf/') || u === '/none') { res.writeHead(404); return res.end(); }
  if (u.startsWith('/clips/')) return send(res, S + u.slice(6));
  const v = process.env.PREFIX ? u.slice(process.env.PREFIX.length) : u; send(res, path.join(ROOT, v === '/' ? '/index.html' : v), true);
});
if (process.argv[1].endsWith('wkserve.mjs')) server.listen(PORT, () => console.log('serving on', PORT));
