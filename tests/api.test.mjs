import test from 'node:test';
import assert from 'node:assert/strict';
import calculateHandler from '../netlify/functions/api-calculate.mjs';
import configHandler from '../netlify/functions/api-config.mjs';
import healthHandler from '../netlify/functions/api-health.mjs';
import rateHandler from '../netlify/functions/api-rate-limited.mjs';
import notFound from '../netlify/functions/api-not-found.mjs';
import { makeHandler as createHandler } from '../netlify/functions/api-scenarios-create.mjs';
import { makeHandler as readHandler } from '../netlify/functions/api-scenarios-read.mjs';
import { defaults, scenarioData, calculate, readScenario } from '../dist/model.mjs';
import { scenarioRepository, storeName } from '../netlify/lib/storage.mjs';
import { evaluate } from '../netlify/lib/calculation.mjs';

const context = { deploy: { context: 'production', id: 'prod-deploy-one' } };
const input = () => scenarioData(defaults());
const request = (path, data, options = {}) => new Request(`https://playground.example${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), ...options,
});
function storageFixture() {
  const stores = new Map();
  let counter = 0;
  const getStorage = context => {
    const name = storeName(context);
    if (!stores.has(name)) stores.set(name, new Map());
    const data = stores.get(name);
    return {
      async setJSON(key, value, options) {
        assert.equal(options.onlyIfNew, true);
        if (data.has(key)) return { modified: false };
        data.set(key, structuredClone(value)); return { modified: true };
      },
      async get(key, options) { assert.equal(options.consistency, 'strong'); return structuredClone(data.get(key) ?? null); },
    };
  };
  const repository = scenarioRepository({ getStorage, newId: () => (++counter).toString(16).padStart(32, '0'), now: () => new Date('2026-10-21T12:00:00Z') });
  return { repository, stores, getStorage };
}

test('server calculation matches the browser model and reference checkpoints', async () => {
  const data = input(); data.m = 'ritualist'; data.e = ['node', 'builder'];
  const response = await calculateHandler(request('/api/calculate', data), context);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.tokens, calculate(readScenario(data)).tokens);
  assert.ok(Math.abs(body.tokens - 69343.88364961414) < 1e-8);
  assert.equal(body.usd.toFixed(2), '3467.19');
  assert.equal(body.memberships, 3953);
  assert.ok(Math.abs(body.totalAllocation - 50000000) < 1e-6);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.ok(response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
});

test('zero price and share are valid; price does not change tokens', () => {
  const a = input(); const start = evaluate(a); a.t = 0;
  assert.equal(evaluate(a).usd, 0); assert.equal(evaluate(a).tokens, start.tokens);
  a.s = 0; assert.equal(evaluate(a).tokens, 0);
});

test('strict schema rejects malformed structures, unknown fields, types and role choices', async () => {
  const mutations = [null, [], 'text', 1, {}, ...[
    s => { s.v = 2; }, s => { s.p = '50000000'; }, s => { s.p = 0; }, s => { s.p = 1e12 + 1; },
    s => { s.s = -1; }, s => { s.s = 101; }, s => { s.t = null; }, s => { s.t = 100001; },
    s => { s.m = 'node'; }, s => { s.m = ['bitty', 'ritty']; }, s => { s.e = ['node','node']; },
    s => { s.e = ['bitty']; }, s => { s.e = ['unknown']; }, s => { s.e = {}; },
    s => { s.r = null; }, s => { s.r[0] = null; }, s => { s.r.pop(); },
    s => { s.r[0][0] = 1.2; }, s => { s.r[0][0] = '513'; }, s => { s.r[0][0] = 10000001; },
    s => { s.r[0][1] = -1; }, s => { s.r[0][1] = 11; }, s => { s.tokens = 99999; },
    s => { delete s.m; }, s => { Object.defineProperty(s, '__proto__', { value: {}, enumerable: true }); },
  ].map(change => { const s = input(); change(s); return s; })];
  for (const data of mutations) {
    const response = await calculateHandler(request('/api/calculate', data), context);
    assert.equal(response.status, 422, JSON.stringify(data));
    const body = await response.json(); assert.equal(body.error.code, 'INVALID_SCENARIO'); assert.ok(body.error.fields.length);
  }
  for (const n of [NaN, Infinity, -Infinity]) { const s = input(); s.t = n; assert.throws(() => evaluate(s)); }
});

test('zero holder selections and an all-zero denominator fail cleanly', async () => {
  const s = input(); s.r[0][0] = 0;
  assert.equal((await calculateHandler(request('/api/calculate', s), context)).status, 422);
  s.m = 'ritty'; assert.equal((await calculateHandler(request('/api/calculate', s), context)).status, 200);
  s.r.forEach(r => { r[0] = 0; });
  assert.equal((await calculateHandler(request('/api/calculate', s), context)).status, 422);
});

test('malformed JSON, wrong media, methods, origins and default function URL are rejected', async () => {
  const cases = [
    [request('/api/calculate', {}, { body: '{broken' }), 400],
    [request('/api/calculate', {}, { headers: { 'Content-Type': 'text/plain' } }), 415],
    [new Request('https://playground.example/api/calculate'), 405],
    [request('/api/calculate', input(), { headers: { 'Content-Type': 'application/json', Origin: 'https://elsewhere.example' } }), 403],
    [request('/api/calculate', input(), { headers: { 'Content-Type': 'application/json', Origin: 'null' } }), 403],
    [request('/.netlify/functions/api-calculate', input()), 404],
  ];
  for (const [req, status] of cases) {
    const response = await calculateHandler(req, context); assert.equal(response.status, status);
    assert.ok((await response.json()).error.code);
    if (status === 405) assert.equal(response.headers.get('allow'), 'POST');
  }
});

test('enforces actual 16 KiB body size with absent or false Content-Length', async () => {
  for (const extra of [{}, { 'Content-Length': '1' }]) {
    const chunks = [new Uint8Array(8192).fill(32), new Uint8Array(8193).fill(32)];
    const stream = new ReadableStream({ pull(controller) { chunks.length ? controller.enqueue(chunks.shift()) : controller.close(); } });
    const response = await calculateHandler(new Request('https://playground.example/api/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: stream, duplex: 'half' }), context);
    assert.equal(response.status, 413); assert.equal((await response.json()).error.code, 'BODY_TOO_LARGE');
  }
  const exact = JSON.stringify(input()).padEnd(16384, ' ');
  assert.equal((await calculateHandler(request('/api/calculate', {}, { body: exact }), context)).status, 200);
});

test('configuration and health expose public defaults without writing storage', async () => {
  const c = await (await configHandler(new Request('https://playground.example/api/config'), context)).json();
  assert.deepEqual(c.defaults, input()); assert.equal(c.roles.length, 11); assert.ok(c.warnings.length);
  const h = await (await healthHandler(new Request('https://playground.example/api/health'), context)).json();
  assert.equal(h.status, 'ok'); assert.equal(h.storage, 'configured-not-probed');
  const degraded = await (await healthHandler(new Request('https://playground.example/api/health'), {})).json();
  assert.equal(degraded.status, 'degraded');
});

test('creates and reloads an immutable snapshot through handlers', async () => {
  const { repository, stores } = storageFixture();
  const data = input(); data.m = 'zealot'; data.e = ['node','genesis']; data.t = .1234; data.r[0] = [1000, 1.25];
  const createdResponse = await createHandler(repository)(request('/api/scenarios', data), context);
  assert.equal(createdResponse.status, 201); const created = await createdResponse.json();
  data.r[0][0] = 9999;
  const read = await readHandler(repository)(new Request(`https://playground.example/api/scenarios/${created.id}`), context);
  assert.equal(read.status, 200); const loaded = await read.json();
  assert.deepEqual(loaded, created); assert.equal(loaded.scenario.r[0][0], 1000);
  assert.equal(created.sharePath, `/?s=${created.id}`);
  const record = stores.get(storeName(context)).get(created.id);
  assert.deepEqual(Object.keys(record).sort(), ['createdAt','modelVersion','scenario','schemaVersion']);
  const laterProduction = { deploy: { context: 'production', id: 'prod-deploy-two' } };
  assert.deepEqual(await repository.get(created.id, laterProduction), created);
});

test('full snapshots do not depend on later defaults', () => {
  const snapshot = input(); snapshot.r[0] = [678, 1.7]; snapshot.p = 90000000;
  const before = evaluate(snapshot);
  const otherDefaults = defaults(); otherDefaults.roles.bitty.count = 999999; otherDefaults.pool = 1;
  const after = evaluate(snapshot);
  assert.deepEqual(after, before); assert.equal(after.scenario.r[0][0], 678);
});

test('preview stores and development cannot read production snapshots', async () => {
  const { repository } = storageFixture(); const created = await repository.create(input(), context);
  const preview = { deploy: { context: 'deploy-preview', id: 'preview-one' } };
  const otherPreview = { deploy: { context: 'deploy-preview', id: 'preview-two' } };
  const dev = { deploy: { context: 'dev' } };
  assert.notEqual(storeName(preview), storeName(context)); assert.notEqual(storeName(preview), storeName(otherPreview));
  for (const ctx of [preview, otherPreview, dev]) await assert.rejects(repository.get(created.id, ctx), e => e.status === 404);
  assert.throws(() => storeName({}), e => e.status === 503);
  assert.throws(() => storeName({ deploy: { context: 'deploy-preview' } }));
});

test('collision retries never overwrite snapshots', async () => {
  const { getStorage } = storageFixture();
  const ids = ['a'.repeat(32), 'a'.repeat(32), 'b'.repeat(32)];
  const repository = scenarioRepository({ getStorage, newId: () => ids.shift() });
  const first = await repository.create(input(), context);
  const changed = input(); changed.t = 99;
  const second = await repository.create(changed, context);
  assert.notEqual(first.id, second.id); assert.deepEqual((await repository.get(first.id, context)).scenario, input());
});

test('invalid and missing scenario IDs have distinct actionable errors', async () => {
  const { repository } = storageFixture();
  for (const [id, status, code] of [['invalid',400,'INVALID_ID'], ['f'.repeat(32),404,'SCENARIO_NOT_FOUND']]) {
    const res = await readHandler(repository)(new Request(`https://playground.example/api/scenarios/${id}`), context);
    assert.equal(res.status, status); assert.equal((await res.json()).error.code, code);
  }
  const listing = await createHandler(repository)(new Request('https://playground.example/api/scenarios'), context);
  assert.equal(listing.status, 405);
});

test('storage outages return safe retryable errors and never claim a save succeeded', async () => {
  const repository = scenarioRepository({ getStorage() { throw new Error('private-provider-secret'); } });
  const res = await createHandler(repository)(request('/api/scenarios', input()), context);
  assert.equal(res.status, 503); assert.equal(res.headers.get('retry-after'), '10');
  const text = await res.text(); assert.ok(!text.includes('private-provider-secret')); assert.ok(!text.includes('stack'));
});

test('rate limit and unknown endpoint handlers always return JSON errors', async () => {
  const rate = await rateHandler(); assert.equal(rate.status, 429); assert.equal(rate.headers.get('retry-after'), '60');
  assert.equal((await rate.json()).error.code, 'RATE_LIMITED');
  const missing = await notFound(); assert.equal(missing.status, 404); assert.equal((await missing.json()).error.code, 'NOT_FOUND');
});
