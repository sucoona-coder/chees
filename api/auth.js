// api/auth.js — Vercel Serverless Function
// Variables Vercel : UTILISATEUR_ADMIN et PASSE_ADMIN

export default function handler(req, res) {
  // CORS ouvert (même projet Vercel)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { user, pass } = req.body || {};

  if (!user || !pass) {
    return res.status(400).json({ ok: false, error: 'Champs manquants' });
  }

  // ✅ Correspond aux variables dans ton Vercel : ADMIN_USER et ADMIN_PASS
  const validUser = process.env.ADMIN_USER;
  const validPass = process.env.ADMIN_PASS;

  if (!validUser || !validPass) {
    return res.status(500).json({ ok: false, error: 'Config serveur manquante' });
  }

  if (user === validUser && pass === validPass) {
    const token = Buffer.from(`${user}:${Date.now() + 8 * 3600000}`).toString('base64');
    return res.status(200).json({ ok: true, token, username: user });
  }

  // Délai anti brute-force
  setTimeout(() => {
    res.status(401).json({ ok: false, error: 'Identifiants incorrects' });
  }, 500);
}
