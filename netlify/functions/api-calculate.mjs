import { evaluate } from '../lib/calculation.mjs';
import { endpoint, json, readJson } from '../lib/http.mjs';
export default endpoint('/api/calculate', 'POST', async request => json(evaluate(await readJson(request))));
export const config = { path: '/api/calculate', rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ['ip', 'domain'], action: 'rewrite', to: '/api/rate-limited' } };
