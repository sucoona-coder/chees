// api/hint.js — Vercel Serverless Function
// Stockfish tourne CÔTÉ SERVEUR — aucune logique d'analyse côté client
// Token validé avec crypto.timingSafeEqual (résistant aux timing attacks)
// Variable env requise : HINT_TOKEN (définir sur Vercel dashboard)

'use strict';

const crypto = require('crypto');

// ── Validation FEN basique ───────────────────────────────
function isValidFen(fen) {
  if (!fen || typeof fen !== 'string') return false;
  const parts = fen.trim().split(' ');
  if (parts.length < 2) return false;
  const rows = parts[0].split('/');
  if (rows.length !== 8) return false;
  // Chaque rangée doit sommer à 8 cases
  for (const row of rows) {
    let count = 0;
    for (const ch of row) {
      const n = parseInt(ch);
      if (!isNaN(n)) count += n;
      else if (/[pnbrqkPNBRQK]/.test(ch)) count += 1;
      else return false;
    }
    if (count !== 8) return false;
  }
  return /^[wb]$/.test(parts[1]);
}

// ── Validation token par comparaison sûre (timing-safe) ──
function validateToken(provided, expected) {
  if (!provided || !expected) return false;
  try {
    const a = crypto.createHash('sha256').update(provided).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    // timingSafeEqual évite les timing attacks sur la comparaison
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Analyse Stockfish via UCI ────────────────────────────
// Utilise le package npm 'stockfish' (CommonJS, pas de WASM)
function analyzeWithStockfish(fen, movetime, multiPV) {
  return new Promise((resolve, reject) => {
    let sf;
    try {
      // Le package stockfish expose le moteur comme fonction
      const Stockfish = require('stockfish');
      sf = Stockfish();
    } catch (err) {
      return reject(new Error('Stockfish non disponible: ' + err.message));
    }

    const lines = [];
    let bestmove = null;
    const timeout = setTimeout(() => {
      try { sf.postMessage('quit'); } catch {}
      resolve(buildResults(lines, bestmove, multiPV));
    }, movetime + 3000);

    sf.onmessage = function(line) {
      if (typeof line === 'object') line = line.data || '';
      if (!line) return;

      // Parser les lignes 'info score'
      if (line.startsWith('info') && line.includes('score') && line.includes(' pv ')) {
        const pvMatch  = line.match(/multipv (\d+)/);
        const cpMatch  = line.match(/score (cp|mate) (-?\d+)/);
        const pvmatch  = line.match(/ pv (.+)$/);
        if (cpMatch && pvmatch) {
          const pvNum = pvMatch ? parseInt(pvMatch[1]) - 1 : 0;
          let score = 0;
          if (cpMatch[1] === 'cp') score = parseInt(cpMatch[2]);
          else {
            const m = parseInt(cpMatch[2]);
            score = m > 0 ? 99000 - m : -99000 - m;
          }
          const moves = pvmatch[1].trim().split(' ');
          lines[pvNum] = { score, moves };
        }
      }

      if (line.startsWith('bestmove')) {
        bestmove = line.split(' ')[1] || null;
        clearTimeout(timeout);
        try { sf.postMessage('quit'); } catch {}
        resolve(buildResults(lines, bestmove, multiPV));
      }
    };

    // Initialiser et lancer la recherche
    sf.postMessage('uci');
    sf.postMessage('ucinewgame');
    sf.postMessage('setoption name MultiPV value ' + multiPV);
    sf.postMessage('position fen ' + fen);
    sf.postMessage('go movetime ' + movetime);
  });
}

function buildResults(lines, bestmove, multiPV) {
  const results = [];
  for (let i = 0; i < multiPV; i++) {
    const line = lines[i];
    if (!line || !line.moves || !line.moves[0]) continue;
    const uci = line.moves[0];
    if (uci.length < 4) continue;
    results.push({
      from:      uci.slice(0, 2),
      to:        uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : null,
      uci,
      score:     line.score,
    });
  }
  // Fallback si MultiPV vide mais bestmove présent
  if (!results.length && bestmove && bestmove.length >= 4) {
    results.push({
      from:      bestmove.slice(0, 2),
      to:        bestmove.slice(2, 4),
      promotion: bestmove.length > 4 ? bestmove[4] : null,
      uci:       bestmove,
      score:     0,
    });
  }
  return results;
}

// ── Handler principal ────────────────────────────────────
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // ── 1. Validation token ──────────────────────────────
  const expectedToken = process.env.HINT_TOKEN;
  if (!expectedToken) {
    return res.status(500).json({ ok: false, error: 'HINT_TOKEN non configuré sur Vercel' });
  }

  const body = req.body || {};
  const token = body.token || '';

  if (!validateToken(token, expectedToken)) {
    // Délai fixe pour éviter les attaques par force brute temporelle
    await new Promise(r => setTimeout(r, 200));
    return res.status(401).json({ ok: false, error: 'Token invalide' });
  }

  // ── 2. Validation FEN ────────────────────────────────
  const fen = (body.fen || '').trim();
  if (!isValidFen(fen)) {
    return res.status(400).json({ ok: false, error: 'FEN invalide' });
  }

  const n = Math.min(Math.max(parseInt(body.n) || 1, 1), 3); // 1 à 3 coups max

  // ── 3. Analyse Stockfish (max 2s pour rester sous 10s Vercel) ──
  try {
    const moves = await analyzeWithStockfish(fen, 2000, n);
    if (!moves.length) {
      return res.status(200).json({ ok: true, moves: [], info: 'Aucun coup légal' });
    }
    return res.status(200).json({ ok: true, moves });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Erreur moteur: ' + err.message });
  }
};
