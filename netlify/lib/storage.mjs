import { createHash, randomBytes } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { MODEL_VERSION } from '../../dist/config.mjs';
import { evaluate } from './calculation.mjs';
import { ApiError } from './http.mjs';

export const ID_PATTERN = /^[a-f0-9]{32}$/;
export function storeName(context) {
  const deployment = context?.deploy;
  if (deployment?.context === 'production') return 'ritual-scenarios-production-v1';
  if (deployment?.context === 'dev' || deployment?.context === 'local') return 'ritual-scenarios-local-v1';
  if (['deploy-preview', 'branch-deploy'].includes(deployment?.context) && typeof deployment.id === 'string' && deployment.id) {
    const suffix = createHash('sha256').update(deployment.id).digest('hex').slice(0, 24);
    return `ritual-scenarios-preview-${suffix}`;
  }
  // Fail closed. Missing platform context must never select production storage.
  throw new ApiError(503, 'STORAGE_CONTEXT_UNAVAILABLE', 'Shared links are unavailable in this environment. Use a local scenario link.');
}

export function netlifyStore(context) {
  return getStore({ name: storeName(context), consistency: 'strong' });
}

export function scenarioRepository({ getStorage = netlifyStore, newId = () => randomBytes(16).toString('hex'), now = () => new Date() } = {}) {
  return {
    async create(input, context) {
      const result = evaluate(input);
      const record = { schemaVersion: 1, modelVersion: MODEL_VERSION, createdAt: now().toISOString(), scenario: result.scenario };
      const storage = getStorage(context);
      for (let attempt = 0; attempt < 3; attempt++) {
        const id = newId();
        if (!ID_PATTERN.test(id)) throw new Error('Invalid generated identifier');
        const written = await storage.setJSON(id, record, { onlyIfNew: true });
        if (written.modified) return { id, sharePath: `/?s=${id}`, createdAt: record.createdAt, modelVersion: record.modelVersion, scenario: record.scenario, result };
      }
      throw new Error('Could not allocate scenario identifier');
    },
    async get(id, context) {
      if (!ID_PATTERN.test(id)) throw new ApiError(400, 'INVALID_ID', 'This scenario link has an invalid ID.');
      const record = await getStorage(context).get(id, { type: 'json', consistency: 'strong' });
      if (!record) throw new ApiError(404, 'SCENARIO_NOT_FOUND', 'This shared scenario was not found. Check the link or create a new one.');
      if (record.schemaVersion !== 1 || typeof record.modelVersion !== 'string' || typeof record.createdAt !== 'string' || !Number.isFinite(Date.parse(record.createdAt))) throw new Error('Invalid stored snapshot');
      const result = evaluate(record.scenario, record.modelVersion);
      return { id, sharePath: `/?s=${id}`, createdAt: record.createdAt, modelVersion: record.modelVersion, scenario: result.scenario, result };
    },
  };
}
