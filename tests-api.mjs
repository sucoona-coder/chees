import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const indicesHandler = require('./api/indices.js');
const hintHandler = require('./api/hint.js');

function runHandler(handler, { method = 'POST', body = {}, env = {} } = {}) {
  const old = {};
  for (const [k, v] of Object.entries(env)) {
    old[k] = process.env[k];
    process.env[k] = v;
  }

  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      payload: undefined,
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(obj) { this.payload = obj; cleanup(); resolve(this); return this; },
      end() { cleanup(); resolve(this); return this; }
    };

    function cleanup() {
      for (const k of Object.keys(env)) {
        if (old[k] === undefined) delete process.env[k];
        else process.env[k] = old[k];
      }
    }

    handler({ method, body }, res);
  });
}

test('indices: rejects invalid token', async () => {
  const res = await runHandler(indicesHandler, {
    body: { token: 'bad', fen: '8/8/8/8/8/8/8/K6k w - - 0 1', n: 1 },
    env: { HINT_TOKEN: 'secret' }
  });
  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.ok, false);
});

test('indices: accepts valid token and returns ok', async () => {
  const res = await runHandler(indicesHandler, {
    body: { token: 'secret', fen: '8/8/8/8/8/8/8/K6k w - - 0 1', n: 1 },
    env: { HINT_TOKEN: 'secret' }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.ok(Array.isArray(res.payload.moves));
});

test('hint alias points to same behavior as indices', async () => {
  const res = await runHandler(hintHandler, {
    body: { token: 'secret', fen: '8/8/8/8/8/8/8/K6k w - - 0 1', n: 1 },
    env: { HINT_TOKEN: 'secret' }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
});
