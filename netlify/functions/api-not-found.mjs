import { json } from '../lib/http.mjs';
export default async () => json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } }, 404);
export const config = { path: ['/api', '/api/*'], excludedPath: ['/api/config', '/api/calculate', '/api/scenarios', '/api/scenarios/:id', '/api/health', '/api/rate-limited'] };
