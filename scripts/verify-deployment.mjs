import assert from 'node:assert/strict';
import { defaults, scenarioData } from '../dist/model.mjs';

const [base, action] = process.argv.slice(2);
if (!base || !['--read-only', '--create-scenario'].includes(action)) {
  console.error('Usage: npm run verify:deployment -- https://your-site.netlify.app --read-only|--create-scenario');
  process.exit(1);
}
const origin = new URL(base).origin;
async function call(path, options) {
  const response = await fetch(origin+path, { ...options, signal: AbortSignal.timeout(15000) });
  assert.ok(response.headers.get('content-type')?.includes('application/json'), `${path} did not return JSON`);
  const data = await response.json(); assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}
const health = await call('/api/health'); assert.equal(health.status, 'ok');
const config = await call('/api/config'); assert.equal(config.modelVersion, 'exponential-v1');
const s = scenarioData(defaults()); s.m = 'ritualist'; s.e = ['node','builder'];
const options = { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(s) };
const result = await call('/api/calculate', options); assert.ok(Math.abs(result.tokens - 69343.88364961414) < 1e-6);
const notFound = await fetch(origin+'/api/unknown-endpoint'); assert.equal(notFound.status,404); assert.equal((await notFound.json()).error.code,'NOT_FOUND');
const wrongMethod = await fetch(origin+'/api/calculate'); assert.equal(wrongMethod.status,405);
if (action === '--create-scenario') {
  const saved = await call('/api/scenarios', options);
  const loaded = await call('/api/scenarios/'+saved.id);
  assert.deepEqual(loaded.scenario,s); assert.equal(loaded.result.tokens,result.tokens);
  console.log(`Saved-scenario round trip verified: ${origin}${saved.sharePath}`);
}
console.log(`Verified ${origin}: health, config, calculation, JSON 404 and method handling.`);
