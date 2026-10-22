import { json } from '../lib/http.mjs';
export default async () => json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Wait a minute before retrying. Local calculations still work.' } }, 429, { 'Retry-After': '60' });
export const config = { path: '/api/rate-limited' };
