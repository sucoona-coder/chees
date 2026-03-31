// api/auth.js — Vercel Serverless Function
// Les identifiants ne sont JAMAIS envoyés au client
// Variables d'environnement Vercel : ADMIN_USER et ADMIN_PASS

export default function handler(req, res) {
  // CORS pour le même domaine
  res.setHeader('Access-Control-Allow-Origin', 'https://chek-amber.vercel.app');
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

  // Identifiants stockés dans les variables d'environnement Vercel
  // → Dashboard Vercel > Settings > Environment Variables
  // ADMIN_USER=sucoona
  // ADMIN_PASS=Lopos562se
  const validUser = process.env.ADMIN_USER;
  const validPass = process.env.ADMIN_PASS;

  if (user === validUser && pass === validPass) {
    // Génère un token de session simple (valide 8h)
    const token = Buffer.from(`${user}:${Date.now() + 8 * 3600000}`).toString('base64');
    return res.status(200).json({ ok: true, token, username: user });
  }

  // Léger délai pour contrer le brute-force
  setTimeout(() => {
    res.status(401).json({ ok: false, error: 'Identifiants incorrects' });
  }, 500);
}
