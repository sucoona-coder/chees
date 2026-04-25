// api/indices.js — Vercel Serverless Function
// Zero dépendance externe — Node.js pur uniquement

'use strict';
const crypto = require('crypto');

function validateToken(provided, expected) {
  if (!provided || !expected) return false;
  try {
    const a = Buffer.from(crypto.createHash('sha256').update(String(provided)).digest('hex'));
    const b = Buffer.from(crypto.createHash('sha256').update(String(expected)).digest('hex'));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

function isValidFen(fen) {
  if (!fen || typeof fen !== 'string') return false;
  const parts = fen.trim().split(' ');
  if (parts.length < 2) return false;
  const rows = parts[0].split('/');
  if (rows.length !== 8) return false;
  for (const row of rows) {
    let c = 0;
    for (const ch of row) {
      const n = parseInt(ch);
      if (!isNaN(n)) c += n;
      else if (/[pnbrqkPNBRQK]/.test(ch)) c++;
      else return false;
    }
    if (c !== 8) return false;
  }
  return /^[wb]$/.test(parts[1]);
}

// ── Représentation du plateau ────────────────────────────────
const PIECE_VAL = {p:100,n:320,b:330,r:500,q:900,k:20000};

function fenToState(fen) {
  const parts = fen.trim().split(' ');
  const board = Array.from({length:8}, () => Array(8).fill(null));
  const rows = parts[0].split('/');
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r]) {
      const n = parseInt(ch);
      if (!isNaN(n)) f += n;
      else { board[r][f] = ch; f++; }
    }
  }
  return {
    board,
    turn: parts[1] || 'w',
    castling: parts[2] || '-',
    ep: parts[3] || '-',
    half: parseInt(parts[4]) || 0,
    full: parseInt(parts[5]) || 1,
  };
}

function boardToFen(state) {
  const rows = [];
  for (let r = 0; r < 8; r++) {
    let row = ''; let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = state.board[r][f];
      if (!p) { empty++; }
      else { if (empty) { row += empty; empty = 0; } row += p; }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return rows.join('/') + ' ' + state.turn + ' ' + state.castling + ' ' + state.ep + ' ' + state.half + ' ' + state.full;
}

function pieceColor(p) { return p === p.toUpperCase() ? 'w' : 'b'; }
function pieceType(p)  { return p.toLowerCase(); }
function isWhite(p)    { return p === p.toUpperCase(); }

function inBounds(r, f) { return r >= 0 && r < 8 && f >= 0 && f < 8; }

// Générer les pseudo-coups (sans vérification d'échec)
function pseudoMoves(state) {
  const moves = [];
  const {board, turn, ep} = state;

  const addMove = (fr, ff, tr, tf, promo) => {
    moves.push({fr, ff, tr, tf, promo: promo || null});
  };

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (!p || pieceColor(p) !== turn) continue;
      const t = pieceType(p);
      const dir = turn === 'w' ? -1 : 1;

      if (t === 'p') {
        // Avancer
        const nr = r + dir;
        if (inBounds(nr, f) && !board[nr][f]) {
          if (nr === 0 || nr === 7) { for (const q of ['q','r','b','n']) addMove(r,f,nr,f,turn==='w'?q.toUpperCase():q); }
          else addMove(r,f,nr,f);
          // Double avance
          const start = turn === 'w' ? 6 : 1;
          if (r === start && !board[r+dir*2][f]) addMove(r,f,r+dir*2,f);
        }
        // Captures
        for (const df of [-1, 1]) {
          const nf = f + df;
          if (!inBounds(nr, nf)) continue;
          const target = board[nr][nf];
          const isEP = ep !== '-' && ep === 'abcdefgh'[nf] + (8 - nr);
          if ((target && pieceColor(target) !== turn) || isEP) {
            if (nr === 0 || nr === 7) { for (const q of ['q','r','b','n']) addMove(r,f,nr,nf,turn==='w'?q.toUpperCase():q); }
            else addMove(r,f,nr,nf);
          }
        }
      }

      else if (t === 'n') {
        for (const [dr,df] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
          const nr=r+dr, nf=f+df;
          if (inBounds(nr,nf) && (!board[nr][nf] || pieceColor(board[nr][nf]) !== turn))
            addMove(r,f,nr,nf);
        }
      }

      else if (t === 'b' || t === 'q') {
        for (const [dr,df] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
          let nr=r+dr, nf=f+df;
          while (inBounds(nr,nf)) {
            if (board[nr][nf]) { if (pieceColor(board[nr][nf]) !== turn) addMove(r,f,nr,nf); break; }
            addMove(r,f,nr,nf); nr+=dr; nf+=df;
          }
        }
      }

      if (t === 'r' || t === 'q') {
        for (const [dr,df] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          let nr=r+dr, nf=f+df;
          while (inBounds(nr,nf)) {
            if (board[nr][nf]) { if (pieceColor(board[nr][nf]) !== turn) addMove(r,f,nr,nf); break; }
            addMove(r,f,nr,nf); nr+=dr; nf+=df;
          }
        }
      }

      else if (t === 'k') {
        for (const [dr,df] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
          const nr=r+dr, nf=f+df;
          if (inBounds(nr,nf) && (!board[nr][nf] || pieceColor(board[nr][nf]) !== turn))
            addMove(r,f,nr,nf);
        }
      }
    }
  }
  return moves;
}

function applyMove(state, move) {
  const b = state.board.map(r => [...r]);
  const p = b[move.fr][move.ff];
  b[move.tr][move.tf] = move.promo || p;
  b[move.fr][move.ff] = null;
  // En passant capture
  if (pieceType(p) === 'p' && move.ff !== move.tf && !state.board[move.tr][move.tf]) {
    b[move.fr][move.tf] = null;
  }
  const nextTurn = state.turn === 'w' ? 'b' : 'w';
  // Nouveau EP
  let newEp = '-';
  if (pieceType(p) === 'p' && Math.abs(move.tr - move.fr) === 2) {
    newEp = 'abcdefgh'[move.tf] + (8 - ((move.fr + move.tr) / 2));
  }
  return { board: b, turn: nextTurn, castling: state.castling, ep: newEp, half: 0, full: state.full + (nextTurn === 'w' ? 1 : 0) };
}

function isInCheck(state, color) {
  // Trouver le roi
  let kr = -1, kf = -1;
  const kp = color === 'w' ? 'K' : 'k';
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) if (state.board[r][f] === kp) { kr=r; kf=f; }
  if (kr < 0) return true; // roi absent = position invalide
  // Vérifier si attaqué
  const opp = color === 'w' ? 'b' : 'w';
  const oppState = {...state, turn: opp};
  const oppMoves = pseudoMoves(oppState);
  return oppMoves.some(m => m.tr === kr && m.tf === kf);
}

function legalMoves(state) {
  return pseudoMoves(state).filter(m => {
    const next = applyMove(state, m);
    return !isInCheck(next, state.turn);
  });
}

function evaluate(board) {
  let score = 0;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = board[r][f];
    if (!p) continue;
    const v = PIECE_VAL[pieceType(p)] || 0;
    score += isWhite(p) ? v : -v;
  }
  return score;
}

function minimax(state, depth, alpha, beta, maximizing) {
  const moves = legalMoves(state);
  if (depth === 0 || !moves.length) {
    if (!moves.length) {
      if (isInCheck(state, state.turn)) return maximizing ? -50000 : 50000;
      return 0; // pat
    }
    return evaluate(state.board);
  }
  // Trier captures en premier
  moves.sort((a,b) => (state.board[b.tr][b.tf]?1:0)-(state.board[a.tr][a.tf]?1:0));
  let best = maximizing ? -Infinity : Infinity;
  for (const m of moves) {
    const next = applyMove(state, m);
    const val = minimax(next, depth-1, alpha, beta, !maximizing);
    if (maximizing) { if (val > best) best = val; alpha = Math.max(alpha, val); }
    else            { if (val < best) best = val; beta  = Math.min(beta,  val); }
    if (beta <= alpha) break;
  }
  return best;
}

function findBestMoves(fen, n) {
  const state = fenToState(fen);
  const moves = legalMoves(state);
  if (!moves.length) return [];

  const isMax = state.turn === 'w';
  const scored = moves.map(m => {
    const next = applyMove(state, m);
    const score = minimax(next, 2, -Infinity, Infinity, !isMax);
    const from = 'abcdefgh'[m.ff] + (8-m.fr);
    const to   = 'abcdefgh'[m.tf] + (8-m.tr);
    return { from, to, score: isMax ? score : -score, promotion: m.promo };
  });

  scored.sort((a,b) => b.score - a.score);
  return scored.slice(0, n);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ok:false,error:'Method not allowed'});

  const expected = process.env.HINT_TOKEN;
  if (!expected) return res.status(500).json({ok:false,error:'HINT_TOKEN non configuré'});

  const body = req.body || {};
  if (!validateToken(body.token||'', expected)) {
    await new Promise(r => setTimeout(r, 200));
    return res.status(401).json({ok:false,error:'Token invalide'});
  }

  const fen = (body.fen||'').trim();
  if (!isValidFen(fen)) return res.status(400).json({ok:false,error:'FEN invalide'});

  const n = Math.min(Math.max(parseInt(body.n)||1, 1), 3);

  try {
    const moves = findBestMoves(fen, n);
    return res.status(200).json({ok:true, moves});
  } catch(err) {
    return res.status(500).json({ok:false,error:err.message});
  }
};
