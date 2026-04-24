// ChessMaster Pro — Hint Mode
// Accès : jeu.html?hint=sucoona562
// Ce fichier est chargé automatiquement par jeu.html
// Modifiez HINT_TOKEN pour changer le mot de passe

var hintMode = false;
var HINT_TOKEN = 'sucoona562'; // Changer ici si besoin

function initHintMode(){
  var params = new URLSearchParams(location.search);
  var token = params.get('hint');
  if(!token) return;
  // Hash côté client acceptable ici car c'est juste pour masquer visuellement
  // Pas de donnée sensible protégée — juste des indices Stockfish
  if(token === HINT_TOKEN){
    hintMode = true;
    showHintPanel();
  }
}

function showHintPanel(){
  var panel = document.getElementById('hint-panel');
  if(panel){ panel.style.display='block'; return; }
  panel = document.createElement('div');
  panel.id = 'hint-panel';
  panel.style.cssText = 'background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:12px;font-family:monospace;margin-bottom:10px';

  var title = document.createElement('div');
  title.style.cssText = 'font-size:0.65rem;font-weight:700;color:#81b64c;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px';
  title.textContent = '⚡ Mode Indices';
  panel.appendChild(title);

  function makeBtn(label, fn, color){
    var b = document.createElement('button');
    b.style.cssText = 'display:block;width:100%;background:#161b22;border:1px solid #30363d;color:'+(color||'#8b949e')+';padding:7px 10px;border-radius:6px;font-family:monospace;font-size:0.75rem;cursor:pointer;text-align:left;margin-bottom:5px;transition:all 0.18s';
    b.textContent = label;
    b.onclick = fn;
    return b;
  }

  panel.appendChild(makeBtn('💡 Meilleur coup', hintBestMove));
  panel.appendChild(makeBtn('📊 Top 3 coups', hintTop3));
  panel.appendChild(makeBtn('✖ Effacer', hintClear, '#555'));

  var status = document.createElement('div');
  status.id = 'hint-status';
  status.style.cssText = 'font-size:0.68rem;color:#3fb950;margin-top:6px;font-style:italic';
  status.textContent = 'Prêt.';
  panel.appendChild(status);

  var moves = document.createElement('div');
  moves.id = 'hint-moves';
  moves.style.marginTop = '6px';
  panel.appendChild(moves);

  var rp = document.querySelector('.right-panel');
  if(rp) rp.insertBefore(panel, rp.firstChild);
}

async function hintBestMove(){
  if(!hintMode||chess.game_over()) return;
  hintClear();
  document.getElementById('hint-status').textContent='🔍 Calcul…';
  try{
    var results = await sfSearch(chess.fen(), 1500, 1);
    if(!results.length){ document.getElementById('hint-status').textContent='Aucun coup.'; return; }
    var best = results[0];
    // Surligner les cases
    document.querySelectorAll('.sq').forEach(function(el){
      if(el.dataset.sq===best.from) el.style.outline='3px solid rgba(201,162,39,0.9)';
      if(el.dataset.sq===best.to)   el.style.outline='3px solid rgba(201,162,39,0.7)';
    });
    drawArrow(best.from, best.to, 'gold', 'hint-main');
    var sc = (best.score/100).toFixed(2);
    document.getElementById('hint-status').textContent =
      '💡 '+best.from+'→'+best.to+'  '+(best.score>=0?'+':'')+sc+' pions';
  }catch(e){ document.getElementById('hint-status').textContent='Erreur moteur.'; }
}

async function hintTop3(){
  if(!hintMode||chess.game_over()) return;
  hintClear();
  document.getElementById('hint-status').textContent='🔍 Calcul top 3…';
  try{
    var results = await sfSearch(chess.fen(), 2000, 3);
    if(!results.length){ document.getElementById('hint-status').textContent='Aucun coup.'; return; }
    var cols=['gold','cyan','red'], medals=['🥇','🥈','🥉'];
    var movesDiv = document.getElementById('hint-moves'); movesDiv.innerHTML='';
    results.slice(0,3).forEach(function(r,i){
      drawArrow(r.from, r.to, cols[i], 'hint-arrow-'+i);
      var sc=(r.score/100).toFixed(2);
      var d=document.createElement('div');
      d.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:0.72rem;color:#8b949e';
      d.innerHTML='<span>'+medals[i]+'</span><span style="font-weight:700">'+r.from+'→'+r.to+'</span>' +
        '<span style="margin-left:auto;color:'+(r.score>=0?'#3fb950':'#ff6b6b')+'">'+(r.score>=0?'+':'')+sc+'</span>';
      movesDiv.appendChild(d);
    });
    document.getElementById('hint-status').textContent=results.length+' coups analysés';
  }catch(e){ document.getElementById('hint-status').textContent='Erreur moteur.'; }
}

function hintClear(){
  document.querySelectorAll('.sq').forEach(function(el){ el.style.outline=''; });
  clearArrows();
  var m=document.getElementById('hint-moves'); if(m) m.innerHTML='';
  var s=document.getElementById('hint-status'); if(s) s.textContent='Prêt.';
}
