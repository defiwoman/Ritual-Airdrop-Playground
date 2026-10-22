import { ROLES, defaults, scenarioData } from './model.mjs';

export const APP_VERSION = '2.0.0';
export const MODEL_VERSION = 'exponential-v1';
export const CONFIG_VERSION = 'community-reference-2026-10-21-v1';
export const DISCLAIMER = 'Unofficial community simulation. For fun only. Assumptions are editable; rewards and token prices are not guaranteed.';
export const WARNINGS = Object.freeze([
  DISCLAIMER,
  'Role counts and weights are unverified community assumptions, not official eligibility or allocation rules.',
  'The reference rows total 3,953 memberships, not unique people; the image footer says 3,453.',
  'One main role plus distinct additional roles; Genesis variants stack independently in this model.',
  'The modelled share and token price are assumptions. A 100% share does not establish official allocations.'
]);
export function publicConfig() {
  return { appVersion: APP_VERSION, modelVersion: MODEL_VERSION, configVersion: CONFIG_VERSION,
    schemaVersion: 1, roles: ROLES.map(({ id, name, kind, count, weight }) => ({ id, name, kind, count, weight })),
    defaults: scenarioData(defaults()), warnings: [...WARNINGS] };
}
