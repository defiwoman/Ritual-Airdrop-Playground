import { MODEL_VERSION } from './config.mjs';

export class ServiceError extends Error {
  constructor(message, status = 0, code = 'NETWORK_UNAVAILABLE', fields = []) {
    super(message); this.status = status; this.code = code; this.fields = fields;
  }
}

export async function requestJson(path, { payload, signal, fetcher = fetch, timeout = 8000 } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetcher(path, { method: payload === undefined ? 'GET' : 'POST', credentials: 'omit',
      headers: payload === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }), signal: controller.signal });
    if (response.status === 429) throw new ServiceError('Too many requests. Wait a minute before retrying.', 429, 'RATE_LIMITED');
    if (!response.headers.get('content-type')?.includes('application/json')) throw new ServiceError('The server API is unavailable. Local calculations still work.');
    const data = await response.json();
    if (!response.ok) throw new ServiceError(data.error?.message || 'The request failed. Please retry.', response.status, data.error?.code, data.error?.fields);
    return data;
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (error instanceof ServiceError) throw error;
    throw new ServiceError('The server is unavailable. Local calculations still work; please retry.');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

export function resultMatches(local, remote) {
  return remote?.modelVersion === MODEL_VERSION && remote.valid === true &&
    ['tokens', 'usd', 'budget', 'denominator'].every(k => Number.isFinite(remote[k]) && Math.abs(local[k] - remote[k]) <= Math.max(1e-8, Math.abs(local[k]) * 1e-12));
}

// Sequence checks also protect against adapters that finish despite AbortController.
export function createVerifier({ check = (data, signal) => requestJson('/api/calculate', { payload: data, signal }), onStatus, delay = 350 }) {
  let generation = 0; let timer; let controller;
  const cancel = () => { generation++; clearTimeout(timer); controller?.abort(); };
  return {
    cancel,
    schedule(scenario, local) {
      cancel(); const current = generation;
      if (!local?.valid) { onStatus('invalid', 'Correct the assumptions to check this result.'); return; }
      onStatus('local', 'Calculated locally');
      timer = setTimeout(async () => {
        controller = new AbortController();
        onStatus('checking', 'Calculated locally · checking server…');
        try {
          const remote = await check(scenario, controller.signal);
          if (current !== generation) return;
          if (!resultMatches(local, remote)) { onStatus('error', 'Calculated locally · server result differs. Retry after refreshing.'); return; }
          onStatus('checked', 'Server checked · calculation only');
        } catch (error) {
          if (current !== generation) return;
          onStatus('offline', `Calculated locally · ${error.message}`);
        }
      }, delay);
    }
  };
}
