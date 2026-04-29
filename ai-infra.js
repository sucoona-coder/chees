(function(root, factory){
  if(typeof module === 'object' && module.exports){
    module.exports = factory();
  }else{
    root.AIInfra = factory();
  }
})(typeof self !== 'undefined' ? self : this, function(){
  'use strict';

  function createMoveScheduler(){
    var timer = null;
    return {
      schedule: function(fn, delay){
        if(timer) clearTimeout(timer);
        timer = setTimeout(function(){ timer = null; fn(); }, delay);
      },
      clear: function(){ if(timer){ clearTimeout(timer); timer = null; } },
      pending: function(){ return !!timer; }
    };
  }

  function createSearchGuard(){
    var seq = 0;
    return {
      next: function(snapshot){ seq += 1; return { id: seq, snapshot: snapshot }; },
      isCurrent: function(ticket){ return !!ticket && ticket.id === seq; }
    };
  }

  function shouldApplySearchResult(current, snapshot){
    return current && snapshot
      && current.mode === snapshot.mode
      && current.turn === snapshot.turn
      && current.fen === snapshot.fen
      && !current.gameOver;
  }

  return { createMoveScheduler, createSearchGuard, shouldApplySearchResult };
});
