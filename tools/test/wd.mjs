// tiny WebDriver client for WebKitWebDriver (WebKitGTK: the same engine family as Safari)
import { spawn } from 'child_process';
export async function webkit(port = 4444) {
  const drv = spawn('xvfb-run', ['-a', 'WebKitWebDriver', `--port=${port}`], { stdio:'ignore', detached:true });
  const base = `http://127.0.0.1:${port}`, call = async (m, p, b) => { const r = await fetch(base + p, { method:m, headers:{ 'content-type':'application/json' }, body:b ? JSON.stringify(b) : undefined }); const j = await r.json(); if (j.value && j.value.error) throw new Error(j.value.error + ': ' + j.value.message); return j.value; };
  for (let i = 0; i < 50; i++) { try { await fetch(base + '/status'); break; } catch (e) { await new Promise(r => setTimeout(r, 200)); } }
  const s = await call('POST', '/session', { capabilities:{ alwaysMatch:{ browserName:'MiniBrowser', 'webkitgtk:browserOptions':{ binary:'/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/MiniBrowser', args:['--automation', ...(process.env.WK_ARGS ? process.env.WK_ARGS.split(' ') : [])] } } } });
  const id = s.sessionId, P = p => `/session/${id}${p}`;
  return {
    caps:s.capabilities,
    go:url => call('POST', P('/url'), { url }),
    js:(script, args = []) => call('POST', P('/execute/sync'), { script, args }),
    jsAsync:(script, args = []) => call('POST', P('/execute/async'), { script, args }),
    find:async css => (Object.values(await call('POST', P('/element'), { using:'css selector', value:css })))[0],
    keys:(el, text) => call('POST', P(`/element/${el}/value`), { text }),
    click:el => call('POST', P(`/element/${el}/click`), {}),
    shot:async () => Buffer.from(await call('GET', P('/screenshot')), 'base64'),
    timeouts:t => call('POST', P('/timeouts'), t),
    quit:async () => { try { await call('DELETE', P('')); } catch (e) {} try { process.kill(-drv.pid); } catch (e) {} },
  };
}
