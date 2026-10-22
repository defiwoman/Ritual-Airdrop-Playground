import { APP_VERSION, MODEL_VERSION } from '../../dist/config.mjs';
import { endpoint, json } from '../lib/http.mjs';
import { storeName } from '../lib/storage.mjs';
export default endpoint('/api/health', 'GET', async (_request, context) => {
  let storageConfigured = true;
  try { storeName(context); } catch { storageConfigured = false; }
  return json({ status: storageConfigured ? 'ok' : 'degraded', appVersion: APP_VERSION, modelVersion: MODEL_VERSION,
    calculation: 'available', storage: storageConfigured ? 'configured-not-probed' : 'unavailable' });
});
export const config = { path: '/api/health', rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ['ip', 'domain'], action: 'rewrite', to: '/api/rate-limited' } };
