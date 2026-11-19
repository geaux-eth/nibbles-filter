// route the local test site (http://127.0.0.1:8765/...) straight to the repo's files, no server needed
import fs from 'fs'; import path from 'path';
const ROOT = process.env.ROOT || '/home/claude/nibbles-filter', T = { '.js':'text/javascript', '.mjs':'text/javascript', '.webp':'image/webp', '.png':'image/png', '.json':'application/json', '.html':'text/html', '.woff2':'font/woff2', '.mp3':'audio/mpeg', '.jpg':'image/jpeg', '.webm':'video/webm', '.mp4':'video/mp4', '.svg':'image/svg+xml' };
export async function serve(ctx) {
  await ctx.route('http://127.0.0.1:8765/**', r => { const u = decodeURIComponent(new URL(r.request().url()).pathname); const f = path.join(ROOT, u === '/' ? '/index.html' : u);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) r.fulfill({ path:f, contentType:T[path.extname(f)] || 'application/octet-stream' }); else r.fulfill({ status:404, body:'' }); });
}
