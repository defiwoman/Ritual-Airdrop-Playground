import * as v1 from '../../dist/models/exponential-v1.mjs';
import { MODEL_VERSION, CONFIG_VERSION, WARNINGS } from '../../dist/config.mjs';
import { ApiError } from './http.mjs';

const models = Object.freeze({ 'exponential-v1': v1 });
export function evaluate(scenario, modelVersion = MODEL_VERSION) {
  const model = models[modelVersion];
  if (!Object.hasOwn(models, modelVersion)) throw new ApiError(422, 'UNSUPPORTED_MODEL', 'This saved calculation model is not supported.');
  let state;
  try { state = model.readScenario(scenario); }
  catch (error) { throw new ApiError(422, 'INVALID_SCENARIO', 'Check the scenario assumptions.', error.issues ?? [{ field: '$', message: 'Invalid scenario structure.' }]); }
  const result = model.calculate(state);
  if (!result.valid) throw new ApiError(422, 'INVALID_SCENARIO', 'Check the scenario assumptions.', result.errors.map(message => ({ field: '$', message })));
  return { scenario: model.scenarioData(state), modelVersion, configVersion: CONFIG_VERSION,
    ...result, x: result.budget / result.denominator, warnings: [...WARNINGS] };
}
