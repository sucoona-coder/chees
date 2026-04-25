// api/indices.js — Vercel Serverless Function
// Analyse chess côté serveur via minimax (pas de dépendance externe)
// Token validé avec crypto.timingSafeEqual

'use strict';

const crypto = require('crypto');

// ── Validation token (timing-safe) ──────────────────────────
function validateToken(provided, expected) {
  if (!provided || !expected) return false;
  try {
    const a = Buffer.from(crypto.createHash('sha256').update(String(provided)).digest('hex'));
    const b = Buffer.from(crypto.createHash('sha256').update(String(expected)).digest('hex'));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

// ── Validation FEN basique ───────────────────────────────────
function isValidFen(fen) {
  if (!fen || typeof fen !== 'string') return false;
  const parts = fen.trim().split(' ');
  if (parts.length < 2) return false;
  const rows = parts[0].split('/');
  if (rows.length !== 8) return false;
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

// ── Chess engine minimax (sans lib externe) ──────────────────
const PIECE_VAL = { p:100, n:320, b:330, r:500, q:900, k:20000 };

// Tables de positionnement (score positionnel en centipawns)
const PST = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
  ],
  n: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50
  ],
  b: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0
  ],
  q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20
  ],
  k: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20
  ]
};

// Parser FEN → board array 8x8
function fenToBoard(fen) {
  const rows = fen.split(' ')[0].split('/');
  const board = [];
  for (const row of rows) {
    const cells = [];
    for (const ch of row) {
      const n = parseInt(ch);
      if (!isNaN(n)) for (let i = 0; i < n; i++) cells.push(null);
      else cells.push(ch);
    }
    board.push(cells);
  }
  return board;
}

// Évaluation statique du plateau (positif = avantage Blanc)
function evaluate(board) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (!p) continue;
      const type = p.toLowerCase();
      const val = PIECE_VAL[type] || 0;
      const pst = PST[type] ? PST[type][p === p.toUpperCase() ? r*8+f : (7-r)*8+f] || 0 : 0;
      score += p === p.toUpperCase() ? (val + pst) : -(val + pst);
    }
  }
  return score;
}

// Générer les coups légaux depuis un FEN (utiliser l'API de chess.js via eval simple)
// On utilise un module chess.js minimal inline pour éviter les dépendances
// ── Implémentation chess.js inline simplifiée ────────────────
// (Juste assez pour générer les coups et appliquer move)

// Pour éviter de bundler chess.js, on utilise une approche différente:
// Charger chess.js depuis CDN via require n'est pas possible.
// Solution: utiliser le module npm 'chess.js' qui est léger et sans WASM

let Chess;
try {
  // chess.js v0.13+ (CommonJS)
  const chessModule = require('chess.js');
  Chess = chessModule.Chess || chessModule;
} catch(e) {
  Chess = null;
}

// Minimax avec alpha-beta
function minimax(game, depth, alpha, beta, maximizing) {
  if (depth === 0 || game.game_over()) {
    const board = fenToBoard(game.fen());
    let score = evaluate(board);
    if (game.in_checkmate()) score = maximizing ? -99999 : 99999;
    return { score, move: null };
  }
  const moves = game.moves({ verbose: true });
  // Trier : captures en premier
  moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

  let best = { score: maximizing ? -Infinity : Infinity, move: null };
  for (const m of moves) {
    game.move(m);
    const result = minimax(game, depth - 1, alpha, beta, !maximizing);
    game.undo();
    if (maximizing) {
      if (result.score > best.score) { best = { score: result.score, move: m }; }
      alpha = Math.max(alpha, best.score);
    } else {
      if (result.score < best.score) { best = { score: result.score, move: m }; }
      beta = Math.min(beta, best.score);
    }
    if (beta <= alpha) break;
  }
  return best;
}

// Trouver les N meilleurs coups
function findBestMoves(fen, n) {
  if (!Chess) throw new Error('chess.js non disponible');
  const game = new Chess(fen);
  if (game.game_over()) return [];

  const isWhite = game.turn() === 'w';
  const moves = game.moves({ verbose: true });
  moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

  const results = [];
  for (const m of moves) {
    game.move(m);
    const result = minimax(game, 3, -Infinity, Infinity, !isWhite);
    game.undo();
    // Score du point de vue du joueur actif
    const score = isWhite ? result.score : -result.score;
    results.push({ from: m.from, to: m.to, uci: m.from+m.to+(m.promotion||''), score, promotion: m.promotion||null });
  }

  // Trier du meilleur au moins bon
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, n);
}

// ── Handler principal ────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  // 1. Token
  const expected = process.env.HINT_TOKEN;
  if (!expected) return res.status(500).json({ ok: false, error: 'HINT_TOKEN non configuré' });
  const token = (req.body || {}).token || '';
  if (!validateToken(token, expected)) {
    await new Promise(r => setTimeout(r, 200));
    return res.status(401).json({ ok: false, error: 'Token invalide' });
  }

  // 2. FEN
  const fen = ((req.body || {}).fen || '').trim();
  if (!isValidFen(fen)) return res.status(400).json({ ok: false, error: 'FEN invalide' });

  const n = Math.min(Math.max(parseInt((req.body||{}).n)||1, 1), 3);

  // 3. Analyse
  try {
    const moves = findBestMoves(fen, n);
    return res.status(200).json({ ok: true, moves });
  } catch(err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
