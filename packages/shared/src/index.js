import skillSchema from './schemas/skill.schema.json' with { type: 'json' };
import gatewaySchema from './schemas/gateway.schema.json' with { type: 'json' };

export { skillSchema, gatewaySchema };

export const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

export const ACTIONS = {
  NAVIGATE: 'navigate',
  CLICK: 'click',
  FILL: 'fill',
  SELECT: 'select',
  PRESS_KEY: 'press_key',
  SCROLL: 'scroll',
  EXTRACT: 'extract',
  WAIT: 'wait',
  UPLOAD: 'upload',
  DOWNLOAD: 'download',
  FINISH: 'finish',
  FAIL: 'fail'
};

export class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Validates that an object satisfies required fields and types according to the skill specification.
 */
export function validateSkill(skill) {
  const required = [
    'id', 'name', 'description', 'version', 'schema_version',
    'parameters', 'triggers', 'domains_allowed', 'steps',
    'risk_level', 'requires_confirmation', 'tests', 'success_metrics',
    'provenance', 'signature', 'changelog'
  ];

  const missing = required.filter(field => !(field in skill));
  if (missing.length > 0) {
    throw new ValidationError(`Skill is missing required fields: ${missing.join(', ')}`, missing);
  }

  if (!/^[a-z0-9-]+$/.test(skill.id)) {
    throw new ValidationError(`Invalid skill ID format: ${skill.id}. Must be lowercase alphanumeric with hyphens.`);
  }

  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/.test(skill.version)) {
    throw new ValidationError(`Invalid semver version: ${skill.version}`);
  }

  if (!Array.isArray(skill.steps) || skill.steps.length === 0) {
    throw new ValidationError('Skill must define at least one step in steps array.');
  }

  for (let i = 0; i < skill.steps.length; i++) {
    const step = skill.steps[i];
    if (!step.id || !step.action || !step.target || !step.expect || !step.on_fail) {
      throw new ValidationError(`Step at index ${i} is missing required fields (id, action, target, expect, on_fail).`);
    }
  }

  return true;
}

/**
 * Validates model gateway structured step response.
 */
export function validateGatewayResponse(response) {
  const required = ['thought', 'action', 'target', 'expected_outcome', 'risk_level'];
  const missing = required.filter(field => !(field in response));
  if (missing.length > 0) {
    throw new ValidationError(`Gateway response missing required fields: ${missing.join(', ')}`, missing);
  }

  if (!Object.values(ACTIONS).includes(response.action)) {
    throw new ValidationError(`Invalid action in gateway response: ${response.action}`);
  }

  if (!Object.values(RISK_LEVELS).includes(response.risk_level)) {
    throw new ValidationError(`Invalid risk_level in gateway response: ${response.risk_level}`);
  }

  return true;
}
