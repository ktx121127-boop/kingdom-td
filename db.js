const { rcall, R1, body, authed } = require('./_lib');
const OKP = /^[A-Za-z0-9_\-]{1,64}$/;
const MAXDOC = { pub: 20000, data: 300000 };
function parse(p) {
  const s = String(p || '').split('/');
  if (!s.length || s.some((x) => !OKP.test(x))) return null;
  if (s.length === 2 && s[0] === 'pub') return { kind: 'pub', id: s[1], key: 'd:' + s.join('/') };
  if (s.length === 4 && s[0] === 'data' && s[1] === 'users') return { kind: 'data', owner: s[2], id: s[3], key: 'd:' + s.join('/') };
  return null;
}
const match = (d, w) => {
  const [f, op, v] = w, x = d ? d[f] : undefined;
  switch (op) {
    case '==': return x === v;
    case '!=': return x !== v;
    case '<': return x < v;
    case '<=': return x <= v;
    case '>': return x > v;
    case '>=': return x >= v;
    case 'in': return Array.isArray(v) && v.includes(x);
    case 'not-in': return Array.isArray(v) && !v.includes(x);
    case 'array-contains': return Array.isArray(x) && x.includes(v);
    default: return false;
  }
};
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const me = await authed(req);
    if (!me) return res.status(200).json({ err: 'auth' });
    const b = body(req), op = b.op;
    if (op === 'query') {
      if (b.coll !== 'pub') return res.status(200).json({ err: 'denied' });
      const ids = (await R1(['SMEMBERS', 'idx:pub'])) || [];
      const keys = ids.slice(0, 3000).map((i) => 'd:pub/' + i);
      let docs = [];
      for (let i = 0; i < keys.length; i += 300) {
        const vals = await R1(['MGET', ...keys.slice(i, i + 300)]);
        vals.forEach((v, j) => { if (v) { try { docs.push({ id: ids[i + j], data: JSON.parse(v) }); } catch (_) {} } });
      }
      const ws = Array.isArray(b.where) ? b.where.slice(0, 10) : [];
      docs = docs.filter((d) => ws.every((w) => match(d.data, w)));
      if (b.orderBy && OKP.test(String(b.orderBy))) {
        const f = b.orderBy, dir = b.dir === 'desc' ? -1 : 1;
        docs.sort((a, c) => {
          const x = a.data[f], y = c.data[f];
          if (x === undefined && y === undefined) return a.id < c.id ? -1 : 1;
          if (x === undefined) return 1;
          if (y === undefined) return -1;
          return (x < y ? -1 : x > y ? 1 : 0) * dir;
        });
      } else docs.sort((a, c) => (a.id < c.id ? -1 : 1));
      const lim = Math.max(1, Math.min(100, b.limit | 0 || 50));
      return res.status(200).json({ ok: 1, docs: docs.slice(0, lim) });
    }
    const p = parse(b.path);
    if (!p) return res.status(200).json({ err: 'path' });
    if (op === 'get') {
      if (p.kind === 'data' && p.owner !== me.id) return res.status(200).json({ err: 'denied' });
      const v = await R1(['GET', p.key]);
      return res.status(200).json(v ? { ok: 1, exists: true, data: JSON.parse(v) } : { ok: 1, exists: false });
    }
    if (op === 'set' || op === 'delete') {
      const own = p.kind === 'pub' ? p.id === me.id : p.owner === me.id;
      if (!own) return res.status(200).json({ err: 'denied' });
      if (op === 'delete') {
        await rcall([['DEL', p.key], ...(p.kind === 'pub' ? [['SREM', 'idx:pub', p.id]] : [])]);
        return res.status(200).json({ ok: 1 });
      }
      const s = JSON.stringify(b.data == null ? {} : b.data);
      if (s.length > MAXDOC[p.kind]) return res.status(200).json({ err: 'big' });
      await rcall([['SET', p.key, s], ...(p.kind === 'pub' ? [['SADD', 'idx:pub', p.id]] : [])]);
      return res.status(200).json({ ok: 1 });
    }
    return res.status(400).json({ err: 'bad' });
  } catch (e) {
    return res.status(500).json({ err: e.message === 'NO_KV' ? 'nokv' : 'server' });
  }
};
