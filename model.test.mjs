import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, defaults, calculate, scenarioData, readScenario } from './dist/model.mjs';

const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
test('reproduces every per-holder figure in the supplied reference image', () => {
  const expected = { radiant:188516.59, zealot:76645.13, ritualist:31161.58, node:25512.95, ritty:12669.35, prime:12669.35, builder:12669.35, early:8492.52, frenrug:8492.52, bitty:5692.71, genesis:5692.71 };
  const out = calculate(defaults());
  assert.ok(out.valid); assert.equal(out.memberships, 3953);
  for (const r of out.rows) near(r.perHolder, expected[r.id], 0.005);
  near(out.totalAllocation, 50000000); near(out.rows.reduce((n,r)=>n+r.portion,0),100);
});
test('one main role plus extras adds the individual rewards without inflating the pool', () => {
  const state = defaults(); state.main = 'radiant'; state.extras = ['node', 'builder', 'early'];
  const out = calculate(state); assert.ok(out.valid); assert.equal(out.selected.length, 4);
  near(out.tokens, out.selected.reduce((sum,r)=>sum+r.perHolder,0));
  near(out.usd, out.tokens * 0.05); near(out.totalAllocation, 50000000);
  const old = out.tokens; state.main = 'bitty'; const next = calculate(state);
  near(next.tokens, old - out.rows.find(r=>r.id==='radiant').perHolder + out.rows.find(r=>r.id==='bitty').perHolder);
});
test('changing price affects only USD and changing allocated share scales every reward', () => {
  const state = defaults(); const initial = calculate(state); state.price = .2;
  const repriced = calculate(state); near(initial.tokens,repriced.tokens); near(initial.usd*4,repriced.usd);
  state.share = 50; const half = calculate(state); near(half.tokens,initial.tokens/2); near(half.totalAllocation,25000000);
  state.share = 0; const zero = calculate(state); assert.ok(zero.valid); assert.equal(zero.tokens,0);
});
test('selected zero-count roles and invalid inputs fail cleanly', () => {
  const s = defaults(); s.roles.bitty.count = 0; assert.equal(calculate(s).valid,false);
  s.main = 'ritty'; assert.ok(calculate(s).valid);
  for(const r of ROLES) s.roles[r.id].count = 0;
  assert.equal(calculate(s).valid,false);
  for(const bad of [NaN,Infinity,-1,1.5,10000001]) { const t=defaults(); t.roles.bitty.count=bad; assert.equal(calculate(t).valid,false); }
  for(const bad of [NaN,Infinity,-1,101]) { const t=defaults(); t.share=bad; assert.equal(calculate(t).valid,false); }
  const duplicate=defaults(); duplicate.extras=['node','node']; assert.equal(calculate(duplicate).valid,false);
  const mainAsBonus=defaults(); mainAsBonus.extras=['ritty']; assert.equal(calculate(mainAsBonus).valid,false);
});
test('shared scenarios preserve all assumptions and reject malformed data', () => {
  const s = defaults(); s.main = 'zealot'; s.extras = ['node','genesis']; s.price = .1234; s.pool = 60000000; s.share = 60; s.roles.zealot.count = 40; s.roles.bitty.weight = 1.2;
  const roundTrip = readScenario(JSON.parse(JSON.stringify(scenarioData(s))));
  assert.deepEqual(roundTrip,s); near(calculate(roundTrip).tokens,calculate(s).tokens);
  assert.throws(()=>readScenario({v:2}));
  const invalid = scenarioData(s); invalid.r[0][0] = '<script>'; assert.throws(()=>readScenario(invalid));
});
test('pool remains conserved across different counts and all valid role combinations', () => {
  for(let i=0;i<40;i++) {
    const s=defaults(); s.pool=1000000+i*1234567; s.share=(i*7)%101;
    ROLES.forEach((r,j)=>{s.roles[r.id]={count:1+(i*17+j*19)%1000,weight:((i+j)%51)/10};});
    s.main=ROLES.filter(r=>r.kind==='main')[i%5].id;
    s.extras=ROLES.filter(r=>r.kind==='extra' && (i+ROLES.indexOf(r))%2===0).map(r=>r.id);
    const out=calculate(s); assert.ok(out.valid); near(out.totalAllocation,s.pool*s.share/100,.00001); assert.ok(out.tokens <= out.budget+1e-6);
  }
});
