import { scenarioRepository } from '../lib/storage.mjs';
import { endpoint, json } from '../lib/http.mjs';
export const makeHandler = repository => endpoint(/^\/api\/scenarios\/[^/]+$/, 'GET', async (request, context) => json(await repository.get(new URL(request.url).pathname.split('/').at(-1), context)));
export default makeHandler(scenarioRepository());
export const config = { path: '/api/scenarios/:id', rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ['ip', 'domain'], action: 'rewrite', to: '/api/rate-limited' } };
