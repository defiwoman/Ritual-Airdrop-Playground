import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as tick } from 'node:timers/promises';
import { createVerifier, requestJson } from '../dist/api.mjs';
import { evaluate } from '../netlify/lib/calculation.mjs';
import { defaults, scenarioData } from '../dist/model.mjs';
const scenario = () => scenarioData(defaults());

test('older server responses cannot mark newer inputs checked', async () => {
  const pending = []; const statuses = [];
  const verifier = createVerifier({ delay: 0, check: data => new Promise(resolve => pending.push({ data, resolve })), onStatus: kind => statuses.push(kind) });
  const a = scenario(); const b = scenario(); b.t = .2;
  verifier.schedule(a, evaluate(a)); await tick(5);
  verifier.schedule(b, evaluate(b)); await tick(5);
  assert.equal(pending.length, 2);
  pending[0].resolve(evaluate(a)); await tick(0);
  assert.equal(statuses.includes('checked'), false);
  pending[1].resolve(evaluate(b)); await tick(0);
  assert.equal(statuses.at(-1), 'checked'); verifier.cancel();
});

test('verification debounces and rejects a mismatched calculation', async () => {
  let calls = 0; const statuses = [];
  const s = scenario();
  const verifier = createVerifier({ delay: 2, check: async () => { calls++; return { ...evaluate(s), tokens: 123 }; }, onStatus: kind => statuses.push(kind) });
  verifier.schedule(s, evaluate(s)); verifier.schedule(s, evaluate(s)); verifier.schedule(s, evaluate(s));
  await tick(15); assert.equal(calls, 1); assert.equal(statuses.at(-1), 'error'); verifier.cancel();
});

test('network failure leaves explicit local mode and invalid inputs cancel checks', async () => {
  const statuses = []; const s = scenario();
  const verifier = createVerifier({ delay: 0, check: async () => { throw new Error('Offline'); }, onStatus: (kind,message) => statuses.push({ kind,message }) });
  verifier.schedule(s, evaluate(s)); await tick(5); assert.equal(statuses.at(-1).kind, 'offline');
  verifier.schedule(null, { valid: false }); assert.equal(statuses.at(-1).kind, 'invalid'); verifier.cancel();
});

test('client handles HTML fallback, rate limits, JSON validation and timeout', async () => {
  await assert.rejects(requestJson('/api/config', { fetcher: async () => new Response('<html>not an API</html>') }), e => e.code === 'NETWORK_UNAVAILABLE');
  await assert.rejects(requestJson('/api/config', { fetcher: async () => new Response('Rate limited', { status:429 }) }), e => e.code === 'RATE_LIMITED');
  await assert.rejects(requestJson('/api/config', { fetcher: async () => Response.json({error:{code:'INVALID_SCENARIO',message:'Fix inputs',fields:[]}}, {status:422}) }), e => e.status === 422 && e.message === 'Fix inputs');
  await assert.rejects(requestJson('/api/config', { timeout:5, fetcher: (_path, options) => new Promise((_resolve,reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))) }), e => e.code === 'NETWORK_UNAVAILABLE');
});
