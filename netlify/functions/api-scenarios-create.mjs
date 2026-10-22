import { scenarioRepository } from '../lib/storage.mjs';
import { endpoint, json, readJson } from '../lib/http.mjs';
export const makeHandler = repository => endpoint('/api/scenarios', 'POST', async (request, context) => json(await repository.create(await readJson(request), context), 201));
export default makeHandler(scenarioRepository());
export const config = { path: '/api/scenarios', rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'], action: 'rewrite', to: '/api/rate-limited' } };
