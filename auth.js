const crypto = require('crypto');
const { rcall, R1, body, authed } = require('./_lib');
const hashPw = (pw, salt) => new Promise((ok, no) => crypto.scrypt(pw, salt, 32, (e, k) => (e ? no(e) : ok(k.toString('hex')))));
const idOf = (email) => crypto.createHash('sha256').update('kingdom-td|' + email).digest('hex').slice(0, 24);
async function newSession(email) {
  const token = crypto.randomBytes(24).toString('hex');
  await R1(['SET', 's:' + token, JSON.stringify({ id: idOf(email), email }), 'EX', String(60 * 24 * 3600)]);
  return token;
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const b = body(req), act = b.action;
    if (act === 'me') {
      const s = await authed(req);
      return res.status(200).json(s ? { ok: 1, id: s.id, email: s.email } : { err: 'auth' });
    }
    if (act === 'logout') {
      const h = req.headers['authorization'] || '';
      const t = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
      if (/^[a-f0-9]{48}$/.test(t)) await R1(['DEL', 's:' + t]);
      return res.status(200).json({ ok: 1 });
    }
    const email = String(b.email || '').trim().toLowerCase();
    const pw = String(b.pw || '');
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 120) return res.status(200).json({ err: 'email' });
    if (pw.length < 6 || pw.length > 100) return res.status(200).json({ err: 'pw' });
    if (act === 'signup') {
      const nick = String(b.nick || '').trim().slice(0, 12);
      if (nick.length < 2) return res.status(200).json({ err: 'nick' });
      const salt = crypto.randomBytes(12).toString('hex');
      const h = await hashPw(pw, salt);
      // NX: 이미 있으면 가입 실패 (동시 가입 방지)
      const r = await R1(['SET', 'u:' + email, JSON.stringify({ s: salt, h, n: nick, t: Date.now() }), 'NX']);
      if (r !== 'OK') return res.status(200).json({ err: 'exists' });
      const token = await newSession(email);
      return res.status(200).json({ ok: 1, token, id: idOf(email), nick, email });
    }
    if (act === 'login') {
      const rl = await rcall([['INCR', 'rl:' + email], ['EXPIRE', 'rl:' + email, '300']]);
      if (rl[0] > 10) return res.status(200).json({ err: 'rate' });
      const raw = await R1(['GET', 'u:' + email]);
      if (!raw) return res.status(200).json({ err: 'nouser' });
      const u = JSON.parse(raw);
      const h = await hashPw(pw, u.s);
      const okp = h.length === u.h.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(u.h));
      if (!okp) return res.status(200).json({ err: 'badpw' });
      await R1(['DEL', 'rl:' + email]);
      const token = await newSession(email);
      return res.status(200).json({ ok: 1, token, id: idOf(email), nick: u.n, email });
    }
    return res.status(400).json({ err: 'bad' });
  } catch (e) {
    return res.status(500).json({ err: e.message === 'NO_KV' ? 'nokv' : 'server' });
  }
};
