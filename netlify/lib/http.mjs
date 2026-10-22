export class ApiError extends Error {
  constructor(status, code, message, fields, headers = {}) {
    super(message); this.status = status; this.code = code; this.fields = fields; this.headers = headers;
  }
}

export function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, { status, headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    ...extraHeaders,
  } });
}

export function failure(error) {
  if (error instanceof ApiError) return json({ error: { code: error.code, message: error.message,
    ...(error.fields ? { fields: error.fields } : {}) } }, error.status, error.headers);
  // Never send provider messages, payloads or stack traces to the client or logs.
  return json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'The service is unavailable. Your local calculator still works. Please retry.' } }, 503, { 'Retry-After': '10' });
}

export function endpoint(path, method, handler) {
  return async (request, context) => {
    try {
      const pathname = new URL(request.url).pathname;
      if (!(path instanceof RegExp ? path.test(pathname) : pathname === path)) throw new ApiError(404, 'NOT_FOUND', 'API endpoint not found.');
      if (request.method !== method) throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Use ${method} for this endpoint.`, undefined, { Allow: method });
      const origin = request.headers.get('origin');
      if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new ApiError(403, 'CROSS_ORIGIN_DENIED', 'Use this API from the application on the same origin.');
      return await handler(request, context);
    } catch (error) { return failure(error); }
  };
}

export async function readJson(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send application/json.');
  const limit = 16 * 1024;
  if (Number(request.headers.get('content-length')) > limit) throw new ApiError(413, 'BODY_TOO_LARGE', 'Scenario requests must be at most 16 KiB.');
  if (!request.body) throw new ApiError(400, 'INVALID_JSON', 'Send a JSON scenario.');
  const reader = request.body.getReader();
  const chunks = []; let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new ApiError(413, 'BODY_TOO_LARGE', 'Scenario requests must be at most 16 KiB.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch { throw new ApiError(400, 'INVALID_JSON', 'The request is not valid UTF-8 JSON.'); }
}
