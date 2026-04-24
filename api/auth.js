// api/auth.js — Vercel Serverless Function
// ⚠️ CommonJS requis (module.exports, pas export default)

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = req.body || {};
  const user = body.user || '';
  const pass = body.pass || '';

  if (!user || !pass) {
    return res.status(400).json({ ok: false, error: 'Champs manquants' });
  }

  const validUser = process.env.ADMIN_USER;
  const validPass = process.env.ADMIN_PASS;

  if (!validUser || !validPass) {
    return res.status(500).json({ ok: false, error: 'Variables env manquantes sur Vercel' });
  }

  if (user === validUser && pass === validPass) {
    const token = Buffer.from(user + ':' + (Date.now() + 8 * 3600000)).toString('base64');
    return res.status(200).json({ ok: true, token: token, username: user });
  }

  return res.status(401).json({ ok: false, error: 'Identifiants incorrects' });
};
