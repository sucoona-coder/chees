import test from 'node:test';
import assert from 'node:assert/strict';
import AIInfra from './ai-infra.js';

test('move scheduler debounces rapid schedule calls', async () => {
  const s = AIInfra.createMoveScheduler();
  let count = 0;
  s.schedule(() => { count += 1; }, 30);
  s.schedule(() => { count += 1; }, 30);
  s.schedule(() => { count += 1; }, 30);
  await new Promise(r => setTimeout(r, 80));
  assert.equal(count, 1);
});

test('move scheduler clear cancels pending callback', async () => {
  const s = AIInfra.createMoveScheduler();
  let count = 0;
  s.schedule(() => { count += 1; }, 40);
  s.clear();
  await new Promise(r => setTimeout(r, 80));
  assert.equal(count, 0);
});

test('search guard invalidates stale tickets', () => {
  const g = AIInfra.createSearchGuard();
  const t1 = g.next({ fen: 'a' });
  const t2 = g.next({ fen: 'b' });
  assert.equal(g.isCurrent(t1), false);
  assert.equal(g.isCurrent(t2), true);
});

test('E2E-like validity check rejects changed board state', () => {
  const snap = { mode: 'ai', turn: 'b', fen: 'startpos' };
  const current = { mode: 'ai', turn: 'b', fen: 'different', gameOver: false };
  assert.equal(AIInfra.shouldApplySearchResult(current, snap), false);
});

test('E2E-like validity check accepts unchanged board state', () => {
  const snap = { mode: 'ai', turn: 'b', fen: 'same' };
  const current = { mode: 'ai', turn: 'b', fen: 'same', gameOver: false };
  assert.equal(AIInfra.shouldApplySearchResult(current, snap), true);
});
