export const ROLES = Object.freeze([
  { id: 'bitty', name: 'Bitty', kind: 'main', count: 513, weight: 1, icon: 'seed', description: 'A little bitty beginning.' },
  { id: 'ritty', name: 'Ritty', kind: 'main', count: 517, weight: 1.8, icon: 'spark', description: 'Finding your Ritual rhythm.' },
  { id: 'ritualist', name: 'Ritualist', kind: 'main', count: 185, weight: 2.7, icon: 'diamond', description: 'Part of the Ritual.' },
  { id: 'zealot', name: 'Zealot', kind: 'main', count: 22, weight: 3.6, icon: 'flame', description: 'A little extra conviction.' },
  { id: 'radiant', name: 'Radiant Ritualist', kind: 'main', count: 9, weight: 4.5, icon: 'sun', description: 'Bringing the radiance.' },
  { id: 'node', name: 'Node Runner', kind: 'extra', count: 500, weight: 2.5, icon: 'node', description: 'Keeping things running.' },
  { id: 'prime', name: 'Prime Genesis', kind: 'extra', count: 100, weight: 1.8, icon: 'crown', description: 'An extra Genesis track.' },
  { id: 'builder', name: 'dApp Builder', kind: 'extra', count: 207, weight: 1.8, icon: 'code', description: 'You came here to build.' },
  { id: 'early', name: 'Early Genesis', kind: 'extra', count: 400, weight: 1.4, icon: 'clock', description: 'Early to the experiment.' },
  { id: 'frenrug', name: 'Frenrug', kind: 'extra', count: 1000, weight: 1.4, icon: 'chat', description: 'Part of the Frenrug story.' },
  { id: 'genesis', name: 'Genesis', kind: 'extra', count: 500, weight: 1, icon: 'orbit', description: 'Another piece of your journey.' },
]);

export function defaults() {
  return { version: 1, pool: 50000000, share: 100, price: 0.05, main: 'bitty', extras: [], roles: Object.fromEntries(ROLES.map(r => [r.id, { count: r.count, weight: r.weight }])) };
}

export const effectiveWeight = weight => Math.exp(weight - 1);

export function validate(s) {
  const errors = [];
  if (!Number.isFinite(s.pool) || s.pool < 1 || s.pool > 1e12) errors.push('Enter a token pool between 1 and 1 trillion.');
  if (!Number.isFinite(s.share) || s.share < 0 || s.share > 100) errors.push('The modelled share must be between 0% and 100%.');
  if (!Number.isFinite(s.price) || s.price < 0 || s.price > 100000) errors.push('Enter a token price between $0 and $100,000.');
  for (const r of ROLES) {
    const v = s.roles?.[r.id];
    if (!v || !Number.isInteger(v.count) || v.count < 0 || v.count > 10000000) errors.push(`${r.name}: enter a whole holder count between 0 and 10 million.`);
    if (!v || !Number.isFinite(v.weight) || v.weight < 0 || v.weight > 10) errors.push(`${r.name}: enter a weight between 0 and 10.`);
  }
  if (!ROLES.some(r => r.kind === 'main' && r.id === s.main)) errors.push('Choose one main role.');
  if (!Array.isArray(s.extras) || new Set(s.extras).size !== s.extras.length || s.extras.some(id => !ROLES.some(r => r.kind === 'extra' && r.id === id))) errors.push('Choose each extra role at most once.');
  return errors;
}

export function calculate(s) {
  const errors = validate(s);
  if (errors.length) return { valid: false, errors, rows: [] };
  const budget = s.pool * s.share / 100;
  const denominator = ROLES.reduce((sum, r) => sum + s.roles[r.id].count * effectiveWeight(s.roles[r.id].weight), 0);
  if (!denominator) return { valid: false, errors: ['At least one role must have an eligible holder.'], rows: [] };
  const rows = ROLES.map(r => {
    const { count, weight } = s.roles[r.id];
    const multiplier = effectiveWeight(weight);
    const perHolder = count ? budget * multiplier / denominator : 0;
    return { ...r, count, weight, multiplier, perHolder, allocation: count * perHolder, portion: count * multiplier / denominator * 100 };
  });
  const selected = rows.filter(r => r.id === s.main || s.extras.includes(r.id));
  for (const r of selected) if (r.count === 0) errors.push(`${r.name} has zero holders in this scenario. Change its count or choose another role.`);
  if (errors.length) return { valid: false, errors, rows, budget, denominator };
  const tokens = selected.reduce((sum, r) => sum + r.perHolder, 0);
  return { valid: true, errors: [], rows, selected, budget, denominator, tokens, usd: tokens * s.price, memberships: rows.reduce((n, r) => n + r.count, 0), totalAllocation: rows.reduce((n, r) => n + r.allocation, 0) };
}

export function scenarioData(s) {
  return { v: 1, p: s.pool, s: s.share, t: s.price, m: s.main, e: [...s.extras], r: ROLES.map(r => [s.roles[r.id].count, s.roles[r.id].weight]) };
}

export function readScenario(data) {
  if (!data || data.v !== 1 || !Array.isArray(data.r) || data.r.length !== ROLES.length || !Array.isArray(data.e)) throw new Error('Invalid scenario');
  const s = defaults();
  s.pool = data.p; s.share = data.s; s.price = data.t; s.main = data.m; s.extras = [...data.e];
  ROLES.forEach((r, i) => {
    if (!Array.isArray(data.r[i]) || data.r[i].length !== 2) throw new Error('Invalid role assumptions');
    s.roles[r.id] = { count: data.r[i][0], weight: data.r[i][1] };
  });
  if (validate(s).length) throw new Error('Invalid scenario assumptions');
  return s;
}
