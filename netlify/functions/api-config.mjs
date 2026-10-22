import { publicConfig } from '../../dist/config.mjs';
import { endpoint, json } from '../lib/http.mjs';
export default endpoint('/api/config', 'GET', async () => json(publicConfig()));
export const config = { path: '/api/config', rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ['ip', 'domain'], action: 'rewrite', to: '/api/rate-limited' } };
