// Upstash Redis (REST) 연결 도우미 — Vercel Storage 의 Upstash Redis(또는 KV) 환경변수를 자동으로 찾아요.
function cfg() {
  const e = process.env;
  let url = e.KV_REST_API_URL || e.UPSTASH_REDIS_REST_URL;
  let tok = e.KV_REST_API_TOKEN || e.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !tok) {
    for (const k of Object.keys(e)) {
      if (/(REST_API_URL|REDIS_REST_URL)$/.test(k) && e[k]) {
        const tk = k.replace(/URL$/, 'TOKEN');
        if (e[tk]) { url = e[k]; tok = e[tk]; break; }
      }
    }
  }
  return { url, tok };
}
async function rcall(cmds) {
  const { url, tok } = cfg();
  if (!url || !tok) throw new Error('NO_KV');
  const r = await fetch(url.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'content-type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error('KV_ERR');
  return j.map((x) => { if (x && x.error) throw new Error(x.error); return x ? x.result : null; });
}
const R1 = async (c) => (await rcall([c]))[0];
function body(req) {
  try { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (_) { return {}; }
}
async function authed(req) {
  const h = req.headers['authorization'] || '';
  const t = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!/^[a-f0-9]{48}$/.test(t)) return null;
  const s = await R1(['GET', 's:' + t]);
  if (!s) return null;
  try { return JSON.parse(s); } catch (_) { return null; }
}
module.exports = { cfg, rcall, R1, body, authed };
