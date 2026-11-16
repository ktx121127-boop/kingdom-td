const { cfg } = require('./_lib');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const { url, tok } = cfg();
  res.status(200).json({ ok: 1, kv: !!(url && tok) });
};
