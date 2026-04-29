// hint.js — ChessMaster Pro · Mode Indices
// Ce fichier ne contient AUCUNE logique d'analyse locale.
// Tout passe par /api/indices (Stockfish côté serveur).
// Le token n'est jamais comparé ici — uniquement envoyé au serveur.

(function() {
  'use strict';

  var hintMode    = false;
  var hintToken   = null;
  var hintLoading = false;

  // ── Init : lire le token depuis l'URL ──────────────────────
  var _hintInitDone = false;
  function initHintMode() {
    if (_hintInitDone) return;
    var params = new URLSearchParams(location.search);
    var tok = params.get('hint') || params.get('token');
    if (!tok) return;
    // Vérifier le token côté serveur avant d'activer quoi que ce soit
    verifyToken(tok).then(function(ok) {
      if (!ok) { console.warn('[Hint] Token refusé par le serveur'); return; }
      _hintInitDone = true;
      hintToken = tok;
      hintMode  = true;
      showHintPanel();
    });
  }

  // Appel de vérification — le serveur valide avec timingSafeEqual
  function verifyToken(tok) {
    return fetch('/api/indices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tok,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        n: 1
      })
    })
    .then(function(r) { return r.ok; })
    .catch(function()  { return false; });
  }

  // ── Panel HTML ──────────────────────────────────────────────
  function showHintPanel() {
    if (document.getElementById('hint-panel')) return;
    var panel = document.createElement('div');
    panel.id = 'hint-panel';
    panel.style.cssText = 'background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:12px;font-family:monospace;margin-bottom:10px';

    var title = document.createElement('div');
    title.style.cssText = 'font-size:0.65rem;font-weight:700;color:#81b64c;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px';
    title.textContent = 'Indices Stockfish (serveur)';
    panel.appendChild(title);

    panel.appendChild(makeBtn('Meilleur coup', hintBestMove));
    panel.appendChild(makeBtn('Top 3 coups', hintTop3));
    panel.appendChild(makeBtn('Effacer', hintClear, '#555'));

    var status = document.createElement('div');
    status.id = 'hint-status';
    status.style.cssText = 'font-size:0.68rem;color:#3fb950;margin-top:6px;font-style:italic';
    status.textContent = 'Pret';
    panel.appendChild(status);

    var movesDiv = document.createElement('div');
    movesDiv.id = 'hint-moves';
    movesDiv.style.marginTop = '6px';
    panel.appendChild(movesDiv);

    var rp = document.querySelector('.right-panel');
    if (rp) rp.insertBefore(panel, rp.firstChild);
  }

  function makeBtn(label, fn, color) {
    var b = document.createElement('button');
    b.style.cssText = 'display:block;width:100%;background:#161b22;border:1px solid #30363d;color:'+(color||'#8b949e')+';padding:7px 10px;border-radius:6px;font-family:monospace;font-size:0.75rem;cursor:pointer;text-align:left;margin-bottom:5px;transition:all 0.18s';
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  // ── Appel API ────────────────────────────────────────────────
  function callAPI(n) {
    if (!hintMode || !hintToken) return Promise.reject(new Error('Non initialisé'));
    if (typeof chess === 'undefined' || chess.game_over()) return Promise.reject(new Error('Partie terminée'));
    return fetch('/api/indices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: hintToken, fen: chess.fen(), n: n })
    })
    .then(function(r) {
      if (r.status === 401) { hintMode = false; throw new Error('Token invalide'); }
      if (!r.ok) throw new Error('Erreur ' + r.status);
      return r.json();
    })
    .then(function(d) {
      if (!d.ok) throw new Error(d.error || 'Erreur serveur');
      return d.moves || [];
    });
  }

  // ── Actions ──────────────────────────────────────────────────
  function hintBestMove() {
    if (hintLoading) return;
    hintClear(); setStatus('Stockfish analyse...'); hintLoading = true;
    callAPI(1).then(function(moves) {
      hintLoading = false;
      if (!moves.length) { setStatus('Aucun coup.'); return; }
      var m = moves[0];
      highlight(m.from, m.to, 'rgba(201,162,39,0.85)');
      if (typeof drawArrow === 'function') drawArrow(m.from, m.to, 'gold', 'hint-0');
      setStatus('Meilleur: ' + m.from + '-' + m.to + ' (' + (m.score >= 0 ? '+' : '') + (m.score/100).toFixed(2) + ')');
    }).catch(function(e) { hintLoading = false; setStatus('Erreur: ' + e.message); });
  }

  function hintTop3() {
    if (hintLoading) return;
    hintClear(); setStatus('Top 3 en cours...'); hintLoading = true;
    callAPI(3).then(function(moves) {
      hintLoading = false;
      if (!moves.length) { setStatus('Aucun coup.'); return; }
      var cols = ['rgba(201,162,39,0.85)','rgba(64,200,200,0.85)','rgba(200,64,64,0.85)'];
      var ac   = ['gold','cyan','red'];
      var md   = document.getElementById('hint-moves');
      moves.slice(0,3).forEach(function(m, i) {
        highlight(m.from, m.to, cols[i]);
        if (typeof drawArrow === 'function') drawArrow(m.from, m.to, ac[i], 'hint-'+i);
        if (md) {
          var d = document.createElement('div');
          d.style.cssText = 'display:flex;gap:8px;margin-bottom:4px;font-size:0.72rem;color:#8b949e;align-items:center';
          d.innerHTML = '<span style="font-weight:700">'+(i+1)+'. '+m.from+'-'+m.to+'</span>' +
            '<span style="margin-left:auto;color:'+(m.score>=0?'#3fb950':'#ff6b6b')+'">'+
            (m.score>=0?'+':'')+(m.score/100).toFixed(2)+'</span>';
          md.appendChild(d);
        }
      });
      setStatus(moves.length + ' coups analyses');
    }).catch(function(e) { hintLoading = false; setStatus('Erreur: ' + e.message); });
  }

  function hintClear() {
    document.querySelectorAll('.sq').forEach(function(el) { el.style.outline = ''; });
    if (typeof clearArrows === 'function') clearArrows();
    var m = document.getElementById('hint-moves'); if (m) m.innerHTML = '';
    setStatus('Pret.');
  }

  function setStatus(t) { var e = document.getElementById('hint-status'); if (e) e.textContent = t; }
  function highlight(from, to, color) {
    document.querySelectorAll('.sq').forEach(function(el) {
      if (el.dataset.sq === from || el.dataset.sq === to) {
        el.style.outline = '3px solid ' + color;
        el.style.outlineOffset = '-3px';
      }
    });
  }

  window.initHintMode = initHintMode;
  window.hintClear = hintClear;
})();
